import { useRef, useEffect } from 'react';
import { useDiagnosticsStore, usePreviewStore } from '../stores/preview-store';
import { useWorkspaceStore } from '../stores/workspace-store';
import { useWorkspace } from '../hooks/useWorkspace';
import { TerminalPanel } from '../features/terminal/TerminalPanel';
import { useVirtualizer } from '@tanstack/react-virtual';

function LogsTabContent({ logs }: { logs: string[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 20,
    overscan: 20,
  });

  useEffect(() => {
    if (logs.length > 0) {
      virtualizer.scrollToIndex(logs.length - 1, { align: 'end' });
    }
  }, [logs.length, virtualizer]);

  if (logs.length === 0) {
    return <div style={{color: 'var(--text-muted)'}}>Build and preview logs will appear here.</div>;
  }

  return (
    <div ref={parentRef} style={{ overflowY: 'auto', flex: 1 }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const line = logs[virtualItem.index];
          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              className="t-line"
              style={{
                position: 'absolute',
                top: 0, left: 0, width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <span className="t-output">{line}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProblemsTabContent({ diagnostics, loadFile, errorCount, warningCount }: any) {
  const parentRef = useRef<HTMLDivElement>(null);
  const count = diagnostics.length === 0 ? 0 : diagnostics.length + 1;
  
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28,
    overscan: 10,
  });

  if (diagnostics.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', padding: '4px 0' }}>
        ✓ No problems detected.
      </div>
    );
  }

  return (
    <div ref={parentRef} style={{ overflowY: 'auto', flex: 1, fontSize: '12px' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualItem) => {
          if (virtualItem.index === 0) {
             return (
               <div
                  key="summary"
                  data-index={virtualItem.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0, left: 0, width: '100%',
                    transform: `translateY(${virtualItem.start}px)`,
                    marginBottom: '8px', color: 'var(--text-muted)', fontSize: '11px',
                    padding: '0 4px'
                  }}
               >
                 {errorCount > 0 && <span style={{ color: 'var(--red)', marginRight: 8 }}>✕ {errorCount} error{errorCount !== 1 ? 's' : ''}</span>}
                 {warningCount > 0 && <span style={{ color: 'var(--yellow)' }}>⚠ {warningCount} warning{warningCount !== 1 ? 's' : ''}</span>}
               </div>
             );
          }
          
          const index = virtualItem.index - 1;
          const item = diagnostics[index];
          const shortFile = item.file.split(/[\\/]/).slice(-2).join('/');
          const isError = item.severity === 'error';
          
          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              onClick={() => {
                const name = item.file.split(/[\\/]/).pop() ?? item.file;
                void loadFile(item.file, name);
              }}
              style={{
                position: 'absolute',
                top: 0, left: 0, width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
                display: 'flex', alignItems: 'flex-start', gap: '8px',
                padding: '4px 6px',
                borderRadius: '4px', cursor: 'pointer',
                borderLeft: `2px solid ${isError ? 'var(--red)' : 'var(--yellow)'}`,
                background: isError ? 'rgba(255,80,80,0.05)' : 'rgba(255,200,0,0.05)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = isError ? 'rgba(255,80,80,0.12)' : 'rgba(255,200,0,0.1)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = isError ? 'rgba(255,80,80,0.05)' : 'rgba(255,200,0,0.05)')}
            >
              <span style={{ color: isError ? 'var(--red)' : 'var(--yellow)', fontSize: '11px', flexShrink: 0, marginTop: '1px' }}>
                {isError ? '✕' : '⚠'}
              </span>
              <span style={{ flex: 1, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                {item.message}
              </span>
              <span style={{ color: 'var(--text-muted)', flexShrink: 0, fontSize: '10px', alignSelf: 'center' }}>
                {shortFile}:{item.line}{(item as any).col ? `:${(item as any).col}` : ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BottomPanel() {
  const tab = useWorkspaceStore((s) => s.bottomPanelTab);
  const setTab = useWorkspaceStore((s) => s.setBottomPanelTab);
  const diagnostics = useDiagnosticsStore((s) => s.items);
  const logs = usePreviewStore((s) => s.logs);
  const { loadFile } = useWorkspace();

  const errorCount = diagnostics.filter((d) => d.severity === 'error').length;
  const warningCount = diagnostics.filter((d) => d.severity === 'warning').length;

  return (
    <div className="terminal-area" style={{ gridRow: 2, gridColumn: '3 / 5' }}>
      <div className="terminal-tabs">
        <div className={`terminal-tab ${tab === 'terminal' ? 'active' : ''}`} onClick={() => setTab('terminal')}>
          <div className="terminal-tab-dot td-gold"></div>
          Terminal
        </div>
        <div className={`terminal-tab ${tab === 'logs' ? 'active' : ''}`} onClick={() => setTab('logs')}>
          <div className="terminal-tab-dot td-blue"></div>
          Output
        </div>

        <div className={`terminal-tab ${tab === 'problems' ? 'active' : ''}`} onClick={() => setTab('problems')}>
          Problems
          {errorCount > 0 && <span style={{marginLeft: 4, color: 'var(--red)'}}>{errorCount}</span>}
          {warningCount > 0 && <span style={{marginLeft: 4, color: 'var(--yellow)'}}>{warningCount}</span>}
        </div>
        
        <div className="terminal-controls">
          <button className="terminal-btn">+</button>
          <button className="terminal-btn">^</button>
          <button className="terminal-btn" onClick={() => useWorkspaceStore.getState().toggleBottomPanel()}>✕</button>
        </div>
      </div>
      
      <div className="terminal-body" style={{ padding: tab === 'terminal' ? 0 : '12px 16px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'terminal' && <TerminalPanel />}
        
        {tab === 'logs' && <LogsTabContent logs={logs} />}
        
        {tab === 'problems' && (
          <ProblemsTabContent 
            diagnostics={diagnostics} 
            loadFile={loadFile} 
            errorCount={errorCount} 
            warningCount={warningCount} 
          />
        )}
      </div>
    </div>
  );
}
