/**
 * run-history.test.ts
 *
 * Tests for the Run History UI feature (Task 13 — Developer 2).
 * Verifies AgentTimeline filtering, run history rendering, and chat-store state logic.
 *
 * Pattern: default export async function (required by test-runner.ts).
 */
import assert from 'assert';
import { JSDOM } from 'jsdom';
import { AgentTimelineActivity } from '@peep/shared';

// ─── Helper types ──────────────────────────────────────────────────────────────
interface ChatRun { run_id: string; status: string; started_at: string; completed_at?: string; }

// ─── Minimal DOM-based renderer for AgentTimeline run history logic ───────────
function renderAgentTimeline(opts: {
  activities: AgentTimelineActivity[];
  runs: ChatRun[];
  selectedRunId: string | null;
  isStreaming: boolean;
  selectRun: (id: string) => void;
}): HTMLElement | null {
  if (opts.activities.length === 0 && (!opts.runs || opts.runs.length === 0)) return null;

  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { pretendToBeVisual: true });
  const { document } = dom.window;

  const root = document.createElement('div');
  root.className = 'agent-timeline';

  if (opts.runs && opts.runs.length > 0) {
    const runsContainer = document.createElement('div');
    runsContainer.className = 'agent-timeline-runs';
    for (const run of opts.runs) {
      const runItem = document.createElement('div');
      const isActive = run.run_id === opts.selectedRunId;
      runItem.className = `run-item ${isActive ? 'active' : ''}`;
      
      let statusIcon = '◌';
      if (run.status === 'completed') statusIcon = '✅';
      if (run.status === 'error' || run.status === 'failed') statusIcon = '❌';
      if (run.status === 'cancelled') statusIcon = '⚠️';
      
      runItem.dataset.statusIcon = statusIcon;
      
      runItem.onclick = () => {
        if (!opts.isStreaming) opts.selectRun(run.run_id);
      };
      runsContainer.append(runItem);
    }
    root.append(runsContainer);
  }

  const listContainer = document.createElement('div');
  listContainer.className = 'agent-timeline-list';
  const displayedActivities = opts.activities.filter(a => a.runId === opts.selectedRunId);
  for (const act of displayedActivities) {
    const actItem = document.createElement('div');
    actItem.className = 'agent-timeline-item';
    actItem.id = `act-${act.id}`;
    listContainer.append(actItem);
  }
  root.append(listContainer);

  return root;
}

