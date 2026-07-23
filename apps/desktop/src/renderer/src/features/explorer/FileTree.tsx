import { useWorkspace } from '../../hooks/useWorkspace';
import { getFileIcon, FolderIcon } from './FileIcons';
import { useState, useEffect } from 'react';
import type { FileEntry } from '@peep/shared';
import { useWorkspaceStore } from '../../stores/workspace-store';
import { ContextMenu } from './ContextMenu';

interface FileTreeProps {
  entries: FileEntry[];
  rootPath: string;
  dirPath?: string;
  depth?: number;
  onContextMenuShow?: (e: React.MouseEvent, entry: FileEntry) => void;
}

function InlineCreateInput({ depth, baseDir }: { depth: number; baseDir: string }) {
  const [name, setName] = useState('');
  const creatingItem = useWorkspaceStore((s) => s.creatingItem);
  const setCreatingItem = useWorkspaceStore((s) => s.setCreatingItem);
  const { project, syncProject } = useWorkspace();

  const handleSubmit = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (name && creatingItem) {
        try {
          const path = `${baseDir}/${name}`;
          if (creatingItem.type === 'folder') {
            await window.peep.createDir(path);
          } else {
            await window.peep.writeFile(path, '');
          }
          if (project) {
            await syncProject(project);
          }
        } catch (err: any) {
          console.error('Failed to create item:', err);
          alert(`Could not create ${creatingItem.type}:\n${err.message || 'Unknown error'}`);
        } finally {
          setCreatingItem(null);
        }
      } else {
        setCreatingItem(null);
      }
    } else if (e.key === 'Escape') {
      setCreatingItem(null);
    }
  };

  if (!creatingItem) return null;

  return (
    <div className={`tree-item tree-indent-${Math.min(depth + 1, 3)} active`} style={{ padding: '2px 8px' }}>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, marginRight: 6 }}>
        {creatingItem.type === 'folder' ? <FolderIcon isOpen={true} /> : getFileIcon(name)}
      </span>
      <input
        autoFocus
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleSubmit}
        onBlur={() => setCreatingItem(null)}
        style={{ flex: 1, background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--accent)', outline: 'none', padding: '2px 4px', fontSize: '12px' }}
      />
    </div>
  );
}

function InlineRenameInput({ depth, entry }: { depth: number; entry: FileEntry }) {
  const [name, setName] = useState(entry.name);
  const setRenamingItem = useWorkspaceStore((s) => s.setRenamingItem);
  const { renameItem, project, syncProject } = useWorkspace();

  const handleSubmit = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (name && name !== entry.name) {
        try {
          const lastSlash = Math.max(entry.path.lastIndexOf('/'), entry.path.lastIndexOf('\\'));
          const baseDir = lastSlash > -1 ? entry.path.substring(0, lastSlash) : entry.path;
          const newPath = `${baseDir}/${name}`;
          await renameItem(entry.path, newPath);
          if (project) {
            await syncProject(project);
          }
        } catch (err: any) {
          console.error('Failed to rename item:', err);
          alert(`Could not rename:\n${err.message || 'Unknown error'}`);
        } finally {
          setRenamingItem(null);
        }
      } else {
        setRenamingItem(null);
      }
    } else if (e.key === 'Escape') {
      setRenamingItem(null);
    }
  };

  return (
    <div className={`tree-item tree-indent-${Math.min(depth + 1, 3)} active`} style={{ padding: '2px 8px' }}>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, marginRight: 6 }}>
        {entry.type === 'directory' ? <FolderIcon isOpen={false} /> : getFileIcon(name)}
      </span>
      <input
        autoFocus
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleSubmit}
        onBlur={() => setRenamingItem(null)}
        style={{ flex: 1, background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--accent)', outline: 'none', padding: '2px 4px', fontSize: '12px' }}
        onFocus={(e) => {
          // Select just the filename without extension if possible
          const lastDot = name.lastIndexOf('.');
          if (lastDot > 0 && entry.type === 'file') {
            e.target.setSelectionRange(0, lastDot);
          } else {
            e.target.select();
          }
        }}
      />
    </div>
  );
}

