import assert from 'node:assert';

/**
 * Unit tests for the Sentry beforeSend() scrubber logic.
 * Extracts and tests the scrubString function in isolation — no Sentry SDK required.
 */

function makeScrubString() {
  const tokenRegex = /(Bearer\s+|session_token=)([a-zA-Z0-9\-_]+)/g;
  const apiKeyRegex = /AIza[0-9A-Za-z\-_]{35}|sk-[a-zA-Z0-9]{48}|sk-ant-[a-zA-Z0-9\-_]{90,}/g;

  return function scrubString(str: string): string {
    if (!str) return str;
    let res = str.replace(tokenRegex, '$1[REDACTED]');
    res = res.replace(apiKeyRegex, '[REDACTED_API_KEY]');
    res = res.replace(/(?:[A-Z]:\\[^\s]+|\/[^\s]+)[\\\/]([^\s\\\/]+)/g, '[REDACTED]/$1');
    return res;
  };
}

export default async function runTests() {
  console.log('  Running Sentry Scrubber unit tests...');

  const scrub = makeScrubString();

  // ─── Test 1: Google API key (AIza...) is scrubbed ───────────────────────────
  {
    const key = 'AIza' + 'A'.repeat(35);
    const input = `Failed to call AI with key ${key} in request`;
    const output = scrub(input);
    assert.ok(!output.includes(key), 'Google API key must be scrubbed');
    assert.ok(output.includes('[REDACTED_API_KEY]'), 'Replacement token must appear');
    console.log(`  ✓ [Test 1] Google API key scrubbed: "${output.slice(0, 60)}..."`);
  }

  // ─── Test 2: OpenAI key (sk-...) is scrubbed ────────────────────────────────
  {
    const key = 'sk-' + 'B'.repeat(48);
    const input = `OpenAI call failed, key=${key}`;
    const output = scrub(input);
    assert.ok(!output.includes(key), 'OpenAI API key must be scrubbed');
    assert.ok(output.includes('[REDACTED_API_KEY]'), 'Replacement token must appear');
    console.log(`  ✓ [Test 2] OpenAI key scrubbed: "${output.slice(0, 60)}..."`);
  }

  // ─── Test 3: Anthropic key (sk-ant-...) is scrubbed ─────────────────────────
  {
    // Real Anthropic keys are sk-ant-api03-<96+ chars>
    const key = 'sk-ant-api03-' + 'C'.repeat(93); // total: 13 + 93 = 106 chars after sk-ant-
    // The regex is sk-ant-[a-zA-Z0-9\-_]{90,} — 'sk-ant-' prefix is 7 chars,
    // so the capture group needs 90+ chars: 'api03-' + 'C'*93 = 6 + 93 = 99 chars ✓
    const input = `Anthropic API error with key ${key} status 500`;
    const output = scrub(input);
    assert.ok(!output.includes(key), `Anthropic API key must be scrubbed; got: ${output}`);
    assert.ok(output.includes('[REDACTED_API_KEY]'), 'Replacement token must appear');
    // Verify regex match count — should be exactly one replacement
    const matchCount = (output.match(/\[REDACTED_API_KEY\]/g) || []).length;
    assert.strictEqual(matchCount, 1, 'Should be exactly one scrubbed key');
    console.log(`  ✓ [Test 3] Anthropic key (sk-ant-api03-CCC...) scrubbed to [REDACTED_API_KEY]`);
    console.log(`            Key length: ${key.length} chars, match count: ${matchCount}`);
  }

  // ─── Test 4: Short Anthropic-like string (< 90 suffix chars) is NOT scrubbed ─
  {
    // A string starting with 'sk-ant-' but only 50 suffix chars — should not match
    const shortKey = 'sk-ant-' + 'D'.repeat(50);
    const input = `Some string with ${shortKey} inside`;
    const output = scrub(input);
    // This should NOT be scrubbed since it's below the 90-char minimum
    assert.ok(output.includes(shortKey), `Short sk-ant- string below threshold should NOT be scrubbed; got: ${output}`);
    console.log(`  ✓ [Test 4] Short sk-ant- string (50 chars) correctly NOT scrubbed (below 90-char threshold)`);
  }

  // ─── Test 5: Bearer token is scrubbed ────────────────────────────────────────
  {
    const input = 'Authorization: Bearer abc123XYZ-token in request header';
    const output = scrub(input);
    assert.ok(!output.includes('abc123XYZ-token'), 'Bearer token must be scrubbed');
    assert.ok(output.includes('Bearer [REDACTED]'), 'Bearer prefix must be preserved');
    console.log(`  ✓ [Test 5] Bearer token scrubbed: "${output.slice(0, 60)}..."`);
  }

  // ─── Test 6: Multiple keys in one string — all scrubbed ──────────────────────
  {
    const googleKey = 'AIza' + 'E'.repeat(35);
    const anthropicKey = 'sk-ant-api03-' + 'F'.repeat(93);
    const input = `google=${googleKey} anthropic=${anthropicKey}`;
    const output = scrub(input);
    assert.ok(!output.includes(googleKey), 'Google key must be scrubbed in multi-key string');
    assert.ok(!output.includes(anthropicKey), 'Anthropic key must be scrubbed in multi-key string');
    const matchCount = (output.match(/\[REDACTED_API_KEY\]/g) || []).length;
    assert.strictEqual(matchCount, 2, 'Both keys must be individually scrubbed');
    console.log(`  ✓ [Test 6] Multiple keys (Google + Anthropic) both scrubbed: ${matchCount} replacements`);
  }

  console.log('  🟢 Passed');
}

import { fileURLToPath } from 'node:url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runTests().catch(console.error);
}
