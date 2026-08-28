import { useChatStore } from '../stores/chat-store';
import './ThreadSidebar.css';

export function ThreadSidebar() {
  const threads = useChatStore((s) => s.threads);
  const activeThreadId = useChatStore((s) => s.activeThreadId);
  const switchThread = useChatStore((s) => s.switchThread);
  const deleteActiveThread = useChatStore((s) => s.deleteActiveThread);
  const newThread = useChatStore((s) => s.newThread);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const ipcError = useChatStore((s) => s.ipcError);

  // Show loading only when there's no IPC error AND threads haven't arrived yet.
  // If ipcError is set, show empty state — the red banner above already communicates the problem.
  const isLoading = !ipcError && threads.length === 0;

  const handleSwitchThread = (threadId: string) => {
    if (isStreaming) return;
    void switchThread(threadId);
  };

  const handleNewThread = () => {
    if (isStreaming) return;
    void newThread();
  };

  const handleDeleteThread = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isStreaming) return;
    void deleteActiveThread();
  };

  return (
    <div className="thread-sidebar">
      <div className="thread-sidebar__header">
        <span className="thread-sidebar__title">CHATS</span>
        <button
          id="new-thread-btn"
          className="thread-sidebar__new-btn"
          onClick={handleNewThread}
          disabled={isStreaming}
          title="New Chat"
          aria-label="New Chat"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

      <div className="thread-sidebar__list">
        {isLoading ? (
          <div className="thread-sidebar__loading" aria-live="polite">
            Loading…
          </div>
        ) : threads.length === 0 ? (
          <div className="thread-sidebar__empty">
            No chats yet
          </div>
        ) : (
          threads.map((thread) => {
            const isActive = thread.id === activeThreadId;
            return (
              <div
                key={thread.id}
                id={`thread-item-${thread.id}`}
                className={`thread-item${isActive ? ' thread-item--active' : ''}`}
                onClick={() => handleSwitchThread(thread.id)}
                role="button"
                tabIndex={0}
                aria-current={isActive ? 'true' : undefined}
                style={{ cursor: isStreaming ? 'not-allowed' : 'pointer', opacity: isStreaming ? 0.5 : 1 }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSwitchThread(thread.id); }}
              >
                <span className="thread-item__title">
                  {thread.title || 'New Chat'}
                </span>
                {isActive && (
                  <button
                    id={`delete-thread-btn-${thread.id}`}
                    className="thread-item__delete-btn"
                    onClick={handleDeleteThread}
                    disabled={isStreaming || threads.length <= 1}
                    title="Delete chat"
                    aria-label="Delete chat"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
