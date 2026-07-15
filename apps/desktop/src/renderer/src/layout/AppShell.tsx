import { useState, useCallback, useEffect } from 'react';
import { ActivityBar } from './ActivityBar';
import { Sidebar } from './Sidebar';
import { EditorPane } from './EditorPane';
import { PreviewPane } from './PreviewPane';
import { ChatPane } from './ChatPane';
import { BottomPanel } from './BottomPanel';
import { TitleBar } from './TitleBar';
import { StatusBar } from './StatusBar';
import { NoProjectEmptyState } from '../features/shared/EmptyState';
import { useWorkspaceStore } from '../stores/workspace-store';
import { useWorkspace } from '../hooks/useWorkspace';
import './AppShell.css';

interface AppShellProps {
  onOpenSettings: () => void;
  onNewProject: () => void;
}

export function AppShell({ onOpenSettings, onNewProject }: AppShellProps) {
  const bottomPanelOpen = useWorkspaceStore((s) => s.bottomPanelOpen);
  const sidebarOpen = useWorkspaceStore((s) => s.sidebarOpen);
  const agentPaneOpen = useWorkspaceStore((s) => s.agentPaneOpen);
  const previewPaneOpen = useWorkspaceStore((s) => s.previewPaneOpen);
  const { project, openProjectFolder } = useWorkspace();

  const [terminalHeight, setTerminalHeight] = useState(160);
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      // 82px = titlebar + menubar, 22px = statusbar
      const newHeight = window.innerHeight - e.clientY - 22;
      if (newHeight > 100 && newHeight < window.innerHeight * 0.8) {
        setTerminalHeight(newHeight);
      }
    };

    const handleMouseUp = () => setIsResizing(false);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const handleNewProject = () => {
    window.dispatchEvent(new CustomEvent('peep:new-project'));
  };

  return (
    <>
      <TitleBar onNewProject={onNewProject} />
      <div 
        className="layout"
        style={{
          gridTemplateColumns: `46px ${sidebarOpen ? '220px' : '0px'} 1fr ${previewPaneOpen ? '320px' : '0px'} ${agentPaneOpen ? '280px' : '0px'}`,
          gridTemplateRows: `calc(100vh - 82px - ${bottomPanelOpen ? terminalHeight : 0}px) ${bottomPanelOpen ? terminalHeight : 0}px`,
        }}
      >
        {project ? (
          <>
            <ActivityBar />
            {sidebarOpen && <Sidebar />}
            
            <EditorPane />
            {previewPaneOpen && <PreviewPane />}
            
            {agentPaneOpen && <ChatPane onOpenSettings={onOpenSettings} />}
            
            {bottomPanelOpen && (
              <>
                <div 
                  onMouseDown={startResizing}
                  style={{
                    gridRow: 2, 
                    gridColumn: '3 / 5', 
                    height: '4px', 
                    marginTop: '-2px',
                    cursor: 'row-resize',
                    zIndex: 50,
                    background: isResizing ? 'var(--accent)' : 'transparent',
                    opacity: isResizing ? 0.5 : 1
                  }}
                />
                <BottomPanel />
              </>
            )}
          </>
        ) : (
          <div style={{ gridColumn: '1 / 6', gridRow: '1 / 3', display: 'flex', flexDirection: 'column' }}>
            <NoProjectEmptyState
              onOpen={() => void openProjectFolder()}
              onNew={handleNewProject}
            />
          </div>
        )}
      </div>
      <StatusBar />
      
      {/* Global dragging overlay to prevent iframe selection while resizing */}
      {isResizing && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, cursor: 'row-resize' }} />
      )}
    </>
  );
}
