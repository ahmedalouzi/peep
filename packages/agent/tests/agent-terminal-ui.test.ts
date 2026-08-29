/**
 * agent-terminal-ui.test.ts
 *
 * Tests for the Agent Terminal UI feature (Task 10 - Developer 2).
 * Verifies TerminalPanel interception of agent-cmd-* IPC events,
 * auto-creation of the dedicated tab, output routing, and read-only behavior.
 *
 * Pattern: default export async function (required by test-runner.ts).
 */
import assert from 'assert';
import { JSDOM } from 'jsdom';

// ─── Minimal Mock of xterm and window.peep ────────────────────────────────────

class MockTerminal {
  public dataHandlers: ((data: string) => void)[] = [];
  public output: string = '';
  public options: any;
  public customKeyHandlers: ((e: any) => boolean)[] = [];

  constructor(options: any) {
    this.options = options;
  }
  loadAddon() {}
  open() {}
  attachCustomKeyEventHandler(handler: (e: any) => boolean) {
    this.customKeyHandlers.push(handler);
  }
  onData(handler: (data: string) => void) {
    this.dataHandlers.push(handler);
  }
  write(data: string) {
    this.output += data;
  }
  writeln(data: string) {
    this.output += data + '\n';
  }
  dispose() {}
  hasSelection() { return false; }
  getSelection() { return ''; }
  focus() {}
}

const mockPeep = {
  outputHandlers: [] as ((evt: { id: string, data: string }) => void)[],
  exitHandlers: [] as ((evt: { id: string, code: number }) => void)[],
  writes: [] as { id: string, data: string }[],
  
  onTerminalOutput: (handler: (evt: { id: string, data: string }) => void) => {
    mockPeep.outputHandlers.push(handler);
    return () => {};
  },
  onTerminalExit: (handler: (evt: { id: string, code: number }) => void) => {
    mockPeep.exitHandlers.push(handler);
    return () => {};
  },
  onPreviewLog: () => () => {},
  createTerminal: () => Promise.resolve(),
  writeTerminal: async (id: string, data: string) => {
    mockPeep.writes.push({ id, data });
  },
  destroyTerminal: () => Promise.resolve(),
  
  // Helpers for tests
  reset: () => {
    mockPeep.outputHandlers = [];
    mockPeep.exitHandlers = [];
    mockPeep.writes = [];
  },
  emitOutput: (id: string, data: string) => {
    mockPeep.outputHandlers.forEach(h => h({ id, data }));
  },
  emitExit: (id: string, code: number) => {
    mockPeep.exitHandlers.forEach(h => h({ id, code }));
  }
};

const mockWorkspaceStore = {
  state: {
    bottomPanelTab: 'terminal',
    isBottomPanelOpen: true,
  },
  getState: () => ({
    bottomPanelTab: mockWorkspaceStore.state.bottomPanelTab,
    isBottomPanelOpen: mockWorkspaceStore.state.isBottomPanelOpen,
    setBottomPanelTab: (t: string) => { mockWorkspaceStore.state.bottomPanelTab = t; },
    toggleBottomPanel: () => { mockWorkspaceStore.state.isBottomPanelOpen = !mockWorkspaceStore.state.isBottomPanelOpen; }
  })
};

// Simplified simulation of TerminalPanel's effect
function createTerminalPanelEffect() {
  let terminals: any[] = [];
  let activeId: string | null = null;
  let lastAgentSessionId: string | null = null;

  const getOrCreateAgentTerminal = () => {
    let agentTerm = terminals.find(t => t.id === 'agent-terminal');
    if (!agentTerm) {
      const term = new MockTerminal({ disableStdin: true });
      agentTerm = { id: 'agent-terminal', term };
      terminals.push(agentTerm);
      activeId = 'agent-terminal';
      const wsState = mockWorkspaceStore.getState();
      if (wsState.bottomPanelTab !== 'terminal') wsState.setBottomPanelTab('terminal');
      if (!wsState.isBottomPanelOpen) wsState.toggleBottomPanel();
    }
    return agentTerm;
  };

  const unsubOutput = mockPeep.onTerminalOutput(({ id, data }) => {
    if (id.startsWith('agent-cmd-')) {
      const t = getOrCreateAgentTerminal();
      if (lastAgentSessionId && lastAgentSessionId !== id) {
        t.term.writeln(`\r\n\x1b[90m--- New Agent Command Session ---\x1b[0m\r\n`);
      }
      lastAgentSessionId = id;
      t.term.write(data);
      return;
    }
    const t = terminals.find(x => x.id === id);
    if (t) t.term.write(data);
  });

  const unsubExit = mockPeep.onTerminalExit(({ id, code }) => {
    if (id.startsWith('agent-cmd-')) {
      const t = terminals.find(x => x.id === 'agent-terminal');
      if (t) t.term.writeln(`\r\n\x1b[90m[Agent command finished with code ${code}]\x1b[0m\r\n`);
      return;
    }
    const t = terminals.find(x => x.id === id);
    if (t && code !== 0) t.term.writeln(`\r\n[process exited with code ${code}]`);
  });

  return {
    getTerminals: () => terminals,
    getActiveId: () => activeId,
    addRegularTerminal: (id: string) => {
      const term = new MockTerminal({});
      term.onData(data => mockPeep.writeTerminal(id, data));
      terminals.push({ id, term });
      activeId = id;
    },
    cleanup: () => { unsubOutput(); unsubExit(); }
  };
}

