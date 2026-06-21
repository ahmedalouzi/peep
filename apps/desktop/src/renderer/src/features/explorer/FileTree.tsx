import { useState } from 'react';
import type { FileEntry } from '@peep/shared';
import { useWorkspace } from '../../hooks/useWorkspace';
import { getFileIcon, FolderIcon } from './FileIcons';
import './FileTree.css';

interface FileTreeProps {
  entries: FileEntry[];
  rootPath: string;
  depth?: number;
}

function FolderItem({ entry, rootPath, depth }: { entry: FileEntry, rootPath: string, depth: number }) {
  // Open root level by default
  const [isOpen, setIsOpen] = useState(depth < 1);

  return (
    <>
      <button 
        type="button" 
        className="file-tree__row file-tree__row--dir"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span 
          className="file-tree__arrow" 
          style={{ transform: isOpen ? 'rotate(90deg)' : 'none' }}
        >
          ▸
        </span>
        <span className="file-tree__icon"><FolderIcon isOpen={isOpen} /></span>
        <span className="file-tree__name">{entry.name}</span>
      </button>
      {isOpen && entry.children && entry.children.length > 0 && (
        <FileTree entries={entry.children} rootPath={rootPath} depth={depth + 1} />
      )}
    </>
  );
}

export function FileTree({ entries, rootPath, depth = 0 }: FileTreeProps) {
  const { loadFile } = useWorkspace();

  return (
    <ul className="file-tree" style={{ paddingLeft: depth === 0 ? 0 : 12 }}>
      {entries.map((entry) => (
        <li key={entry.path} className="file-tree__item">
          {entry.type === 'directory' ? (
            <FolderItem entry={entry} rootPath={rootPath} depth={depth} />
          ) : (
            <button
              type="button"
              className="file-tree__row file-tree__row--file"
              onClick={() => void loadFile(entry.path, entry.name)}
            >
              <span className="file-tree__icon">{getFileIcon(entry.name)}</span>
              <span className="file-tree__name">{entry.name}</span>
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
