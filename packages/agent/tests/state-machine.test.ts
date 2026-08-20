/**
 * Task 15 — AgentStateMachine unit tests
 *
 * Covers:
 *  1. Valid full conversation lifecycle (no tools)
 *  2. Tool-path lifecycle
 *  3. Cancellation
 *  4. Error path
 *  5. Invalid transition guard
 *  6. Re-entrancy guard (already-in-target is a no-op)
 *  7. Phase callbacks fire on every valid transition
 *  8. reset() returns to idle from any terminal state
 *  9. reset() from idle is a no-op
 * 10. done → idle prevents double-idle
 */
import { AgentStateMachine } from '../src/state-machine';

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

function assertThrows(fn: () => void, contains: string): void {
  try {
    fn();
    throw new Error('Expected an error to be thrown, but none was.');
  } catch (err: any) {
    if (!err.message.includes(contains)) {
      throw new Error(`Expected error containing "${contains}", got: "${err.message}"`);
    }
  }
}

console.log('\nRunning AgentStateMachine unit tests...');
console.log('-------------------------------------------');

// Test 1 — Valid full lifecycle (no tools)
runTest('Valid lifecycle: idle → initializing → thinking → done → idle', () => {
  const phases: string[] = [];
  const sm = new AgentStateMachine((p) => phases.push(p));

  assert(sm.phase === 'idle', 'starts idle');
  sm.transition('initializing');
  sm.transition('thinking');
  sm.transition('done');
  sm.reset(); // drives done → idle

  assert(phases.join(',') === 'initializing,thinking,done,idle',
    `expected lifecycle, got: ${phases.join(',')}`);
});

// Test 2 — Tool-path lifecycle
runTest('Tool-path lifecycle: thinking → tool_executing → thinking → summarizing → done', () => {
  const phases: string[] = [];
  const sm = new AgentStateMachine((p) => phases.push(p));

  sm.transition('initializing');
  sm.transition('thinking');
  sm.transition('tool_executing');
  sm.transition('thinking');    // back to thinking for next LLM call
  sm.transition('summarizing');
  sm.transition('done');
  sm.reset();

  const expected = 'initializing,thinking,tool_executing,thinking,summarizing,done,idle';
  assert(phases.join(',') === expected, `got: ${phases.join(',')}`);
});

// Test 3 — Cancellation
runTest('Cancellation: thinking → cancelled → idle', () => {
  const phases: string[] = [];
  const sm = new AgentStateMachine((p) => phases.push(p));

  sm.transition('initializing');
  sm.transition('thinking');
  sm.transition('cancelled');
  sm.reset();

  assert(phases.join(',') === 'initializing,thinking,cancelled,idle',
    `got: ${phases.join(',')}`);
});

// Test 4 — Error path
runTest('Error path: tool_executing → error → idle', () => {
  const phases: string[] = [];
  const sm = new AgentStateMachine((p) => phases.push(p));

  sm.transition('initializing');
  sm.transition('thinking');
  sm.transition('tool_executing');
  sm.transition('error');
  sm.reset();

  assert(phases.join(',') === 'initializing,thinking,tool_executing,error,idle',
    `got: ${phases.join(',')}`);
});

// Test 5 — Invalid transition guard
runTest('Invalid transition throws correct message', () => {
  const sm = new AgentStateMachine();

  assertThrows(
    () => sm.transition('tool_executing'),
    'Invalid transition: idle → tool_executing'
  );

  sm.transition('initializing');
  assertThrows(
    () => sm.transition('done'),
    'Invalid transition: initializing → done'
  );
});

// Test 6 — Re-entrancy (idempotent no-op for same phase)
runTest('Re-entrancy: transitioning to same phase is a no-op', () => {
  const phases: string[] = [];
  const sm = new AgentStateMachine((p) => phases.push(p));

  sm.transition('initializing');
  sm.transition('thinking');
  sm.transition('thinking'); // same phase, should be no-op

  // Only 2 callbacks (not 3)
  assert(phases.length === 2, `expected 2 callbacks, got ${phases.length}`);
  assert(sm.phase === 'thinking', 'still in thinking');
});

// Test 7 — Phase callbacks fire on every valid transition
runTest('Phase callbacks fire for every transition', () => {
  let count = 0;
  const sm = new AgentStateMachine(() => count++);

  sm.transition('initializing');
  sm.transition('thinking');
  sm.transition('done');
  sm.reset(); // fires 'idle'

  assert(count === 4, `expected 4 callbacks, got ${count}`);
});

// Test 8 — reset() from any non-terminal phase
runTest('reset() from tool_executing safely returns to idle', () => {
  const phases: string[] = [];
  const sm = new AgentStateMachine((p) => phases.push(p));

  sm.transition('initializing');
  sm.transition('thinking');
  sm.transition('tool_executing');
  sm.reset(); // forced reset mid-run

  assert(sm.phase === 'idle', 'should be idle');
  assert(phases[phases.length - 1] === 'idle', 'last callback should be idle');
});

// Test 9 — reset() from idle is a no-op
runTest('reset() from idle is a no-op (no callback)', () => {
  let count = 0;
  const sm = new AgentStateMachine(() => count++);

  assert(sm.phase === 'idle', 'starts idle');
  sm.reset(); // should do nothing

  assert(count === 0, `expected 0 callbacks, got ${count}`);
  assert(sm.phase === 'idle', 'remains idle');
});

// Test 10 — done → idle does not emit a second idle
runTest('After reset() from done, further reset() is a no-op', () => {
  const phases: string[] = [];
  const sm = new AgentStateMachine((p) => phases.push(p));

  sm.transition('initializing');
  sm.transition('thinking');
  sm.transition('done');
  sm.reset(); // idle — 4 callbacks
  sm.reset(); // already idle — no-op

  assert(phases.length === 4, `expected exactly 4 callbacks, got ${phases.length}`);
  assert(phases[phases.length - 1] === 'idle', 'last is idle');
});

console.log('-------------------------------------------');
console.log('🟢 All AgentStateMachine unit tests complete.\n');