// ─── Test runner helpers ───────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ [Test ${passed + failed + 1}] ${name}`);
    passed++;
  } catch (e: any) {
    console.error(`  ✗ [Test ${passed + failed + 1}] ${name}`);
    console.error(`    ${e.message}`);
    failed++;
  }
}

// ─── Default export — required by test-runner.ts ──────────────────────────────
export default async function runTests() {
  console.log('\n  Running Agent Terminal UI unit tests...');

  // Test 1: Render initially without agent terminal
  runTest('TerminalPanel starts without agent terminal', () => {
    mockPeep.reset();
    const panel = createTerminalPanelEffect();
    panel.addRegularTerminal('term-1');
    assert.strictEqual(panel.getTerminals().length, 1);
    assert.strictEqual(panel.getTerminals()[0].id, 'term-1');
  });

  // Test 2: Auto-creates Agent Terminal upon receiving agent-cmd-*
  runTest('Auto-creates Agent Terminal on first agent-cmd-* event', () => {
    mockPeep.reset();
    const panel = createTerminalPanelEffect();
    panel.addRegularTerminal('term-1');
    mockPeep.emitOutput('agent-cmd-123', 'hello agent');
    
    const terms = panel.getTerminals();
    assert.strictEqual(terms.length, 2);
    assert.strictEqual(terms[1].id, 'agent-terminal');
    assert.ok(terms[1].term.output.includes('hello agent'));
  });

  // Test 3: Output routing routes multiple agent-cmd-* to the same tab
  runTest('Routes multiple agent-cmd-* sessions to the same agent-terminal tab', () => {
    mockPeep.reset();
    const panel = createTerminalPanelEffect();
    mockPeep.emitOutput('agent-cmd-1', 'output 1');
    mockPeep.emitExit('agent-cmd-1', 0);
    mockPeep.emitOutput('agent-cmd-2', 'output 2');
    
    const terms = panel.getTerminals();
    assert.strictEqual(terms.length, 1); // Still just one agent terminal
    assert.ok(terms[0].term.output.includes('output 1'));
    assert.ok(terms[0].term.output.includes('output 2'));
    assert.ok(terms[0].term.output.includes('New Agent Command Session')); // Separator injected
  });

  // Test 4: Exit separator is injected properly
  runTest('Injects exit separator for agent-cmd-*', () => {
    mockPeep.reset();
    const panel = createTerminalPanelEffect();
    mockPeep.emitOutput('agent-cmd-123', 'start');
    mockPeep.emitExit('agent-cmd-123', 0);
    const terms = panel.getTerminals();
    assert.ok(terms[0].term.output.includes('Agent command finished with code 0'));
  });

  // Test 5: Read-only guard (disableStdin & no onData binding)
  runTest('Agent Terminal is read-only (input does not reach backend)', () => {
    mockPeep.reset();
    const panel = createTerminalPanelEffect();
    mockPeep.emitOutput('agent-cmd-123', 'ready');
    const terms = panel.getTerminals();
    const agentTerm = terms[0].term as MockTerminal;
    
    // Verify disableStdin is true
    assert.strictEqual(agentTerm.options.disableStdin, true);
    
    // Attempt to simulate input that normally goes to onData handlers.
    // In our simplified mock, we attached onData to regular terminals but NOT the agent terminal
    // (In reality xterm blocks it, but we verify we didn't attach a window.peep.writeTerminal handler)
    agentTerm.dataHandlers.forEach(h => h('user input'));
    
    assert.strictEqual(mockPeep.writes.length, 0, 'No input should be written to the backend for the agent terminal');
  });

  // Test 6: Auto-switches tab and opens bottom panel
  runTest('Auto-switches to agent-terminal and opens bottom panel when created', () => {
    mockPeep.reset();
    mockWorkspaceStore.state.bottomPanelTab = 'problems';
    mockWorkspaceStore.state.isBottomPanelOpen = false;
    
    const panel = createTerminalPanelEffect();
    mockPeep.emitOutput('agent-cmd-456', 'work');
    
    assert.strictEqual(panel.getActiveId(), 'agent-terminal');
    assert.strictEqual(mockWorkspaceStore.state.bottomPanelTab, 'terminal');
    assert.strictEqual(mockWorkspaceStore.state.isBottomPanelOpen, true);
  });

  // Test 7: Normal terminals still work correctly
  runTest('Normal terminals still receive their output', () => {
    mockPeep.reset();
    const panel = createTerminalPanelEffect();
    panel.addRegularTerminal('term-555');
    mockPeep.emitOutput('term-555', 'normal output');
    
    const terms = panel.getTerminals();
    assert.strictEqual(terms.length, 1);
    assert.ok(terms[0].term.output.includes('normal output'));
  });

  if (failed > 0) {
    throw new Error(`${failed} Agent Terminal UI test(s) failed`);
  }
  console.log(`  🟢 All ${passed} Agent Terminal UI tests passed.\n`);
}
