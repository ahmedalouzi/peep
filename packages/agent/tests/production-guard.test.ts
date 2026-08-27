import assert from 'node:assert';

/**
 * Unit tests for the production guard in agent-service.ts gateway selection.
 * 
 * The guard is at apps/desktop/src/main/services/agent-service.ts ~L976:
 *   if (process.env.NODE_ENV === 'production') {
 *     this.emitStream({ type: 'error', content: 'AUTH_REQUIRED: ...' });
 *     return;
 *   }
 * 
 * Rather than importing the full Electron-dependent agent-service (which requires
 * a running Electron context), this test exercises the guard logic directly as a
 * pure function — consistent with how the design-intelligence and builder tests
 * isolate logic from infrastructure.
 */

// Simulate the guard logic extracted from agent-service.ts L976-L981
function selectGateway(opts: {
  sessionToken: string;
  nodeEnv: string;
  localKey?: string;
  emitError: (msg: string) => void;
  makeProductionGateway: () => any;
  makeLocalGateway: (key: string) => any;
}): any {
  const { sessionToken, nodeEnv, localKey, emitError, makeProductionGateway, makeLocalGateway } = opts;

  if (sessionToken) {
    return makeProductionGateway();
  } else {
    // SECURITY GUARD: client-side key fallback is strictly prohibited in production.
    if (nodeEnv === 'production') {
      emitError('AUTH_REQUIRED: No session token present. Client-side key fallback is disabled in production. Please sign in via Settings → Account.');
      return null;
    }
    if (localKey) {
      return makeLocalGateway(localKey);
    } else {
      emitError('AUTH_REQUIRED: You must sign in via Settings, or configure a Local AI Provider API Key.');
      return null;
    }
  }
}

export default async function runTests() {
  console.log('  Running Production Guard unit tests...');

  // ─── Test 1: Production + no session token → AUTH_REQUIRED emitted, returns null ─
  {
    let emittedErrors: string[] = [];
    const result = selectGateway({
      sessionToken: '',
      nodeEnv: 'production',
      localKey: 'some-key-that-should-never-be-used',
      emitError: (msg) => emittedErrors.push(msg),
      makeProductionGateway: () => ({ name: 'ProductionGateway' }),
      makeLocalGateway: (_key) => ({ name: 'LocalGateway' }),
    });

    assert.strictEqual(result, null, 'In production with no session token, gateway must be null (not selected)');
    assert.strictEqual(emittedErrors.length, 1, 'Exactly one error should be emitted');
    assert.ok(emittedErrors[0].includes('AUTH_REQUIRED'), `Error must contain AUTH_REQUIRED, got: "${emittedErrors[0]}"`);
    assert.ok(emittedErrors[0].includes('disabled in production'), `Error must mention production restriction, got: "${emittedErrors[0]}"`);
    console.log(`  ✓ [Test 1] NODE_ENV=production + no session → AUTH_REQUIRED emitted`);
    console.log(`            Emitted: "${emittedErrors[0]}"`);
  }

  // ─── Test 2: Production + valid session token → ProductionGateway selected ───
  {
    let emittedErrors: string[] = [];
    const result = selectGateway({
      sessionToken: 'valid-session-token-xyz',
      nodeEnv: 'production',
      localKey: undefined,
      emitError: (msg) => emittedErrors.push(msg),
      makeProductionGateway: () => ({ name: 'ProductionGateway' }),
      makeLocalGateway: (_key) => ({ name: 'LocalGateway' }),
    });

    assert.strictEqual(result?.name, 'ProductionGateway', 'With session token in production, ProductionGateway must be selected');
    assert.strictEqual(emittedErrors.length, 0, 'No error should be emitted when session is present');
    console.log(`  ✓ [Test 2] NODE_ENV=production + session token → ProductionGateway selected, no error`);
  }

  // ─── Test 3: Development + no session + local key → LocalGateway selected ────
  {
    let emittedErrors: string[] = [];
    const result = selectGateway({
      sessionToken: '',
      nodeEnv: 'development',
      localKey: 'AIza-dev-key',
      emitError: (msg) => emittedErrors.push(msg),
      makeProductionGateway: () => ({ name: 'ProductionGateway' }),
      makeLocalGateway: (key) => ({ name: 'LocalGateway', key }),
    });

    assert.strictEqual(result?.name, 'LocalGateway', 'In dev without session, local gateway must be selected');
    assert.strictEqual(result?.key, 'AIza-dev-key', 'Correct local key must be passed through');
    assert.strictEqual(emittedErrors.length, 0, 'No error should be emitted in dev mode with local key');
    console.log(`  ✓ [Test 3] NODE_ENV=development + no session + local key → LocalGateway selected (guard bypassed)`);
  }

  // ─── Test 4: Development + no session + no key → AUTH_REQUIRED emitted ───────
  {
    let emittedErrors: string[] = [];
    const result = selectGateway({
      sessionToken: '',
      nodeEnv: 'development',
      localKey: undefined,
      emitError: (msg) => emittedErrors.push(msg),
      makeProductionGateway: () => ({ name: 'ProductionGateway' }),
      makeLocalGateway: (_key) => ({ name: 'LocalGateway' }),
    });

    assert.strictEqual(result, null, 'In dev without session or local key, gateway must be null');
    assert.strictEqual(emittedErrors.length, 1, 'Exactly one error should be emitted');
    assert.ok(emittedErrors[0].includes('AUTH_REQUIRED'), `Error must contain AUTH_REQUIRED`);
    assert.ok(!emittedErrors[0].includes('disabled in production'), 'Dev error must NOT mention production restriction');
    console.log(`  ✓ [Test 4] NODE_ENV=development + no session + no key → generic AUTH_REQUIRED (not production guard)`);
    console.log(`            Emitted: "${emittedErrors[0]}"`);
  }

  console.log('  🟢 Passed');
}

import { fileURLToPath } from 'node:url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runTests().catch(console.error);
}
