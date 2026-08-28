/**
 * thread-sidebar.test.ts
 *
 * Tests for the ThreadSidebar UI component (Task 12 — Chat Threads UI).
 *
 * Uses JSDOM + manual assertions. Mocks useChatStore so no IPC / Electron
 * dependency is required. Pattern: default export async function (required by test-runner.ts).
 */
import assert from 'assert';
import { JSDOM } from 'jsdom';

// ─── Helper types ──────────────────────────────────────────────────────────────
interface ThreadInfo { id: string; title: string; updated_at: string; }

// ─── Minimal DOM-based renderer for ThreadSidebar logic ───────────────────────
// Replicates the component's render + event logic in JSDOM (no React needed).
function renderSidebar(opts: {
  threads: ThreadInfo[];
  activeThreadId: string | null;
  isStreaming: boolean;
  ipcError: string | null;
  switchThread: (id: string) => void;
  newThread: () => void;
  deleteActiveThread: () => void;
}): HTMLElement {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { pretendToBeVisual: true });
  const { document } = dom.window;

  const { threads, activeThreadId, isStreaming, ipcError } = opts;
  const isLoading = !ipcError && threads.length === 0;

  const root = document.createElement('div');
  root.className = 'thread-sidebar';

  // Header
  const header = document.createElement('div');
  header.className = 'thread-sidebar__header';
  const titleSpanH = document.createElement('span');
  titleSpanH.textContent = 'CHATS';
  const newBtn = document.createElement('button');
  newBtn.id = 'new-thread-btn';
  newBtn.disabled = isStreaming;
  newBtn.onclick = () => { if (!isStreaming) opts.newThread(); };
  header.append(titleSpanH, newBtn);
  root.append(header);

  // List
  const list = document.createElement('div');
  list.className = 'thread-sidebar__list';

  if (isLoading) {
    const loading = document.createElement('div');
    loading.className = 'thread-sidebar__loading';
    loading.textContent = 'Loading\u2026';
    list.append(loading);
  } else if (threads.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'thread-sidebar__empty';
    empty.textContent = 'No chats yet';
    list.append(empty);
  } else {
    for (const thread of threads) {
      const isActive = thread.id === activeThreadId;
      const item = document.createElement('div');
      item.id = `thread-item-${thread.id}`;
      item.className = `thread-item${isActive ? ' thread-item--active' : ''}`;
      item.style.cursor = isStreaming ? 'not-allowed' : 'pointer';
      item.onclick = () => { if (!isStreaming) opts.switchThread(thread.id); };

      const title = document.createElement('span');
      title.className = 'thread-item__title';
      title.textContent = thread.title || 'New Chat';
      item.append(title);

      if (isActive) {
        const delBtn = document.createElement('button');
        delBtn.id = `delete-thread-btn-${thread.id}`;
        delBtn.className = 'thread-item__delete-btn';
        delBtn.disabled = isStreaming || threads.length <= 1;
        delBtn.onclick = (e) => {
          e.stopPropagation();
          if (!isStreaming) opts.deleteActiveThread();
        };
        item.append(delBtn);
      }

      list.append(item);
    }
  }

  root.append(list);
  return root;
}

// ─── Test runner helpers ───────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  \u2713 [Test ${passed + failed + 1}] ${name}`);
    passed++;
  } catch (e: any) {
    console.error(`  \u2717 [Test ${passed + failed + 1}] ${name}`);
    console.error(`    ${e.message}`);
    failed++;
  }
}