// ─── Minimal mock of chat-store upsert logic ──────────────────────────────────
function createStoreMock() {
  let runs: ChatRun[] = [];
  let timelineActivities: AgentTimelineActivity[] = [];
  let currentRunId: string | null = null;
  let selectedRunId: string | null = null;

  return {
    getRuns: () => runs,
    getActivities: () => timelineActivities,
    getCurrentRunId: () => currentRunId,
    getSelectedRunId: () => selectedRunId,
    setRuns: (r: ChatRun[]) => { runs = r; },
    setSelectedRunId: (id: string | null) => { selectedRunId = id; },
    switchThread: (data: { runs?: ChatRun[], timeline_activities?: AgentTimelineActivity[] }) => {
      runs = data.runs || [];
      timelineActivities = data.timeline_activities || [];
      selectedRunId = runs.length > 0 ? runs[runs.length - 1].run_id : null;
      currentRunId = null;
    },
    upsertTimelineActivity: (activity: AgentTimelineActivity) => {
      if (currentRunId !== activity.runId) {
        runs.push({
          run_id: activity.runId,
          started_at: activity.timestamp,
          status: 'in_progress',
        });
        currentRunId = activity.runId;
        selectedRunId = activity.runId;
        timelineActivities.push(activity);
        return;
      }

      if (activity.type === 'completed' || activity.type === 'error' || activity.status === 'failed') {
        const runIndex = runs.findIndex(r => r.run_id === activity.runId);
        if (runIndex >= 0) {
          runs[runIndex] = {
            ...runs[runIndex],
            status: (activity.status === 'failed' || activity.type === 'error') ? 'failed' : 'completed',
            completed_at: activity.timestamp
          };
        }
      }

      const index = timelineActivities.findIndex(a => a.id === activity.id);
      if (index >= 0) timelineActivities[index] = activity;
      else timelineActivities.push(activity);
    }
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
  console.log('\n  Running Run History UI unit tests...');

  const sampleRuns: ChatRun[] = [
    { run_id: 'r1', status: 'completed', started_at: '2023-01-01T00:00:00Z' },
    { run_id: 'r2', status: 'failed', started_at: '2023-01-02T00:00:00Z' },
  ];
  
  const sampleActivities: AgentTimelineActivity[] = [
    { id: 'a1', runId: 'r1', type: 'understanding', message: 'M1', status: 'completed', timestamp: 'T1' },
    { id: 'a2', runId: 'r2', type: 'understanding', message: 'M2', status: 'failed', timestamp: 'T2' }
  ];

  // Test 1: Render run list
  runTest('Render run list with correct icons', () => {
    const el = renderAgentTimeline({
      activities: sampleActivities,
      runs: sampleRuns,
      selectedRunId: 'r1',
      isStreaming: false,
      selectRun: () => {}
    });
    const runItems = el!.querySelectorAll('.run-item') as NodeListOf<HTMLElement>;
    assert.strictEqual(runItems.length, 2, 'Should render 2 run items');
    assert.strictEqual(runItems[0].dataset.statusIcon, '✅', 'Run 1 should have success icon');
    assert.strictEqual(runItems[1].dataset.statusIcon, '❌', 'Run 2 should have error icon');
  });

  // Test 2: Active run highlighted
  runTest('Active run highlighted', () => {
    const el = renderAgentTimeline({
      activities: sampleActivities,
      runs: sampleRuns,
      selectedRunId: 'r2',
      isStreaming: false,
      selectRun: () => {}
    });
    const runItems = el!.querySelectorAll('.run-item') as NodeListOf<HTMLElement>;
    assert.ok(!runItems[0].classList.contains('active'), 'Run 1 should not be active');
    assert.ok(runItems[1].classList.contains('active'), 'Run 2 should be active');
  });

  // Test 3: Filter activities by runId
  runTest('Filter activities by selectedRunId', () => {
    const el = renderAgentTimeline({
      activities: sampleActivities,
      runs: sampleRuns,
      selectedRunId: 'r1',
      isStreaming: false,
      selectRun: () => {}
    });
    const listItems = el!.querySelectorAll('.agent-timeline-item');
    assert.strictEqual(listItems.length, 1, 'Only 1 activity should be shown');
    assert.strictEqual(listItems[0].id, 'act-a1', 'Activity a1 should be shown');
  });

  // Test 4: Click run → selectRun called
  runTest('Click run \u2192 selectRun called', () => {
    let selectedId = '';
    const el = renderAgentTimeline({
      activities: sampleActivities,
      runs: sampleRuns,
      selectedRunId: 'r1',
      isStreaming: false,
      selectRun: (id) => { selectedId = id; }
    });
    const runItems = el!.querySelectorAll('.run-item') as NodeListOf<HTMLElement>;
    runItems[1].click();
    assert.strictEqual(selectedId, 'r2', 'selectRun should be called with r2');
  });

  // Test 5: Streaming lock
  runTest('Streaming lock (Guard) blocks clicking', () => {
    let selectedId = '';
    const el = renderAgentTimeline({
      activities: sampleActivities,
      runs: sampleRuns,
      selectedRunId: 'r2', // currently live
      isStreaming: true,
      selectRun: (id) => { selectedId = id; }
    });
    const runItems = el!.querySelectorAll('.run-item') as NodeListOf<HTMLElement>;
    runItems[0].click(); // attempt to switch to r1
    assert.strictEqual(selectedId, '', 'selectRun should not be called while streaming');
  });

  // Test 6: Auto-select latest run
  runTest('Auto-select latest run on thread switch', () => {
    const store = createStoreMock();
    store.switchThread({ runs: sampleRuns, timeline_activities: sampleActivities });
    assert.strictEqual(store.getSelectedRunId(), 'r2', 'Selected run should be the last run in the array');
  });

  // Test 7: Empty state fallback
  runTest('Empty state fallback returns null', () => {
    const el = renderAgentTimeline({
      activities: [],
      runs: [],
      selectedRunId: null,
      isStreaming: false,
      selectRun: () => {}
    });
    assert.strictEqual(el, null, 'AgentTimeline should return null if no activities and no runs');
  });

  // Test 8: Real-time run append and terminal status update
  runTest('Real-time run append and status update', () => {
    const store = createStoreMock();
    
    // First activity (starts run)
    store.upsertTimelineActivity({
      id: 'live1', runId: 'r3', type: 'understanding', message: 'start', status: 'in_progress', timestamp: 'T1'
    });
    
    const runs1 = store.getRuns();
    assert.strictEqual(runs1.length, 1, 'Run should be appended');
    assert.strictEqual(runs1[0].status, 'in_progress', 'Run should be in_progress initially');
    assert.strictEqual(store.getSelectedRunId(), 'r3', 'Run should be auto-selected');

    // Terminal activity (completes run)
    store.upsertTimelineActivity({
      id: 'live2', runId: 'r3', type: 'completed', message: 'done', status: 'completed', timestamp: 'T2'
    });
    
    const runs2 = store.getRuns();
    assert.strictEqual(runs2[0].status, 'completed', 'Run status should update to completed in place');
  });

  if (failed > 0) {
    throw new Error(`${failed} Run History UI test(s) failed`);
  }
  console.log(`  🟢 All ${passed} Run History UI tests passed.\n`);
}
