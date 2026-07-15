import { useCallback, useEffect, useState } from 'react';
import type { GitFileChange, GitStatusResult } from '@peep/shared';
import { useWorkspaceStore } from '../../stores/workspace-store';
import { useWorkspace } from '../../hooks/useWorkspace';
import './GitPanel.css';

const STATUS_LABEL: Record<GitFileChange['status'], string> = {
  modified: 'M',
  added: 'A',
  deleted: 'D',
  renamed: 'R',
  untracked: '?',
  staged: 'S',
};

export function GitPanel() {
  const { project } = useWorkspace();
  const [status, setStatus] = useState<GitStatusResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [commitMessage, setCommitMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!project) return;
    setLoading(true);
    try {
      const result = await window.peep.getGitStatus(project.path);
      setStatus(result);
    } finally {
      setLoading(false);
    }
  }, [project]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const unsub = window.peep.onGitChanged(() => {
      void refresh();
    });
    return unsub;
  }, [refresh]);

  const openFileInEditor = (filePath: string) => {
    setSelectedFile(filePath);
    useWorkspaceStore.getState().openFile({
      path: `git-diff://${filePath}`,
      name: `Diff: ${filePath.split('/').pop()}`,
      content: '',
      dirty: false,
    });
  };

  if (!project) {
    return <div className="bottom-panel__empty">Open a project to use Git.</div>;
  }

  if (!status?.isRepo) {
    return (
      <div className="git-panel git-panel--empty">
        <p>Not a Git repository.</p>
        <button type="button" className="btn btn-primary" onClick={() => void window.peep.gitInit(project.path)}>
          Initialize Git
        </button>
      </div>
    );
  }

  const staged = status.changes.filter((c) => c.staged);
  const unstaged = status.changes.filter((c) => !c.staged);

  const handleCommit = async () => {
    if (!commitMessage.trim()) return;
    await window.peep.gitCommit(project.path, commitMessage.trim());
    setCommitMessage('');
    await refresh();
  };

  return (
    <div className="sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="sidebar-header">
        <span className="sidebar-title">SOURCE CONTROL</span>
        <div className="sidebar-actions">
          <button type="button" className="sidebar-btn" onClick={() => void refresh()} disabled={loading} title="Refresh">
            <svg style={{width:'12px',height:'12px'}} viewBox="0 0 16 16" fill="currentColor"><path d="M8 2.5a5.5 5.5 0 1 0 5.5 5.5h-1a4.5 4.5 0 1 1-4.5-4.5v1.5L11.5 2 8 0v2.5z"/></svg>
          </button>
        </div>
      </div>

      <div style={{ padding: '0 10px', marginBottom: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Branch</div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button type="button" className="btn btn-ghost" style={{ padding: '2px 6px', fontSize: '10px' }} onClick={async () => { await window.peep.gitPull(project.path); refresh(); }} title="Pull">↓ Pull</button>
            <button type="button" className="btn btn-ghost" style={{ padding: '2px 6px', fontSize: '10px' }} onClick={async () => { await window.peep.gitPush(project.path); refresh(); }} title="Push">↑ Push</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <strong style={{ fontSize: '12px', flex: 1 }}>{status.branch}</strong>
          <button type="button" className="btn btn-ghost" style={{ padding: '2px 6px', fontSize: '10px' }} onClick={async () => {
            const b = prompt('Enter branch name to checkout or create:');
            if (b) {
              try {
                await window.peep.gitCheckout(project.path, b);
              } catch {
                await window.peep.gitBranch(project.path, b);
              }
              refresh();
            }
          }} title="Checkout/Create branch">Branch...</button>
        </div>
      </div>

      <div className="git-commit" style={{ padding: '0 10px', marginBottom: '10px' }}>
        <textarea
          placeholder="Commit message"
          value={commitMessage}
          rows={2}
          onChange={(e) => setCommitMessage(e.target.value)}
          style={{ width: '100%', padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', marginBottom: '6px', resize: 'vertical' }}
        />
        <button
          type="button"
          className="btn btn-primary"
          style={{ width: '100%', padding: '4px', fontSize: '12px' }}
          disabled={!commitMessage.trim() || staged.length === 0}
          onClick={() => void handleCommit()}
        >
          Commit
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div className="git-section" style={{ padding: '0 10px' }}>
          <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '10px 0 6px' }}>Staged ({staged.length})</h4>
          <ul className="git-file-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {staged.length === 0 && <li className="git-file-list__empty" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No staged changes</li>}
            {staged.map((file) => (
              <GitFileRow
                key={`staged-${file.path}`}
                file={file}
                selected={selectedFile === file.path}
                onSelect={() => openFileInEditor(file.path)}
                onUnstage={() => void window.peep.gitUnstage(project.path, [file.path])}
                actionLabel="−"
              />
            ))}
          </ul>
        </div>

        <div className="git-section" style={{ padding: '0 10px' }}>
          <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '10px 0 6px' }}>Changes ({unstaged.length})</h4>
          <ul className="git-file-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {unstaged.length === 0 && <li className="git-file-list__empty" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No unstaged changes</li>}
            {unstaged.map((file) => (
              <GitFileRow
                key={`unstaged-${file.path}`}
                file={file}
                selected={selectedFile === file.path}
                onSelect={() => openFileInEditor(file.path)}
                onStage={() => void window.peep.gitStage(project.path, [file.path])}
                actionLabel="+"
              />
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function GitFileRow({
  file,
  selected,
  onSelect,
  onStage,
  onUnstage,
  actionLabel,
}: {
  file: GitFileChange;
  selected: boolean;
  onSelect: () => void;
  onStage?: () => void;
  onUnstage?: () => void;
  actionLabel: string;
}) {
  return (
    <li className={`git-file-row ${selected ? 'git-file-row--selected' : ''}`}>
      <button type="button" className="git-file-row__main" onClick={onSelect}>
        <span className={`git-file-row__status git-file-row__status--${file.status}`}>
          {STATUS_LABEL[file.status]}
        </span>
        <span className="git-file-row__path">{file.path}</span>
      </button>
      <button
        type="button"
        className="git-file-row__action"
        title={actionLabel === '+' ? 'Stage' : 'Unstage'}
        onClick={onStage ?? onUnstage}
      >
        {actionLabel}
      </button>
    </li>
  );
}
