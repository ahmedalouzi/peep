import { useWorkspace } from '../../hooks/useWorkspace';
import { getFileIcon, FolderIcon } from './FileIcons';
import { useState } from 'react';
import type { FileEntry } from '@peep/shared';

interface FileTreeProps {
  entries: FileEntry[];
  rootPath: string;
  depth?: number;
}

function FolderItem({ entry, rootPath, depth }: { entry: FileEntry, rootPath: string, depth: number }) {
  const [isOpen, setIsOpen] = useState(depth < 1);

  return (
    <>
      <div 
        className={`tree-item tree-indent-${Math.min(depth + 1, 3)}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span style={{ display: 'inline-block', width: 12, textAlign: 'center', marginRight: 2, fontSize: 10, color: 'var(--muted)' }}>
          {isOpen ? '▼' : '▶'}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, marginRight: 6 }}>
          <FolderIcon isOpen={isOpen} />
        </span>
        {entry.name}
      </div>
      {isOpen && entry.children && entry.children.length > 0 && (
        <FileTree entries={entry.children} rootPath={rootPath} depth={depth + 1} />
      )}
    </>
  );
}

export function FileTree({ entries, rootPath, depth = 0 }: FileTreeProps) {
  const { loadFile, activeFilePath } = useWorkspace();

  return (
    <>
      {entries.map((entry) => {
        const isActive = activeFilePath === entry.path;
        if (entry.type === 'directory') {
          return <FolderItem key={entry.path} entry={entry} rootPath={rootPath} depth={depth} />;
        }
        return (
          <div
            key={entry.path}
            className={`tree-item tree-indent-${Math.min(depth + 1, 3)} ${isActive ? 'active' : ''}`}
            onClick={() => void loadFile(entry.path, entry.name)}
          >
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, marginRight: 6 }}>
              {getFileIcon(entry.name)}
            </span>
            {entry.name}
            {isActive && <span className="tree-badge">◈</span>}
          </div>
        );
      })}
    </>
  );
}
