// packages/cloud-build/tests/unit/network-config.test.ts
// Unit tests for the dnsmasq config generator and FQDN allowlist.
// These tests verify the generated configuration content — no dnsmasq or iptables
// process is invoked here. Linux-level tests are in the adversarial suite.

import assert from 'node:assert/strict';
import {
  generateDnsmasqConfig,
  ALLOWLISTED_FQDNS,
  IPSET_NAME,
  RESOLVER_IP,
} from '../../src/network-setup.js';

export default async function run() {

  const config = generateDnsmasqConfig();

  // ── Structural assertions ─────────────────────────────────────────────────

  assert.ok(config.includes(`listen-address=${RESOLVER_IP}`), 'Binds to bridge resolver IP only');
  assert.ok(config.includes('bind-interfaces'), 'Bound to specific interface only');

  // Every allowlisted FQDN must appear in the config with the correct ipset directive
  for (const fqdn of ALLOWLISTED_FQDNS) {
    const directive = `ipset=/${fqdn}/${IPSET_NAME}`;
    assert.ok(
      config.includes(directive),
      `Allowlist missing directive for ${fqdn}: expected "${directive}"`,
    );
  }
  console.log(`  ✓ All ${ALLOWLISTED_FQDNS.length} FQDNs have ipset= directives`);

  // ── Catch-all NXDOMAIN block ──────────────────────────────────────────────

  assert.ok(config.includes('address=/#/'), 'Catch-all NXDOMAIN block present (address=/#/)');
  console.log('  ✓ Catch-all NXDOMAIN block present');

  // ── No wildcard subdomains ────────────────────────────────────────────────

  // All allowlisted entries must be exact FQDNs (no * or regex)
  for (const fqdn of ALLOWLISTED_FQDNS) {
    assert.ok(!fqdn.includes('*'), `No wildcard in allowlisted FQDN: ${fqdn}`);
    assert.ok(!fqdn.startsWith('.'), `No leading dot in allowlisted FQDN: ${fqdn}`);
  }
  console.log('  ✓ All allowlisted FQDNs are exact (no wildcards)');

  // ── No public DNS fallback ────────────────────────────────────────────────

  // The config must NOT forward unknown queries upstream
  assert.ok(!config.includes('nameserver'), 'No upstream nameserver configured');
  assert.ok(!config.includes('server=8.8.8.8'), 'No Google DNS fallback');
  assert.ok(!config.includes('server=1.1.1.1'), 'No Cloudflare DNS fallback');
  // address=/#/ is the enforcing rule — it prevents forwarding by returning NXDOMAIN
  const catchAllIndex = config.indexOf('address=/#/');
  const ipsetSection  = config.indexOf('ipset=/');
  assert.ok(catchAllIndex > ipsetSection, 'Catch-all appears AFTER ipset directives');
  console.log('  ✓ No upstream DNS fallback configured (fail-closed)');

  // ── Critical FQDNs must be in allowlist ──────────────────────────────────

  const required = ['registry.npmjs.org', 'pub.dev', 'dl.google.com', 'plugins.gradle.org'];
  for (const fqdn of required) {
    assert.ok(ALLOWLISTED_FQDNS.includes(fqdn), `Required FQDN in allowlist: ${fqdn}`);
  }
  console.log('  ✓ All critical package registry FQDNs are allowlisted');

  // ── Absence of known-dangerous FQDNs ─────────────────────────────────────

  // These must NOT be in the allowlist — they're examples of what should be blocked
  const blocked = [
    'attacker.example.com',
    'workers.dev',         // Cloudflare Workers hosting platform
    'ngrok.io',            // Tunnel service
    'requestbin.com',      // Data exfiltration testing
  ];
  for (const fqdn of blocked) {
    assert.ok(!ALLOWLISTED_FQDNS.includes(fqdn), `Dangerous FQDN not in allowlist: ${fqdn}`);
  }
  console.log('  ✓ No dangerous FQDNs in allowlist');

  console.log('\n  All network-config tests passed.');
}
