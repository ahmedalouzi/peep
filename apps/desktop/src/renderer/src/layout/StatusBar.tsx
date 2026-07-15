import { useWorkspaceStore } from '../stores/workspace-store';
import { useWorkspace } from '../hooks/useWorkspace';
import { useDiagnosticsStore } from '../stores/preview-store';

export function StatusBar() {
  const { project, activeFilePath } = useWorkspace();
  const diagnostics = useDiagnosticsStore((s) => s.items);
  const errorCount = diagnostics.filter((d) => d.severity === 'error').length;
  const warningCount = diagnostics.filter((d) => d.severity === 'warning').length;

  const handleToggleBottomPanel = () => {
    useWorkspaceStore.getState().setBottomPanelTab('problems');
    if (!useWorkspaceStore.getState().bottomPanelOpen) useWorkspaceStore.getState().toggleBottomPanel();
  };

  return (
    <div className="statusbar">
      <div className="status-item highlight" style={{ cursor: 'pointer' }} onClick={() => useWorkspaceStore.getState().setSidebarView('git')}>
        <svg style={{width:'12px',height:'12px',stroke:'currentColor',fill:'none',strokeWidth:'2',marginRight:'4px'}} viewBox="0 0 24 24"><path d="M12 2L2 22l10-4 10 4L12 2z"/></svg>
        Git
      </div>
      <div className="status-item" style={{ cursor: 'pointer' }} onClick={handleToggleBottomPanel}>
        <svg style={{width:'12px',height:'12px',stroke:'currentColor',fill:'none',strokeWidth:'2',marginRight:'4px', color: errorCount > 0 ? 'var(--red)' : 'inherit'}} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
        <span style={{ color: errorCount > 0 ? 'var(--red)' : 'inherit' }}>{errorCount}</span>
      </div>
      <div className="status-item" style={{ cursor: 'pointer' }} onClick={handleToggleBottomPanel}>
        <svg style={{width:'12px',height:'12px',stroke:'currentColor',fill:'none',strokeWidth:'2',marginRight:'4px', color: warningCount > 0 ? 'var(--yellow)' : 'inherit'}} viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <span style={{ color: warningCount > 0 ? 'var(--yellow)' : 'inherit' }}>{warningCount}</span>
      </div>
      <span className="status-sep">|</span>
      <div className="status-item">{project ? `Synkro Ready - ${project.name}` : 'Synkro Ready'}</div>

      <div className="status-right">
        {activeFilePath && (
          <>
            <div className="status-item">UTF-8</div>
            <div className="status-item">CRLF</div>
          </>
        )}
        <div className="status-item highlight">
          <svg style={{width:'12px',height:'12px',stroke:'currentColor',fill:'none',strokeWidth:'2',marginRight:'4px'}} viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          Prettier
        </div>
        <div className="status-item">
          <div className="status-indicator si-green"></div>
          Online
        </div>
      </div>
    </div>
  );
}
