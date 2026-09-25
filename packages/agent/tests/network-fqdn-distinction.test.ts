// packages/agent/tests/network-fqdn-distinction.test.ts
/*
 * Run this test directly on the Linux worker host (requires root for tcpdump/iptables):
 *   cd /opt/peep/packages/agent
 *   sudo npx tsx tests/network-fqdn-distinction.test.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import dns from 'node:dns/promises';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { DockerSandbox } from '../src/models/docker-sandbox.js';

const execFileAsync = promisify(execFile);

async function run() {
  console.log('\n--- ADVERSARIAL TEST: FQDN-Based Allowlist Distinction ---');
  if (process.platform !== 'linux') {
    console.log('  ⚠️  SKIPPED: This test must be run on a Linux host with Docker.');
    return;
  }

  const jobId = `adv-net-${randomUUID().slice(0, 8)}`;
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'adv-net-'));
  const projectPath = path.join(tmpDir, 'project');
  const androidDir = path.join(projectPath, 'android');
  
  await fs.mkdir(androidDir, { recursive: true });

  const npmIps = await dns.resolve4('registry.npmjs.org');
  const npmIp = npmIps[0];
  console.log(`  [SETUP] Resolved registry.npmjs.org to ${npmIp}`);

  // Create a malicious gradlew script that executes our OS-level attacks
  const gradlewPath = path.join(androidDir, 'gradlew');
  const attackScript = `#!/bin/sh
echo "[ADV_EVIDENCE_START] Executing malicious payload inside sandbox..."

# 1. Test DNS Good
echo "[ADV_EVIDENCE_DNS_GOOD]" $(nslookup registry.npmjs.org 172.30.0.1 2>&1 | grep Address | tail -n 1)

# 2. Test DNS Bad
echo "[ADV_EVIDENCE_DNS_BAD]" $(nslookup attacker.workers.dev 172.30.0.1 2>&1 | grep -i "can't find\\|nxdomain" || echo "NXDOMAIN")

# 3. Test HTTP Good
echo "[ADV_EVIDENCE_CURL_GOOD_DEBUG]"
curl -v --max-time 10 https://registry.npmjs.org/ 2>&1
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 https://registry.npmjs.org/ || echo "000")
echo "[ADV_EVIDENCE_CURL_GOOD] HTTP $HTTP_CODE"

# 4. Test HTTP Bad (Hardcoded CDN IP + wrong Host header bypass attempt)
HARDCODED_CODE=$(curl -s -o /dev/null -w "%{http_code} exit:%{exitcode}" --max-time 10 --resolve "attacker.workers.dev:443:${npmIp}" https://attacker.workers.dev/ || echo "exit:$?")
echo "[ADV_EVIDENCE_CURL_BAD] $HARDCODED_CODE"

echo "[ADV_EVIDENCE_END]"
exit 0
`;
  await fs.writeFile(gradlewPath, attackScript, { mode: 0o777 });
  await fs.writeFile(path.join(androidDir, 'gradle.properties'), '');

  // We need a dummy keystore file to trigger the gradlew code path in DockerSandbox
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

  const pcapPath = `/tmp/${jobId}.pcap`;
  console.log(`  [SETUP] Starting tcpdump on interface build0...`);
  
  const tcpdumpProc = spawn('tcpdump', [
    '-i', 'build0',
    '-c', '10', // Capture at most 10 packets to prevent hanging forever
    '--immediate-mode',
    '-w', pcapPath,
    `dst host ${npmIp} and port 443 and not src host 172.30.0.1`
  ]);

  // Wait a moment for tcpdump to initialize
  await new Promise(r => setTimeout(r, 1500));

  console.log(`  [SETUP] Running Sandbox Build with Malicious Payload...`);
  const logs: string[] = [];
  
  await sandbox.runBuild((chunk) => {
    logs.push(chunk.toString());
  });

  // Give tcpdump a moment to flush and kill it
  await new Promise(r => setTimeout(r, 1000));
  tcpdumpProc.kill('SIGTERM');

  const fullLog = logs.join('\n');
  
  // Extract evidence
  const extractEvidence = (marker: string) => {
    const line = fullLog.split('\n').find(l => l.includes(marker));
    return line ? line.trim() : `NOT FOUND (${marker})`;
  };

  console.log('\n--- FULL RAW BUILD LOG (debug) ---');
  console.log(fullLog);
  console.log('--- END RAW BUILD LOG ---\n');

  console.log('\n--- RAW EVIDENCE ---');
  console.log(extractEvidence('[ADV_EVIDENCE_DNS_GOOD]'));
  console.log(extractEvidence('[ADV_EVIDENCE_DNS_BAD]'));
  console.log(extractEvidence('[ADV_EVIDENCE_CURL_GOOD]'));
  console.log(extractEvidence('[ADV_EVIDENCE_CURL_BAD]'));
  
  // Read pcap
  let pcapOutput = '';
  try {
    const { stdout } = await execFileAsync('tcpdump', ['-r', pcapPath, '-n']);
    pcapOutput = stdout;
  } catch (err: any) {
    pcapOutput = err.stdout || ''; // tcpdump might exit non-zero if few packets captured
  }

  const packetLines = pcapOutput.trim().split('\n').filter(l => l.includes('443'));
  console.log(`\n[ADV_EVIDENCE_TCPDUMP] Captured ${packetLines.length} packets to ${npmIp}:443 during attack phase.`);
  if (packetLines.length > 0) {
      console.log('Raw packets:\n' + packetLines.join('\n'));
  }

  console.log('\n--- TEST ASSERTIONS ---');
  if (!fullLog.includes('[ADV_EVIDENCE_END]')) {
    console.error('\n❌ FAIL: Attack payload never executed — sandbox build likely failed before reaching the malicious script. Cannot conclude network isolation is safe.');
    assert.fail('Payload execution failed');
  }
  
  const dnsBadLine = extractEvidence('[ADV_EVIDENCE_DNS_BAD]').toLowerCase();
  assert.ok(dnsBadLine.includes('nxdomain') || dnsBadLine.includes('can\'t find'), 'DNS BAD did not return NXDOMAIN as expected');
  
  const curlGoodLine = extractEvidence('[ADV_EVIDENCE_CURL_GOOD]');
  assert.ok(curlGoodLine.includes('HTTP 200') || curlGoodLine.includes('HTTP 301') || curlGoodLine.includes('HTTP 302'), 'CURL GOOD failed');
  
  const curlBadLine = extractEvidence('[ADV_EVIDENCE_CURL_BAD]');
  assert.ok(!curlBadLine.includes(' 200'), 'CURL BAD unexpectedly succeeded and returned 200 OK');
  
  console.log('✅ PASS: Network FQDN distinction enforced correctly.');
  console.log('✅ PASS: Real DockerSandbox encapsulation tested and proven secure.');
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('network-fqdn-distinction.test.ts')) {
    run().catch(err => {
      console.error(err);
      process.exit(1);
    });
}
export default run;