function FolderItem({ entry, rootPath, depth, onContextMenuShow }: { entry: FileEntry, rootPath: string, depth: number, onContextMenuShow?: (e: React.MouseEvent, entry: FileEntry) => void }) {
  const [isOpen, setIsOpen] = useState(depth < 1);
  const creatingItem = useWorkspaceStore((s) => s.creatingItem);
  const renamingItem = useWorkspaceStore((s) => s.renamingItem);
  const setSelectedExplorerPath = useWorkspaceStore((s) => s.setSelectedExplorerPath);
  const selectedExplorerPath = useWorkspaceStore((s) => s.selectedExplorerPath);

  if (renamingItem?.path === entry.path) {
    return <InlineRenameInput depth={depth} entry={entry} />;
  }

  useEffect(() => {
    if (creatingItem?.baseDir === entry.path || creatingItem?.baseDir.startsWith(entry.path + '/')) {
      setIsOpen(true);
    }
  }, [creatingItem?.baseDir, entry.path]);

  const isSelected = selectedExplorerPath?.path === entry.path;

  return (
    <>
      <div 
        className={`tree-item tree-indent-${Math.min(depth + 1, 3)} ${isSelected ? 'active' : ''}`}
        onClick={() => {
          setIsOpen(!isOpen);
          setSelectedExplorerPath({ path: entry.path, type: 'directory' });
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setSelectedExplorerPath({ path: entry.path, type: 'directory' });
          onContextMenuShow?.(e, entry);
        }}
      >
        <span style={{ display: 'inline-block', width: 12, textAlign: 'center', marginRight: 2, fontSize: 10, color: 'var(--muted)' }}>
          {isOpen ? '▼' : '▶'}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, marginRight: 6 }}>
          <FolderIcon isOpen={isOpen} />
        </span>
        {entry.name}
      </div>
      {isOpen && (
        <FileTree entries={entry.children || []} rootPath={rootPath} dirPath={entry.path} depth={depth + 1} onContextMenuShow={onContextMenuShow} />
      )}
    </>
  );
}

export function FileTree({ entries, rootPath, dirPath, depth = 0, onContextMenuShow }: FileTreeProps) {
  const { loadFile, activeFilePath } = useWorkspace();
  const currentDir = dirPath ?? rootPath;
  const creatingItem = useWorkspaceStore((s) => s.creatingItem);
  const isCreatingHere = creatingItem?.baseDir === currentDir;
  const setSelectedExplorerPath = useWorkspaceStore((s) => s.setSelectedExplorerPath);
  const selectedExplorerPath = useWorkspaceStore((s) => s.selectedExplorerPath);
  const renamingItem = useWorkspaceStore((s) => s.renamingItem);
  
  // State for top-level context menu
  const [contextMenuState, setContextMenuState] = useState<{x: number, y: number, entry: FileEntry} | null>(null);

  // If we are at the top level, we handle the context menu here
  const handleContextMenu = (e: React.MouseEvent, entry: FileEntry) => {
    if (onContextMenuShow) {
      onContextMenuShow(e, entry);
    } else {
      setContextMenuState({ x: e.clientX, y: e.clientY, entry });
    }
  };

  return (
    <>
      {entries.map((entry) => {
        const isActive = activeFilePath === entry.path;
        const isSelected = selectedExplorerPath?.path === entry.path;
        if (entry.type === 'directory') {
          return <FolderItem key={entry.path} entry={entry} rootPath={rootPath} depth={depth} onContextMenuShow={handleContextMenu} />;
        }
        
        if (renamingItem?.path === entry.path) {
          return <InlineRenameInput key={entry.path} depth={depth} entry={entry} />;
        }

        return (
          <div
            key={entry.path}
            className={`tree-item tree-indent-${Math.min(depth + 1, 3)} ${isActive || isSelected ? 'active' : ''}`}
            onClick={() => {
              void loadFile(entry.path, entry.name);
              setSelectedExplorerPath({ path: entry.path, type: 'file' });
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSelectedExplorerPath({ path: entry.path, type: 'file' });
              handleContextMenu(e, entry);
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, marginRight: 6 }}>
              {getFileIcon(entry.name)}
            </span>
            {entry.name}
            {isActive && <span className="tree-badge">◈</span>}
          </div>
        );
      })}
      {isCreatingHere && <InlineCreateInput depth={depth} baseDir={currentDir} />}
      {!onContextMenuShow && contextMenuState && (
        <ContextMenu
          x={contextMenuState.x}
          y={contextMenuState.y}
          entry={contextMenuState.entry}
          onClose={() => setContextMenuState(null)}
        />
      )}
    </>
  );
}
