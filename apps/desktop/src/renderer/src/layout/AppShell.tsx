import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from 'react-resizable-panels';
import { ActivityBar } from './ActivityBar';
import { Sidebar } from './Sidebar';
import { EditorPane } from './EditorPane';
import { PreviewPane } from './PreviewPane';
import { ChatPane } from './ChatPane';
import { BottomPanel } from './BottomPanel';
import { TitleBar } from './TitleBar';
import { NoProjectEmptyState } from '../features/shared/EmptyState';
import { useWorkspaceStore } from '../stores/workspace-store';
import { useWorkspace } from '../hooks/useWorkspace';
import '../styles/panel.css';
import './AppShell.css';

interface AppShellProps {
  onOpenSettings: () => void;
  onNewProject: () => void;
}

export function AppShell({ onOpenSettings, onNewProject }: AppShellProps) {
  const bottomPanelOpen = useWorkspaceStore((s) => s.bottomPanelOpen);
  const sidebarOpen = useWorkspaceStore((s) => s.sidebarOpen);
  const agentPaneOpen = useWorkspaceStore((s) => s.agentPaneOpen);
  const { project, openProjectFolder } = useWorkspace();

  const handleNewProject = () => {
    window.dispatchEvent(new CustomEvent('peep:new-project'));
  };

  return (
    <div className="app-shell">
      <TitleBar onNewProject={onNewProject} />
      <div className="app-shell__body">
        <ActivityBar />
        
        {project ? (
          <PanelGroup direction="horizontal">
            {sidebarOpen && (
              <>
                <Panel defaultSize={18} minSize={14} maxSize={30}>
                  <Sidebar />
                </Panel>
                <PanelResizeHandle />
              </>
            )}
            
            <Panel defaultSize={60} minSize={30}>
              <PanelGroup direction="vertical">
                <Panel defaultSize={bottomPanelOpen ? 70 : 100} minSize={30}>
                  <PanelGroup direction="horizontal">
                    <Panel defaultSize={50} minSize={25}>
                      <EditorPane />
                    </Panel>
                    <PanelResizeHandle />
                    <Panel defaultSize={50} minSize={25}>
                      <PreviewPane />
                    </Panel>
                  </PanelGroup>
                </Panel>
                {bottomPanelOpen && (
                  <>
                    <PanelResizeHandle />
                    <Panel defaultSize={30} minSize={10} maxSize={50}>
                      <BottomPanel />
                    </Panel>
                  </>
                )}
              </PanelGroup>
            </Panel>

            {agentPaneOpen && (
              <>
                <PanelResizeHandle />
                <Panel defaultSize={22} minSize={16} maxSize={35}>
                  <ChatPane onOpenSettings={onOpenSettings} />
                </Panel>
              </>
            )}
          </PanelGroup>
        ) : (
          <PanelGroup direction="horizontal">
            <Panel defaultSize={75} minSize={50}>
              <NoProjectEmptyState
                onOpen={() => void openProjectFolder()}
                onNew={handleNewProject}
              />
            </Panel>
            {agentPaneOpen && (
              <>
                <PanelResizeHandle />
                <Panel defaultSize={25} minSize={16} maxSize={35}>
                  <ChatPane onOpenSettings={onOpenSettings} />
                </Panel>
              </>
            )}
          </PanelGroup>
        )}
      </div>
    </div>
  );
}
