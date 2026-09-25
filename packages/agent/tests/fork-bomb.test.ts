// packages/agent/tests/fork-bomb.test.ts
/*
 * Run this test directly on the Linux worker host:
 *   cd /opt/peep/packages/agent
 *   sudo npx tsx tests/fork-bomb.test.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { DockerSandbox } from '../src/models/docker-sandbox.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** Helper to get host 1-minute load average */
async function getHostLoad() {
  const { stdout } = await execFileAsync('uptime');
  // Match "load average: 0.10, 0.05, 0.01" or "load averages: ..."
  const match = stdout.match(/load average[s]?:\s+([0-9.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

async function run() {
  console.log('\n--- ADVERSARIAL TEST: Fork Bomb (Process Exhaustion) ---');
  if (process.platform !== 'linux') {
    console.log('  ⚠️  SKIPPED: This test must be run on a Linux host with Docker.');
    return;
  }

  const loadBefore = await getHostLoad();
  console.log(`  [HOST] System 1-minute load average before attack: ${loadBefore}`);

  const jobId = `adv-fork-${randomUUID().slice(0, 8)}`;
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'adv-fork-'));
  const projectPath = path.join(tmpDir, 'project');
  const androidDir = path.join(projectPath, 'android');
  
  await fs.mkdir(androidDir, { recursive: true });

  // 1. Create a deterministic fork bomb script.
  // Instead of an exponential `:(){ :|:& };:`, we use a tight loop of sleeps
  // which will predictably hit the 200 process cap, but is much easier to measure
  // and trace in tests.
  const gradlewPath = path.join(androidDir, 'gradlew');
  const attackScript = `#!/bin/sh
echo "[FORK] Starting linear process explosion payload..."

# We attempt to spawn 500 sleep processes in the background.
# The cgroup pids-limit is 200, so we should hit EAGAIN (Resource temporarily unavailable)
# somewhere around 190-200.
count=0
while [ $count -lt 500 ]; do
  sleep 60 &
  count=$((count + 1))
done

# Wait briefly for kernel limits to fully enforce and log
echo "[FORK] Finished spawn loop, attempting to run one more command..."
ls -l / > /dev/null 2>&1 || echo "[FORK_FAILED] Final command failed due to PID limits!"

# Sleep so the test runner has time to inspect the container from the outside
sleep 15
`;
  await fs.writeFile(gradlewPath, attackScript, { mode: 0o777 });
  await fs.writeFile(path.join(androidDir, 'gradle.properties'), '');

  // Dummy keystore to trigger the build path
  const keystorePath = path.join(tmpDir, 'dummy.jks');
  await fs.writeFile(keystorePath, 'dummy keystore content');

  const timeoutMs = 15000; // 15 seconds is enough for the tight loop

  const sandbox = new DockerSandbox({
    jobId,
    projectPath,
    framework: 'react-native',
    keystorePath,
    keystorePassword: 'dummy',
    keyAlias: 'dummy',
    keyPassword: 'dummy',
    timeoutMs,
  });

  console.log(`  [SETUP] Running Sandbox Build with Fork Bomb Payload...`);
  const logs: string[] = [];
  
  // We need to inspect the container WHILE it's running.
  // We will intercept the containerName once runBuild starts.
  let pidsObserved = -1;
  const containerName = sandbox['containerName'];

  // Start a polling loop to measure pids while the container runs
  const pidPoller = setInterval(async () => {
    try {
      const { stdout } = await execFileAsync('docker', ['stats', containerName, '--no-stream', '--format', '{{.PIDs}}']);
      const pids = parseInt(stdout.trim(), 10);
      if (!isNaN(pids)) {
        pidsObserved = Math.max(pidsObserved, pids);
      }
    } catch {
      // Container might not be up yet, or just exited.
    }
  }, 50);
  
  await sandbox.runBuild((chunk) => {
    const text = chunk.toString().trim();
    if (text) {
      logs.push(text);
    }
  });

  clearInterval(pidPoller);
  
  const loadAfter = await getHostLoad();
  console.log(`  [HOST] System 1-minute load average after attack: ${loadAfter}`);

  const fullLog = logs.join('\n');
  
  console.log('\n--- FULL RAW BUILD LOG (debug) ---');
  console.log(fullLog);
  console.log('--- END RAW BUILD LOG ---\n');

  console.log('\n--- TEST ASSERTIONS ---');
  
  // 1. Assert host survival
  const loadDiff = Math.abs(loadAfter - loadBefore);
  console.log(`  [ASSERT] Host load average difference: ${loadDiff.toFixed(2)}`);
  assert.ok(loadDiff < 5.0, 'Host load average spiked significantly, indicating kernel struggle!');

  // 2. Assert kernel PID limits were enforced and observed
  console.log(`  [ASSERT] Max PIDs observed via docker stats: ${pidsObserved}`);
  // We should see a high number near the cap, but strictly <= 200
  if (pidsObserved > 0) {
    assert.ok(pidsObserved <= 200, `Container exceeded PID limit! Reached ${pidsObserved}`);
  } else {
    console.log(`  [ASSERT] Polling missed PID capture (container failed too fast), skipping exact count assertion.`);
  }

  // 3. Assert container shell experienced fork failures
  console.log(`  [ASSERT] Checking for fork failures in log...`);
  // POSIX shell typically prints "can't fork" or "Resource temporarily unavailable"
  const hitLimits = fullLog.toLowerCase().includes('resource temporarily unavailable') || 
                    fullLog.toLowerCase().includes("can't fork") ||
                    fullLog.toLowerCase().includes('cannot fork') ||
                    fullLog.includes('[FORK_FAILED]');
  assert.ok(hitLimits, 'Container shell never reported fork failures (EAGAIN)');
  
  // 4. Verify cleanup
  console.log(`  [ASSERT] Checking for lingering container: ${containerName}`);
  const { stdout } = await execFileAsync('docker', ['ps', '-a', '--filter', `name=${containerName}`, '--format', '{{.Names}}']);
  const lingering = stdout.trim();
  if (lingering === containerName) {
    console.error('\n❌ FAIL: Container survived completion/forceKill!');
    assert.fail('Container still exists on the host.');
  } else {
    console.log('✅ PASS: Container successfully eradicated from host.');
  }

  console.log('✅ PASS: Fork Bomb and Process Exhaustion strictly isolated.');
}

if (import.meta.url === \`file://\${process.argv[1]}\` || process.argv[1].endsWith('fork-bomb.test.ts')) {
    run().catch(err => {
      console.error(err);
      process.exit(1);
    });
}
export default run;
