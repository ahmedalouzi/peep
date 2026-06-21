import { useCallback, useEffect, useState } from 'react';
import type { GitFileChange, GitStatusResult } from '@peep/shared';
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
  const [diff, setDiff] = useState('');
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

  useEffect(() => {
    if (!project || !selectedFile) {
      setDiff('');
      return;
    }
    void window.peep.gitDiff(project.path, selectedFile).then((result) => setDiff(result.diff));
  }, [project, selectedFile]);

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
    <div className="git-panel">
      <div className="git-panel__sidebar">
        <div className="git-panel__branch">
          <span className="git-panel__branch-label">Branch</span>
          <strong>{status.branch}</strong>
          <button type="button" className="btn btn-ghost" onClick={() => void refresh()} disabled={loading}>
            Refresh
          </button>
        </div>

        <div className="git-section">
          <h4>Staged ({staged.length})</h4>
          <ul className="git-file-list">
            {staged.length === 0 && <li className="git-file-list__empty">No staged changes</li>}
            {staged.map((file) => (
              <GitFileRow
                key={`staged-${file.path}`}
                file={file}
                selected={selectedFile === file.path}
                onSelect={() => setSelectedFile(file.path)}
                onUnstage={() => void window.peep.gitUnstage(project.path, [file.path])}
                actionLabel="−"
              />
            ))}
          </ul>
        </div>

        <div className="git-section">
          <h4>Changes ({unstaged.length})</h4>
          <ul className="git-file-list">
            {unstaged.length === 0 && <li className="git-file-list__empty">No unstaged changes</li>}
            {unstaged.map((file) => (
              <GitFileRow
                key={`unstaged-${file.path}`}
                file={file}
                selected={selectedFile === file.path}
                onSelect={() => setSelectedFile(file.path)}
                onStage={() => void window.peep.gitStage(project.path, [file.path])}
                actionLabel="+"
              />
            ))}
          </ul>
        </div>

        <div className="git-commit">
          <textarea
            placeholder="Commit message"
            value={commitMessage}
            rows={2}
            onChange={(e) => setCommitMessage(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-primary"
            disabled={!commitMessage.trim() || staged.length === 0}
            onClick={() => void handleCommit()}
          >
            Commit
          </button>
        </div>
      </div>

      <div className="git-panel__diff">
        {selectedFile ? (
          <>
            <div className="git-panel__diff-header">{selectedFile}</div>
            <pre className="git-panel__diff-content">{diff}</pre>
          </>
        ) : (
          <div className="bottom-panel__empty">Select a file to view diff</div>
        )}
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