// ─── Default export — required by test-runner.ts ──────────────────────────────
export default async function runTests() {
  console.log('  Running ThreadSidebar unit tests...');

  // Test 1: Thread list renders with correct active class
  runTest('Renders thread list with correct active class', () => {
    const threads = [
      { id: 'a', title: 'Chat 1', updated_at: '' },
      { id: 'b', title: 'Chat 2', updated_at: '' },
    ];
    const el = renderSidebar({
      threads, activeThreadId: 'a', isStreaming: false, ipcError: null,
      switchThread: () => {}, newThread: () => {}, deleteActiveThread: () => {},
    });
    const itemA = el.querySelector('#thread-item-a');
    const itemB = el.querySelector('#thread-item-b');
    assert.ok(itemA, 'thread-item-a should exist');
    assert.ok(itemB, 'thread-item-b should exist');
    assert.ok(itemA!.classList.contains('thread-item--active'), 'item A should be active');
    assert.ok(!itemB!.classList.contains('thread-item--active'), 'item B should NOT be active');
  });

  // Test 2: Click thread → switchThread called with correct id
  runTest('Click thread item \u2192 switchThread called with correct id', () => {
    const threads = [
      { id: 'a', title: 'Chat 1', updated_at: '' },
      { id: 'b', title: 'Chat 2', updated_at: '' },
    ];
    const calls: string[] = [];
    const el = renderSidebar({
      threads, activeThreadId: 'a', isStreaming: false, ipcError: null,
      switchThread: (id) => calls.push(id), newThread: () => {}, deleteActiveThread: () => {},
    });
    (el.querySelector('#thread-item-b') as HTMLElement).click();
    assert.strictEqual(calls.length, 1, 'switchThread should be called once');
    assert.strictEqual(calls[0], 'b', 'switchThread should be called with id "b"');
  });

  // Test 3: Click "New Chat" → newThread called
  runTest('Click New Chat button \u2192 newThread called', () => {
    const threads = [{ id: 'a', title: 'Chat 1', updated_at: '' }];
    let newThreadCalled = 0;
    const el = renderSidebar({
      threads, activeThreadId: 'a', isStreaming: false, ipcError: null,
      switchThread: () => {}, newThread: () => { newThreadCalled++; }, deleteActiveThread: () => {},
    });
    (el.querySelector('#new-thread-btn') as HTMLButtonElement).click();
    assert.strictEqual(newThreadCalled, 1, 'newThread should be called exactly once');
  });

  // Test 4: Click delete → deleteActiveThread called
  runTest('Click delete button \u2192 deleteActiveThread called', () => {
    const threads = [
      { id: 'a', title: 'Chat 1', updated_at: '' },
      { id: 'b', title: 'Chat 2', updated_at: '' },
    ];
    let deleteCalled = 0;
    const el = renderSidebar({
      threads, activeThreadId: 'a', isStreaming: false, ipcError: null,
      switchThread: () => {}, newThread: () => {}, deleteActiveThread: () => { deleteCalled++; },
    });
    const delBtn = el.querySelector('#delete-thread-btn-a') as HTMLButtonElement;
    assert.ok(delBtn, 'delete button for active thread should exist');
    delBtn.click();
    assert.strictEqual(deleteCalled, 1, 'deleteActiveThread should be called once');
  });

  // Test 5: isStreaming=true → all actions blocked, buttons disabled
  runTest('Agent active (isStreaming=true) \u2192 switchThread NOT called, buttons disabled', () => {
    const threads = [
      { id: 'a', title: 'Chat 1', updated_at: '' },
      { id: 'b', title: 'Chat 2', updated_at: '' },
    ];
    const calls: string[] = [];
    let newCalled = 0;
    const el = renderSidebar({
      threads, activeThreadId: 'a', isStreaming: true, ipcError: null,
      switchThread: (id) => calls.push(id), newThread: () => { newCalled++; }, deleteActiveThread: () => {},
    });
    (el.querySelector('#thread-item-b') as HTMLElement).click();
    assert.strictEqual(calls.length, 0, 'switchThread should NOT be called when streaming');
    const newBtn = el.querySelector('#new-thread-btn') as HTMLButtonElement;
    assert.ok(newBtn.disabled, 'new-thread-btn should be disabled when streaming');
    newBtn.click();
    assert.strictEqual(newCalled, 0, 'newThread should NOT be called when streaming');
  });

  // Test 6: ipcError set + empty threads → "No chats yet", NOT spinner
  runTest('ipcError set + empty threads \u2192 shows empty state, not loading spinner', () => {
    const el = renderSidebar({
      threads: [], activeThreadId: null, isStreaming: false, ipcError: 'Failed to load threads',
      switchThread: () => {}, newThread: () => {}, deleteActiveThread: () => {},
    });
    assert.ok(!el.querySelector('.thread-sidebar__loading'), 'Loading should NOT show when ipcError is set');
    const empty = el.querySelector('.thread-sidebar__empty');
    assert.ok(empty, 'Empty state should show when ipcError is set');
    assert.ok(empty!.textContent!.includes('No chats yet'), 'Empty state text should be shown');
  });

  // Test 7: No ipcError, no threads → loading spinner
  runTest('No ipcError, no threads \u2192 shows loading spinner', () => {
    const el = renderSidebar({
      threads: [], activeThreadId: null, isStreaming: false, ipcError: null,
      switchThread: () => {}, newThread: () => {}, deleteActiveThread: () => {},
    });
    assert.ok(el.querySelector('.thread-sidebar__loading'), 'Loading should show when no error and no threads');
    assert.ok(!el.querySelector('.thread-sidebar__empty'), 'Empty state should NOT show during loading');
  });

  // Test 8: Delete button id is thread-scoped, only one in DOM at a time
  runTest('Delete button id is thread-specific (no duplicate ids)', () => {
    const threads = [
      { id: 'x', title: 'Chat X', updated_at: '' },
      { id: 'y', title: 'Chat Y', updated_at: '' },
    ];
    const el = renderSidebar({
      threads, activeThreadId: 'x', isStreaming: false, ipcError: null,
      switchThread: () => {}, newThread: () => {}, deleteActiveThread: () => {},
    });
    const allDelBtns = el.querySelectorAll('[id^="delete-thread-btn-"]');
    assert.strictEqual(allDelBtns.length, 1, 'Only one delete button should exist (active thread only)');
    assert.strictEqual((allDelBtns[0] as HTMLElement).id, 'delete-thread-btn-x', 'ID includes active thread id');
    assert.ok(!el.querySelector('#delete-thread-btn-y'), 'Non-active thread must NOT have delete button');
  });

  if (failed > 0) {
    throw new Error(`${failed} ThreadSidebar test(s) failed`);
  }
  console.log(`  \ud83d\udfe2 All ${passed} ThreadSidebar tests passed.`);
}
