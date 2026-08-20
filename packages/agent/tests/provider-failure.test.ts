import { MockAIGateway } from '../src/models/mock-gateway';
import { runAgentLoop } from '../src/orchestrator';
import { AgentStateMachine } from '../src/state-machine';
import { classifyProviderError } from '../src/models/error-classifier';
import { ProviderError } from '@peep/shared';

function runTest(name: string, fn: () => void | Promise<void>): void {
  const prefix = `[Test] ${name}`;
  try {
    const result = fn();
    if (result && typeof (result as any).then === 'function') {
      (result as any).then(
        () => console.log(`  ✓ ${prefix}`),
        (err: unknown) => { console.error(`  ✗ ${prefix}:`, err); process.exitCode = 1; }
      );
    } else {
      console.log(`  ✓ ${prefix}`);
    }
  } catch (err) {
    console.error(`  ✗ ${prefix}:`, err);
    process.exitCode = 1;
  }
}

function assert(condition: boolean, msg: string): void {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

console.log('\nRunning Provider Failure Handling unit tests...');
console.log('--------------------------------------------------');

// 1. Classifier tests
runTest('classifyProviderError - Network Failure is retryable', () => {
  const err = classifyProviderError(new Error('fetch failed'));
  assert(err instanceof ProviderError, 'Should be ProviderError');
  assert(err.code === 'NETWORK_FAILURE', 'Should map to NETWORK_FAILURE');
  assert(err.retryable === true, 'Should be retryable');
  assert(err.retryAfterMs === 2000, 'Should have 2000ms backoff');
});

runTest('classifyProviderError - 429 Rate Limit is retryable', () => {
  const err = classifyProviderError(new Error('status: 429 rate limit exceeded'));
  assert(err.code === 'RATE_LIMIT_EXCEEDED', 'Should map to RATE_LIMIT_EXCEEDED');
  assert(err.retryable === true, 'Should be retryable');
  assert(err.retryAfterMs === 5000, 'Should have 5000ms backoff');
});

runTest('classifyProviderError - Unauthorized is NOT retryable', () => {
  const err = classifyProviderError({ code: 'UNAUTHORIZED', message: 'Auth failed' });
  assert(err.code === 'UNAUTHORIZED', 'Should map to UNAUTHORIZED');
  assert(err.retryable === false, 'Should not be retryable');
});

// 2. Retry Logic Tests using runAgentLoop
class FlakyGateway extends MockAIGateway {
  public attempts = 0;
  public failOnAttempt = 1;
  public emitPartialBeforeFail = false;

  async *stream(request: any, options: any): AsyncIterable<any> {
    this.attempts++;
    if (this.attempts <= this.failOnAttempt) {
      if (this.emitPartialBeforeFail) {
        yield { type: 'delta', content: 'Partial content...' };
      }
      throw classifyProviderError(new Error('fetch failed'), 'synkro');
    }
    
    // Succeed on subsequent attempts
    yield { type: 'delta', content: 'Success content.' };
    yield { type: 'done' };
  }
}

const mockExecutor = {
  execute: async () => 'done'
};

runTest('runAgentLoop - Retries on retryable error', async () => {
  const gateway = new FlakyGateway();
  gateway.failOnAttempt = 2; // Will fail twice, succeed on 3rd
  
  let deltaCount = 0;
  let statusMessages: string[] = [];

  const callbacks = {
    onStatus: (msg: string) => statusMessages.push(msg),
    onDelta: (text: string) => deltaCount++,
    onError: () => {},
    onDone: () => {}
  };

  await runAgentLoop(
    { capabilityTier: 'fast', sessionToken: 'token', gateway },
    'system',
    [{ role: 'user', content: 'hello' }],
    mockExecutor,
    callbacks,
    new AbortController().signal
  );

  assert(gateway.attempts === 3, `Expected 3 attempts, got ${gateway.attempts}`);
  // Initial thinking + 2 retry status messages = 3 status messages total
  assert(statusMessages.length === 3, `Expected 3 status messages, got ${statusMessages.length}`);
  assert(statusMessages[1].includes('Retrying'), 'Should emit retrying status');
});

runTest('runAgentLoop - Stream starts -> partial content emitted -> provider fails -> NO retry', async () => {
  const gateway = new FlakyGateway();
  gateway.failOnAttempt = 1;
  gateway.emitPartialBeforeFail = true;

  const sm = new AgentStateMachine();
  
  let emittedDeltas: string[] = [];
  const callbacks = {
    onStatus: () => {},
    onDelta: (text: string) => emittedDeltas.push(text),
    onError: () => {},
    onDone: () => {},
    onPhaseChange: (phase: import('@peep/shared').AgentPhase) => sm.transition(phase)
  };

  // AgentService transitions to initializing before calling runAgentLoop
  sm.transition('initializing');
  try {
    await runAgentLoop(
      { capabilityTier: 'fast', sessionToken: 'token', gateway },
      'system',
      [{ role: 'user', content: 'hello' }],
      mockExecutor,
      callbacks,
      new AbortController().signal
    );
    throw new Error('Expected runAgentLoop to throw');
  } catch (err: any) {
    console.log('Caught err:', err);
    assert(err.code === 'NETWORK_FAILURE', `Should propagate NETWORK_FAILURE, got ${err.code || err.message}`);
    assert(gateway.attempts === 1, `Expected exactly 1 attempt since partial content was emitted, got ${gateway.attempts}`);
    
    // Check partial content was preserved (emitted)
    const combinedDeltas = emittedDeltas.join('');
    assert(combinedDeltas.includes('Partial content...'), 'Partial content should be emitted');
  }
  
  // Explicitly reset the state machine like AgentService does in finally block
  sm.reset();
  assert(sm.phase === 'idle', 'Phase should reset to idle');
});
