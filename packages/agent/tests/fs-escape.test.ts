// packages/agent/tests/fs-escape.test.ts
/*
 * Run this test directly on the Linux worker host:
 *   cd /opt/peep/packages/agent
 *   sudo npx tsx tests/fs-escape.test.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { DockerSandbox } from '../src/models/docker-sandbox.js';

async function run() {
  console.log('\n--- ADVERSARIAL TEST: Filesystem Escape & Symlink Attack ---');
  if (process.platform !== 'linux') {
    console.log('  ⚠️  SKIPPED: This test must be run on a Linux host with Docker.');
    return;
  }

  const jobId = `adv-fs-${randomUUID().slice(0, 8)}`;
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'adv-fs-'));
  const projectPath = path.join(tmpDir, 'project');
  const androidDir = path.join(projectPath, 'android');
  
  await fs.mkdir(androidDir, { recursive: true });

  // Create a malicious gradlew script
  const gradlewPath = path.join(androidDir, 'gradlew');
  const attackScript = `#!/bin/sh
echo "[ADV_EVIDENCE_START] Executing filesystem escape payload..."

# 1. Attempt to read sensitive host files (if mount namespaces leaked)
echo "[ADV_EVIDENCE_READ_SHADOW]" $(cat /etc/shadow 2>&1 | head -n 1)
echo "[ADV_EVIDENCE_READ_DOCKER_SOCK]" $(ls -l /var/run/docker.sock 2>&1)

# 2. Attempt to break out of /workspace bounds
echo "[ADV_EVIDENCE_WRITE_ROOT]" $(touch /root/hacked 2>&1 || echo "Permission denied")
echo "[ADV_EVIDENCE_WRITE_SYS]" $(touch /sys/fs/cgroup/memory/hacked 2>&1 || echo "Permission denied")

# 3. Setup Symlink Attack for docker cp
# React Native default artifact path is: /workspace/android/app/build/outputs/apk/release/app-release.apk
mkdir -p /workspace/android/app/build/outputs/apk/release/
# We symlink the expected artifact path to a highly sensitive file inside the container (/etc/shadow)
# The goal is to see if docker cp resolves this on the host or inside the container.
ln -s /etc/shadow /workspace/android/app/build/outputs/apk/release/app-release.apk

echo "[ADV_EVIDENCE_SYMLINK_CREATED] Symlink to /etc/shadow planted at artifact extraction path."

echo "[ADV_EVIDENCE_END]"
exit 0
`;
  await fs.writeFile(gradlewPath, attackScript, { mode: 0o777 });
  await fs.writeFile(path.join(androidDir, 'gradle.properties'), '');

  // We need a dummy keystore file to trigger the gradlew code path
  const keystorePath = path.join(tmpDir, 'dummy.jks');
  await fs.writeFile(keystorePath, 'dummy keystore content');

  const sandbox = new DockerSandbox({
    jobId,
    projectPath,
    framework: 'react-native',
    keystorePath,
    keystorePassword: 'dummy',
    keyAlias: 'dummy',
    keyPassword: 'dummy'
  });

  console.log(`  [SETUP] Running Sandbox Build with Malicious FS Payload...`);
  const logs: string[] = [];
  
  await sandbox.runBuild((chunk) => {
    logs.push(chunk.toString());
  });

  const fullLog = logs.join('\n');
  
  const extractEvidence = (marker: string) => {
    const line = fullLog.split('\n').find(l => l.includes(marker));
    return line ? line.trim() : `NOT FOUND (${marker})`;
  };

  console.log('\n--- FULL RAW BUILD LOG (debug) ---');
  console.log(fullLog);
  console.log('--- END RAW BUILD LOG ---\n');

  console.log('\n--- RAW EVIDENCE ---');
  console.log(extractEvidence('[ADV_EVIDENCE_READ_SHADOW]'));
  console.log(extractEvidence('[ADV_EVIDENCE_READ_DOCKER_SOCK]'));
  console.log(extractEvidence('[ADV_EVIDENCE_WRITE_ROOT]'));
  console.log(extractEvidence('[ADV_EVIDENCE_WRITE_SYS]'));
  console.log(extractEvidence('[ADV_EVIDENCE_SYMLINK_CREATED]'));

  console.log('\n--- SYMLINK ATTACK EXTRACTION PHASE ---');
  const extractionDest = path.join(tmpDir, 'extracted-artifact.apk');
  console.log(`  [SYSTEM] Simulating backend calling extractArtifact() to ${extractionDest}`);
  
  const extractSuccess = await sandbox.extractArtifact(extractionDest);
  
  console.log('\n--- TEST ASSERTIONS ---');
  if (!fullLog.includes('[ADV_EVIDENCE_END]')) {
    console.error('\n❌ FAIL: Attack payload never executed.');
    assert.fail('Payload execution failed');
  }

  // 1. Verify we cannot read sensitive mount files
  const shadowOutput = extractEvidence('[ADV_EVIDENCE_READ_SHADOW]');
  assert.ok(shadowOutput.includes('Permission denied') || shadowOutput.includes('No such file'), 'Able to read /etc/shadow or shadow does not have denied permissions!');
  
  const sockOutput = extractEvidence('[ADV_EVIDENCE_READ_DOCKER_SOCK]');
  assert.ok(sockOutput.includes('No such file') || sockOutput.includes('Permission denied'), 'Docker socket is mounted or readable!');

  // 2. Verify we cannot write outside workspace
  const rootWrite = extractEvidence('[ADV_EVIDENCE_WRITE_ROOT]');
  assert.ok(rootWrite.includes('Permission denied') || rootWrite.includes('Read-only file system'), 'Able to write to /root!');
  
  const sysWrite = extractEvidence('[ADV_EVIDENCE_WRITE_SYS]');
  assert.ok(sysWrite.includes('Permission denied') || sysWrite.includes('Read-only file system'), 'Able to write to /sys/fs/cgroup!');
  
  // 3. Verify Symlink Attack Results
  if (extractSuccess) {
      // If docker cp succeeded, we must ensure it did NOT extract the host's /etc/shadow
      const extractedContent = await fs.readFile(extractionDest, 'utf8');
      
      console.log(`  [SYMLINK] Extraction succeeded! Extracted file length: ${extractedContent.length} bytes`);
      
      if (extractedContent.includes('root:')) {
          console.error('\n❌ FAIL: DOCKER CP EXFILTRATED A SYSTEM SHADOW/PASSWD FILE VIA SYMLINK!');
          assert.fail('Symlink attack successful against host/container sensitive files.');
      }
      console.log('✅ PASS: Symlink extraction yielded harmless file content.');
  } else {
      console.log('✅ PASS: Symlink extraction was completely rejected or failed (safe behavior).');
  }

  console.log('✅ PASS: Filesystem and Mount isolation strictly enforced.');
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('fs-escape.test.ts')) {
    run().catch(console.error);
}
export default run;
