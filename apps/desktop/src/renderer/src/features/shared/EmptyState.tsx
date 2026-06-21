import './EmptyState.css';
import { useWorkspaceStore } from '../../stores/workspace-store';
import { useWorkspace } from '../../hooks/useWorkspace';

/* ── Generic preset ─────────────────────────────────────────────────── */

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  hint?: string;
}

export function EmptyState({ icon, title, description, action, secondaryAction, hint }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">{icon}</div>
      <h3 className="empty-state__title">{title}</h3>
      <p className="empty-state__desc">{description}</p>
      {(action || secondaryAction) && (
        <div className="empty-state__actions">
          {action && (
            <button className="empty-state__btn primary" onClick={action.onClick}>
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button className="empty-state__btn secondary" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
      {hint && <p className="empty-state__hint">{hint}</p>}
    </div>
  );
}

/* ── Antigravity-style "No Project" welcome screen ─────────────────── */

export function NoProjectEmptyState({
  onOpen,
  onNew,
}: {
  onOpen: () => void;
  onNew: () => void;
}) {
  const recentProjects = useWorkspaceStore((s) => s.recentProjects);
  const { openProjectByPath } = useWorkspace();

  return (
    <div className="antigravity-empty-state">
      <div className="antigravity-hero">
        {/* Logo — identical 'A' chevron shape as Antigravity */}
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="antigravity-logo"
        >
          <path d="M4 19L12 5L20 19" />
          <path d="M7.5 13.5L16.5 13.5" />
        </svg>
        <h1 className="antigravity-title">Antigravity IDE</h1>

        {/* Primary actions */}
        <div className="antigravity-actions">
          <button className="antigravity-btn antigravity-btn-primary" onClick={onOpen}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            Open Folder
          </button>
          <button className="antigravity-btn antigravity-btn-secondary" onClick={onNew}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Clone Repository
          </button>
        </div>

        {/* Recent workspaces */}
        <div className="antigravity-section">
          <h3 className="antigravity-section-title">Workspaces</h3>
          <div className="antigravity-list">
            {recentProjects.length === 0 && (
              <div className="antigravity-list-item empty">No recent workspaces</div>
            )}
            {recentProjects.slice(0, 3).map((p) => (
              <button
                key={p.id}
                className="antigravity-list-item"
                title={p.path}
                onClick={() => void openProjectByPath(p.path)}
              >
                <strong>{p.name}</strong>
                <span>{p.path}</span>
              </button>
            ))}
          </div>
          {recentProjects.length > 3 && (
            <button className="antigravity-show-more">Show More...</button>
          )}
        </div>

        {/* Extensions section — mirrors Antigravity */}
        <div className="antigravity-section extensions-section">
          <h3 className="antigravity-section-title">Google Extensions</h3>
          <div className="antigravity-extension-card">
            <div className="ext-icon">☁️</div>
            <div className="ext-info">
              <strong>Google Data Cloud</strong>
              <span>Google Data Cloud for your intelligent IDE.</span>
            </div>
            <button className="ext-download">Download</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Other presets ──────────────────────────────────────────────────── */

export function NoFileOpenEmptyState({ hint }: { hint?: string }) {
  return (
    <EmptyState
      icon="📝"
      title="No file open"
      description="Select a file from the explorer or press Ctrl+P to search."
      hint={hint ?? 'Tip: Click any file in the sidebar to open it in the editor.'}
    />
  );
}

export function NoApiKeyEmptyState({ onSettings }: { onSettings: () => void }) {
  return (
    <EmptyState
      icon="🔑"
      title="API key not configured"
      description="Add your OpenAI or Anthropic API key to start chatting with the AI agent."
      action={{ label: '⚙ Open Settings', onClick: onSettings }}
      hint="Your key is stored locally and never leaves your machine."
    />
  );
}

export function PreviewErrorEmptyState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <EmptyState
      icon="⚠️"
      title="Preview unavailable"
      description={message}
      action={onRetry ? { label: '↺ Retry', onClick: onRetry } : undefined}
      hint="Make sure Flutter SDK is installed and the project has no syntax errors."
    />
  );
}
