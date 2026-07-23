import { useEffect, useRef } from 'react';
import type { FileEntry } from '@peep/shared';
import { useWorkspace } from '../../hooks/useWorkspace';
import { useWorkspaceStore } from '../../stores/workspace-store';

interface ContextMenuProps {
  x: number;
  y: number;
  entry: FileEntry | null;
  onClose: () => void;
}

export function ContextMenu({ x, y, entry, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const { deleteItem, revealItem, syncProject, project } = useWorkspace();
  const setCreatingItem = useWorkspaceStore((s) => s.setCreatingItem);
  const setRenamingItem = useWorkspaceStore((s) => s.setRenamingItem);
  const setSelectedExplorerPath = useWorkspaceStore((s) => s.setSelectedExplorerPath);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    
    // Slight delay to prevent immediate close on the same click
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('contextmenu', handleClickOutside);
    }, 10);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('contextmenu', handleClickOutside);
    };
  }, [onClose]);

  if (!entry || !project) return null;

  const handleAction = async (action: () => Promise<void> | void) => {
    onClose();
    try {
      await action();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'An error occurred');
    }
  };

  const getBaseDir = () => {
    if (entry.type === 'directory') return entry.path;
    const lastSlash = Math.max(entry.path.lastIndexOf('/'), entry.path.lastIndexOf('\\'));
    return lastSlash > -1 ? entry.path.substring(0, lastSlash) : entry.path;
  };

  // Keep menu within screen bounds
  const adjustedX = Math.min(x, window.innerWidth - 220);
  const adjustedY = Math.min(y, window.innerHeight - 250);

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{
        position: 'fixed',
        left: adjustedX,
        top: adjustedY,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '6px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        padding: '4px 0',
        zIndex: 9999,
        minWidth: '220px',
        color: 'var(--text-primary)',
        fontSize: '13px',
      }}
    >
      <div 
        className="context-menu-item"
        onClick={() => handleAction(() => {
          setSelectedExplorerPath({ path: entry.path, type: entry.type });
          setCreatingItem({ type: 'file', baseDir: getBaseDir() });
        })}
      >
        New File...
      </div>
      <div 
        className="context-menu-item"
        onClick={() => handleAction(() => {
          setSelectedExplorerPath({ path: entry.path, type: entry.type });
          setCreatingItem({ type: 'folder', baseDir: getBaseDir() });
        })}
      >
        New Folder...
      </div>
      
      <div className="context-menu-divider" />
      
      <div 
        className="context-menu-item"
        onClick={() => handleAction(() => revealItem(entry.path))}
      >
        Reveal in File Explorer
      </div>
      
      <div className="context-menu-divider" />
      
      <div 
        className="context-menu-item"
        onClick={() => handleAction(() => {
          navigator.clipboard.writeText(entry.path);
        })}
      >
        Copy Path
      </div>
      <div 
        className="context-menu-item"
        onClick={() => handleAction(() => {
          const relative = entry.path.substring(project.path.length).replace(/^[/\\]/, '');
          navigator.clipboard.writeText(relative);
        })}
      >
        Copy Relative Path
      </div>
      
      <div className="context-menu-divider" />
      
      <div 
        className="context-menu-item"
        onClick={() => handleAction(async () => {
          setRenamingItem(entry);
        })}
      >
        Rename...
      </div>
      <div 
        className="context-menu-item text-error"
        onClick={() => handleAction(async () => {
          if (window.confirm(`Are you sure you want to delete '${entry.name}'?\nThis will move it to the Trash.`)) {
            await deleteItem(entry.path);
            await syncProject(project);
          }
        })}
      >
        Delete
      </div>
    </div>
  );
}
