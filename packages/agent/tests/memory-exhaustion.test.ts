// packages/agent/tests/memory-exhaustion.test.ts
/*
 * Run this test directly on the Linux worker host:
 *   cd /opt/peep/packages/agent
 *   sudo npx tsx tests/memory-exhaustion.test.ts
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

/** Helper to get host free memory in MB */
async function getHostFreeMemMB() {
  const { stdout } = await execFileAsync('free', ['-m']);
  // free -m output has a "Mem:" row, 2nd column is total, 3rd is used, 4th is free, 7th is available
  const match = stdout.match(/Mem:\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

async function run() {
  console.log('\n--- ADVERSARIAL TEST: Memory Exhaustion (OOM) ---');
  if (process.platform !== 'linux') {
    console.log('  ⚠️  SKIPPED: This test must be run on a Linux host with Docker.');
    return;
  }

  const memBefore = await getHostFreeMemMB();
  console.log(`  [HOST] System available memory before attack: ${memBefore} MB`);

  const jobId = `adv-oom-${randomUUID().slice(0, 8)}`;
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'adv-oom-'));
  const projectPath = path.join(tmpDir, 'project');
  const androidDir = path.join(projectPath, 'android');
  
  await fs.mkdir(androidDir, { recursive: true });

  // 1. Create a deterministic OOM script.
  // awk allocating an array infinitely is an extremely fast and reliable way
  // to bloat memory without writing to disk.
  const gradlewPath = path.join(androidDir, 'gradlew');
  const attackScript = '#!/bin/sh\\n' +
  'echo "[OOM] Starting memory exhaustion payload..."\\n' +
  'cat > /tmp/oom.js << "JSEOF"\\n' +
  'let a = [];\\n' +
  'while (true) {\\n' +
  '  const b = Buffer.alloc(50 * 1024 * 1024);\\n' +
  '  b.fill(1);\\n' +
  '  a.push(b);\\n' +
  '}\\n' +
  'JSEOF\\n' +
  'node /tmp/oom.js || echo "[OOM_EXIT] node exited with code $?"\\n' +
  'echo "[OOM_FAILED] If you see this, the OOM killer failed to stop the process!"\\n';
  await fs.writeFile(gradlewPath, attackScript, { mode: 0o777 });
  await fs.writeFile(path.join(androidDir, 'gradle.properties'), '');

  // Dummy keystore to trigger the build path
  const keystorePath = path.join(tmpDir, 'dummy.jks');
  await fs.writeFile(keystorePath, 'dummy keystore content');

  const timeoutMs = 30000; // 30 seconds to give awk plenty of headroom to allocate 4GB

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

  console.log(`  [SETUP] Running Sandbox Build with OOM Payload (Timeout: ${timeoutMs / 1000}s)...`);
  const logs: string[] = [];
  
  const containerName = sandbox['containerName'];

  // Save dmesg position before attack
  const { stdout: dmesgBefore } = await execFileAsync('dmesg');
  const dmesgLengthBefore = dmesgBefore.length;

  const success = await sandbox.runBuild((chunk) => {
    const text = chunk.toString();
    logs.push(text);
    process.stdout.write(`    > [RAW] ${text}`); // Print absolutely everything directly
  });

  const memAfter = await getHostFreeMemMB();
  console.log(`  [HOST] System available memory after attack: ${memAfter} MB`);

  const fullLog = logs.join('\n');
  
  console.log('\n--- TEST ASSERTIONS ---');
  
  // 1. Verify build failed
  console.log(`  [ASSERT] runBuild() returned ${success}`);
  assert.strictEqual(success, false, 'runBuild() should return false when OOM killed');

  // 2. Assert host memory didn't permanently tank or drop catastrophically
  // It's normal for it to fluctuate a bit, but it shouldn't drop by 4GB+ and stay there.
  const memDiff = Math.abs(memBefore - memAfter);
  console.log(`  [ASSERT] Host available memory difference: ${memDiff} MB`);
  assert.ok(memDiff < 1000, `Host memory difference is suspiciously large (${memDiff} MB), possible leakage!`);

  // 3. Assert container exit was due to exit code 137 (SIGKILL)
  console.log(`  [ASSERT] Checking for exit code 137 in log...`);
  const oomKilled = fullLog.includes('exited with code 137');
  const timedOut = fullLog.includes('Build timed out');

  assert.ok(oomKilled, timedOut 
    ? 'Payload timed out WITHOUT triggering OOM (137) — inconclusive, memory limit may not be enforced or allocation was too slow'
    : 'Container did not exit with code 137 (OOM Kill)');
  
  assert.ok(!fullLog.includes('[OOM_FAILED]'), 'OOM payload completed without being killed!');

  // 4. Assert definitive OOM evidence in dmesg
  console.log(`  [ASSERT] Checking host dmesg for cgroup OOM killer logs...`);
  const { stdout: dmesgAfter } = await execFileAsync('dmesg');
  const newDmesg = dmesgAfter.substring(dmesgLengthBefore);
  
  const hasOOM = newDmesg.toLowerCase().includes('out of memory') || 
                 newDmesg.toLowerCase().includes('oom-kill') || 
                 newDmesg.toLowerCase().includes('killed process');
  
  if (hasOOM) {
    console.log('✅ PASS: Found definitive OOM killer action in host dmesg.');
    // Print the exact lines for evidence
    const oomLines = newDmesg.split('\n').filter(l => l.toLowerCase().includes('oom') || l.toLowerCase().includes('killed process'));
    console.log('    Evidence:');
    oomLines.slice(0, 3).forEach(l => console.log(`      ${l.trim()}`));
  } else {
    // If dmesg wrapped or requires higher privileges, it might not show up depending on system logging,
    // but on a standard Linux worker running with sudo it should.
    console.warn('⚠️ WARNING: Did not find clear OOM log in dmesg. (Check if dmesg requires root or if logs go to journalctl instead)');
    // We don't hard fail here solely on dmesg parsing because exit code 137 is also strong proof,
    // but we heavily flag it.
    assert.ok(oomKilled, 'Both dmesg AND exit code 137 missing. No proof of OOM.');
  }

  // 5. Verify cleanup
  console.log(`  [ASSERT] Checking for lingering container: ${containerName}`);
  const { stdout } = await execFileAsync('docker', ['ps', '-a', '--filter', `name=${containerName}`, '--format', '{{.Names}}']);
  const lingering = stdout.trim();
  
  if (lingering === containerName) {
    console.error('\n❌ FAIL: Container survived completion/forceKill!');
    assert.fail('Container still exists on the host.');
  } else {
    console.log('✅ PASS: Container successfully eradicated from host.');
  }

  console.log('✅ PASS: Memory Exhaustion (OOM) strictly isolated.');
}

if (import.meta.url === \`file://\${process.argv[1]}\` || process.argv[1].endsWith('memory-exhaustion.test.ts')) {
    run().catch(err => {
      console.error(err);
      process.exit(1);
    });
}
export default run;
