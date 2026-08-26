import { runAgentLoop } from '../src/orchestrator';
import { ProviderError } from '@peep/shared';
import * as assert from 'node:assert';

export default async function runTests() {
  console.log('\nRunning Agent Observability (Phase C) unit tests...');
  console.log('--------------------------------------------------');

  const mockExecutor = { execute: async () => 'success' };
  const mockCallbacks = {
    onStatus: () => {},
    onDelta: () => {},
    onError: () => {},
    onDone: () => {},
  };

  // ─── Test 1: Logger injection — state transitions are recorded ──────────────
  {
    const logCalls: { info: any[], warn: any[], error: any[] } = { info: [], warn: [], error: [] };
    const logger = {
      info:  (msg: string, meta?: any) => logCalls.info.push([msg, meta]),
      warn:  (msg: string, meta?: any) => logCalls.warn.push([msg, meta]),
      error: (msg: string, meta?: any) => logCalls.error.push([msg, meta]),
    };
    const gateway = {
      stream: async function* () {
        yield { type: 'delta', content: 'hello' };
        yield { type: 'done' };
      },
    };

    await runAgentLoop(
      { capabilityTier: 'fast', sessionToken: 'obs-test', gateway: gateway as any, logger },
      'sys', [{ role: 'user', content: 'msg' }], mockExecutor as any, mockCallbacks,
      new AbortController().signal
    );

    const stateTransitions = logCalls.info.filter(c => c[0].startsWith('Agent state transitioned'));
    assert.ok(stateTransitions.length > 0, 'State transitions should be logged via injected logger');
    console.log(`  ✓ [Test 1] Logger injection — ${stateTransitions.length} state transitions recorded`);
  }

  // ─── Test 2: Duration metric — durationMs is logged on completion ───────────
  {
    const logCalls: { info: any[], warn: any[], error: any[] } = { info: [], warn: [], error: [] };
    const logger = {
      info:  (msg: string, meta?: any) => logCalls.info.push([msg, meta]),
      warn:  (msg: string, meta?: any) => logCalls.warn.push([msg, meta]),
      error: (msg: string, meta?: any) => logCalls.error.push([msg, meta]),
    };
    const gateway = {
      stream: async function* () {
        yield { type: 'delta', content: 'world' };
        yield { type: 'done' };
      },
    };

    await runAgentLoop(
      { capabilityTier: 'fast', sessionToken: 'obs-test', gateway: gateway as any, logger },
      'sys', [{ role: 'user', content: 'msg' }], mockExecutor as any, mockCallbacks,
      new AbortController().signal
    );

    const durationLog = logCalls.info.find(c => c[0] === 'Agent run completed');
    assert.ok(durationLog, 'Run duration should be logged');
    assert.ok(typeof durationLog[1]?.durationMs === 'number', `durationMs must be a number, got: ${durationLog?.[1]?.durationMs}`);
    assert.ok(durationLog[1].durationMs >= 0, 'durationMs must be non-negative');
    console.log(`  ✓ [Test 2] Duration metric — durationMs=${durationLog[1].durationMs}ms logged on completion`);
  }

  // ─── Test 3: Token usage source — estimated fallback is labeled correctly ───
  {
    const logCalls: { info: any[], warn: any[], error: any[] } = { info: [], warn: [], error: [] };
    const logger = {
      info:  (msg: string, meta?: any) => logCalls.info.push([msg, meta]),
      warn:  (msg: string, meta?: any) => logCalls.warn.push([msg, meta]),
      error: (msg: string, meta?: any) => logCalls.error.push([msg, meta]),
    };
    // Gateway yields no usage metadata → estimated fallback path
    const gateway = {
      stream: async function* () {
        yield { type: 'delta', content: 'response text' };
        yield { type: 'done' };
      },
    };

    await runAgentLoop(
      { capabilityTier: 'fast', sessionToken: 'obs-test', gateway: gateway as any, logger },
      'sys', [{ role: 'user', content: 'msg' }], mockExecutor as any, mockCallbacks,
      new AbortController().signal
    );

    const estimateLog = logCalls.info.find(c => c[0] === 'Token usage (estimated fallback)');
    assert.ok(estimateLog, 'Estimated token usage should be logged when provider sends no usage metadata');
    assert.ok(typeof estimateLog[1]?.inputTokens === 'number', 'inputTokens must be present');
    assert.ok(typeof estimateLog[1]?.outputTokens === 'number', 'outputTokens must be present');

    // Must NOT be labeled as official metric
    const officialLog = logCalls.info.find(c => c[0] === 'Token usage (official provider metric)');
    assert.ok(!officialLog, 'Must NOT log official metric when provider sends no usage metadata');
    console.log(`  ✓ [Test 3] Token usage source — estimated fallback label confirmed (in=${estimateLog[1].inputTokens}, out=${estimateLog[1].outputTokens}); official metric NOT logged`);
  }

  // ─── Test 4: Token usage source — official metric path ──────────────────────
  {
    const logCalls: { info: any[], warn: any[], error: any[] } = { info: [], warn: [], error: [] };
    const logger = {
      info:  (msg: string, meta?: any) => logCalls.info.push([msg, meta]),
      warn:  (msg: string, meta?: any) => logCalls.warn.push([msg, meta]),
      error: (msg: string, meta?: any) => logCalls.error.push([msg, meta]),
    };
    // Gateway includes official usage metadata in the done event
    const gateway = {
      stream: async function* () {
        yield { type: 'delta', content: 'response' };
        yield { type: 'done', usage: { promptTokens: 42, completionTokens: 17, totalTokens: 59 } };
      },
    };

    await runAgentLoop(
      { capabilityTier: 'fast', sessionToken: 'obs-test', gateway: gateway as any, logger },
      'sys', [{ role: 'user', content: 'msg' }], mockExecutor as any, mockCallbacks,
      new AbortController().signal
    );

    const officialLog = logCalls.info.find(c => c[0] === 'Token usage (official provider metric)');
    assert.ok(officialLog, 'Official metric should be logged when provider sends usage metadata');
    assert.strictEqual(officialLog[1]?.promptTokens, 42, 'promptTokens from provider must be preserved exactly');

    // Must NOT fall back to estimate
    const estimateLog = logCalls.info.find(c => c[0] === 'Token usage (estimated fallback)');
    assert.ok(!estimateLog, 'Must NOT log estimated fallback when official usage metadata is present');
    console.log(`  ✓ [Test 4] Token usage source — official provider metric logged (promptTokens=${officialLog[1].promptTokens}); estimated fallback NOT logged`);
  }

  // ─── Test 5: Retry metrics — warn logged per attempt, error on fatal ─────────
  {
    const logCalls: { info: any[], warn: any[], error: any[] } = { info: [], warn: [], error: [] };
    const logger = {
      info:  (msg: string, meta?: any) => logCalls.info.push([msg, meta]),
      warn:  (msg: string, meta?: any) => logCalls.warn.push([msg, meta]),
      error: (msg: string, meta?: any) => logCalls.error.push([msg, meta]),
    };
    let callCount = 0;
    const gateway = {
      stream: async function* () {
        callCount++;
        if (callCount === 1) {
          throw new ProviderError({ message: 'Rate limited', code: 'rate_limit', retryable: true, retryAfterMs: 5 });
        }
        yield { type: 'delta', content: 'recovered' };
        yield { type: 'done' };
      },
    };

    await runAgentLoop(
      { capabilityTier: 'fast', sessionToken: 'obs-test', gateway: gateway as any, logger },
      'sys', [{ role: 'user', content: 'msg' }], mockExecutor as any, mockCallbacks,
      new AbortController().signal
    );

    const warnLog = logCalls.warn.find(c => typeof c[0] === 'string' && c[0].includes('Provider error (rate_limit)'));
    assert.ok(warnLog, 'Retryable provider error should be logged as warn');
    assert.strictEqual(warnLog[1]?.attempt, 1, 'attempt count should be 1 in metadata');
    assert.strictEqual(warnLog[1]?.error_code, 'rate_limit', 'error_code should be rate_limit');
    // No Sentry-level error should fire — only warn (per-attempt stays local)
    const fatalLog = logCalls.error.find(c => typeof c[0] === 'string' && c[0].includes('fatal'));
    assert.ok(!fatalLog, 'No fatal error log should fire when retry succeeds');
    console.log(`  ✓ [Test 5] Retry metrics — warn logged for attempt 1 (code=rate_limit); no fatal/error logged on successful retry`);
  }

  // ─── Test 6: Fatal error — logger.error fires on non-retryable failure ──────
  {
    const logCalls: { info: any[], warn: any[], error: any[] } = { info: [], warn: [], error: [] };
    // Recording Sentry spy — asserts that addBreadcrumb is called with correct data
    const sentryCalls: any[] = [];
    const sentrySpy = { addBreadcrumb: (bc: any) => sentryCalls.push(bc) };

    const logger = {
      info:  (msg: string, meta?: any) => logCalls.info.push([msg, meta]),
      warn:  (msg: string, meta?: any) => logCalls.warn.push([msg, meta]),
      error: (msg: string, meta?: any) => {
        logCalls.error.push([msg, meta]);
        // Simulate what agent-service.ts does: forward error to Sentry spy
        sentrySpy.addBreadcrumb({ category: 'agent.error', message: msg, level: 'error', data: meta });
      },
    };
    const gateway = {
      stream: async function* () {
        throw new ProviderError({ message: 'Unauthorized', code: 'auth_failed', retryable: false });
      },
    };

    try {
      await runAgentLoop(
        { capabilityTier: 'fast', sessionToken: 'obs-test', gateway: gateway as any, logger },
        'sys', [{ role: 'user', content: 'msg' }], mockExecutor as any, mockCallbacks,
        new AbortController().signal
      );
      assert.fail('Should have thrown');
    } catch (e: any) {
      assert.strictEqual(e.message, 'Unauthorized', 'Error should propagate');
    }

    const fatalLog = logCalls.error.find(c => c[0] === 'Provider fatal error or non-retryable');
    assert.ok(fatalLog, 'Non-retryable error should trigger logger.error');
    assert.strictEqual(fatalLog[1]?.code, 'auth_failed', 'Error code must be present in metadata');

    // Verify Sentry spy received the breadcrumb with correct data
    assert.strictEqual(sentryCalls.length, 1, `Sentry.addBreadcrumb should be called exactly once, got: ${sentryCalls.length}`);
    assert.strictEqual(sentryCalls[0].category, 'agent.error', 'Sentry breadcrumb category must be agent.error');
    assert.strictEqual(sentryCalls[0].level, 'error', 'Sentry breadcrumb level must be error');
    assert.strictEqual(sentryCalls[0].message, 'Provider fatal error or non-retryable', 'Sentry message must match');
    console.log(`  ✓ [Test 6] Fatal error — logger.error fires (code=auth_failed), Sentry.addBreadcrumb called once with {category:'agent.error', level:'error'}`);
  }

  console.log('--------------------------------------------------');
  console.log('🟢 All Agent Observability tests complete.\n');
}
