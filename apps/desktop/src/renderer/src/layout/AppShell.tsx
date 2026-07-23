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
import { ComposerOverlay } from '../features/composer/ComposerOverlay';
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
  
  const [agentWidth, setAgentWidth] = useState(280);
  const [previewWidth, setPreviewWidth] = useState(320);
  const [isResizingAgent, setIsResizingAgent] = useState(false);
  const [isResizingPreview, setIsResizingPreview] = useState(false);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const startResizingAgent = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingAgent(true);
  }, []);

  const startResizingPreview = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingPreview(true);
  }, []);

  useEffect(() => {
    if (!isResizing && !isResizingAgent && !isResizingPreview) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing) {
        const newHeight = window.innerHeight - e.clientY - 22;
        if (newHeight > 100 && newHeight < window.innerHeight * 0.8) {
          setTerminalHeight(newHeight);
        }
      }
      if (isResizingAgent) {
        const newWidth = window.innerWidth - e.clientX;
        if (newWidth > 200 && newWidth < window.innerWidth * 0.6) {
          setAgentWidth(newWidth);
        }
      }
      if (isResizingPreview) {
        const agentOffset = agentPaneOpen ? agentWidth : 0;
        const newWidth = window.innerWidth - agentOffset - e.clientX;
        if (newWidth > 200 && newWidth < window.innerWidth * 0.6) {
          setPreviewWidth(newWidth);
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setIsResizingAgent(false);
      setIsResizingPreview(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, isResizingAgent, isResizingPreview, agentWidth, agentPaneOpen]);

  const handleNewProject = () => {
    window.dispatchEvent(new CustomEvent('peep:new-project'));
  };

  return (
    <>
      <TitleBar onNewProject={onNewProject} />
      <div 
        className="layout"
        style={{
          gridTemplateColumns: `46px ${sidebarOpen ? '240px' : '0px'} 1fr ${previewPaneOpen ? `${previewWidth}px` : '0px'} ${agentPaneOpen ? `${agentWidth}px` : '0px'}`,
          gridTemplateRows: `calc(100vh - 82px - ${bottomPanelOpen ? terminalHeight : 0}px) ${bottomPanelOpen ? terminalHeight : 0}px`,
        }}
      >
        {project ? (
          <>
            <ActivityBar />
            {sidebarOpen && <Sidebar />}
            
            <EditorPane />
            
            {previewPaneOpen && (
              <>
                <div 
                  onMouseDown={startResizingPreview}
                  style={{
                    gridRow: 1, 
                    gridColumn: 4, 
                    width: '4px', 
                    marginLeft: '-2px',
                    cursor: 'col-resize',
                    zIndex: 50,
                    background: isResizingPreview ? 'var(--accent)' : 'transparent',
                    opacity: isResizingPreview ? 0.5 : 1
                  }}
                />
                <PreviewPane />
              </>
            )}
            
            {agentPaneOpen && (
              <>
                <div 
                  onMouseDown={startResizingAgent}
                  style={{
                    gridRow: '1 / 3', 
                    gridColumn: 5, 
                    width: '4px', 
                    marginLeft: '-2px',
                    cursor: 'col-resize',
                    zIndex: 50,
                    background: isResizingAgent ? 'var(--accent)' : 'transparent',
                    opacity: isResizingAgent ? 0.5 : 1
                  }}
                />
                <ChatPane onOpenSettings={onOpenSettings} />
              </>
            )}
            
            {bottomPanelOpen && (
              <>
                <div 
                  onMouseDown={startResizing}
                  style={{
                    gridRow: 2, 
                    gridColumn: '3 / 6', 
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
      {(isResizing || isResizingAgent || isResizingPreview) && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, cursor: isResizing ? 'row-resize' : 'col-resize' }} />
      )}

      <ComposerOverlay />
    </>
  );
}
