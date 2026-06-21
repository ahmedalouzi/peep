
import { useDiagnosticsStore, usePreviewStore } from '../stores/preview-store';
import { useWorkspaceStore } from '../stores/workspace-store';
import { useWorkspace } from '../hooks/useWorkspace';
import { TerminalPanel } from '../features/terminal/TerminalPanel';
import { GitPanel } from '../features/git/GitPanel';
import './BottomPanel.css';



export function BottomPanel() {
  const tab = useWorkspaceStore((s) => s.bottomPanelTab);
  const setTab = useWorkspaceStore((s) => s.setBottomPanelTab);
  const diagnostics = useDiagnosticsStore((s) => s.items);
  const logs = usePreviewStore((s) => s.logs);
  const { project, loadFile } = useWorkspace();

  const errorCount = diagnostics.filter((d) => d.severity === 'error').length;
  const warningCount = diagnostics.filter((d) => d.severity === 'warning').length;

  const handleAnalyze = () => {
    if (!project) return;
    void window.peep.analyzeProject(project.path);
  };

  return (
    <section className="panel bottom-panel">
      <div className="panel-header panel-header--tabs">
        <div className="bottom-panel__tabs">
          <button
            type="button"
            className={`btn btn-ghost ${tab === 'problems' ? 'bottom-tab--active' : ''}`}
            onClick={() => setTab('problems')}
          >
            Problems
            {errorCount > 0 && <span className="badge badge--error">{errorCount}</span>}
            {warningCount > 0 && <span className="badge badge--warn">{warningCount}</span>}
          </button>
          <button
            type="button"
            className={`btn btn-ghost ${tab === 'logs' ? 'bottom-tab--active' : ''}`}
            onClick={() => setTab('logs')}
          >
            Output
          </button>
          <button
            type="button"
            className={`btn btn-ghost ${tab === 'terminal' ? 'bottom-tab--active' : ''}`}
            onClick={() => setTab('terminal')}
          >
            Terminal
          </button>
          <button
            type="button"
            className={`btn btn-ghost ${tab === 'git' ? 'bottom-tab--active' : ''}`}
            onClick={() => setTab('git')}
          >
            Git
          </button>
          <button
            type="button"
            className={`btn btn-ghost`}
            onClick={() => alert('Ports coming soon')}
          >
            Ports
          </button>
        </div>
        <div className="panel-actions">
          <button type="button" className="btn btn-ghost" onClick={handleAnalyze} disabled={!project}>
            Analyze
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => useWorkspaceStore.getState().toggleBottomPanel()}>
            ✕
          </button>
        </div>
      </div>
      <div className="panel-body bottom-panel__body">
        {tab === 'problems' && (
          <div className="bottom-panel__problems">
            {diagnostics.length === 0 ? (
              <div className="bottom-panel__empty">No problems detected.</div>
            ) : (
              diagnostics.map((item, index) => (
                <button
                  key={`${item.file}-${item.line}-${index}`}
                  type="button"
                  className={`problem-row problem-row--${item.severity}`}
                  onClick={() => {
                    const name = item.file.split(/[\\/]/).pop() ?? item.file;
                    void loadFile(item.file, name);
                  }}
                >
                  <span className="problem-row__severity">{item.severity}</span>
                  <span className="problem-row__message">{item.message}</span>
                  <span className="problem-row__location">
                    {item.file}:{item.line}:{item.column}
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        <div className={`bottom-panel__tab ${tab === 'terminal' ? 'bottom-panel__tab--active' : ''}`}>
          <TerminalPanel />
        </div>

        {tab === 'git' && <GitPanel />}

        {tab === 'logs' && (
          <pre className="bottom-panel__logs">
            {logs.length === 0 ? (
              <div className="bottom-panel__empty">Build and preview logs will appear here.</div>
            ) : (
              logs.map((line, index) => (
                <div key={index} className="log-line log-line--info">
                  {line}
                </div>
              ))
            )}
          </pre>
        )}
      </div>
    </section>
  );
}
