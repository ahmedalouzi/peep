import { useEffect, useState } from 'react';
import { useWorkspace } from '../../hooks/useWorkspace';
import './GitPanel.css';

interface GitDiffViewProps {
  filePath: string;
}

export function GitDiffView({ filePath }: GitDiffViewProps) {
  const { project } = useWorkspace();
  const [diff, setDiff] = useState('');

  useEffect(() => {
    if (!project || !filePath) {
      setDiff('');
      return;
    }
    void window.peep.gitDiff(project.path, filePath).then((result) => setDiff(result.diff));
  }, [project, filePath]);

  if (!project) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: 'var(--bg-base)' }}>
      <div className="git-panel__diff" style={{ flex: 1, borderLeft: 'none' }}>
        <div className="git-panel__diff-header" style={{ borderBottom: '1px solid var(--border)' }}>
          {filePath} (Diff)
        </div>
        <pre className="git-panel__diff-content" style={{ margin: 0, padding: '16px', fontSize: '13px', lineHeight: '1.5' }}>
          {diff || 'Loading diff...'}
        </pre>
      </div>
    </div>
  );
}
