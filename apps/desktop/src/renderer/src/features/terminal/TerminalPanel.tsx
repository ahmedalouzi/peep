import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useWorkspaceStore } from '../../stores/workspace-store';
import './TerminalPanel.css';

interface TermInstance {
  id: string;
  name: string;
  term: Terminal;
  fit: FitAddon;
}

export function TerminalPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const project = useWorkspaceStore((s) => s.project);
  
  const [terminals, setTerminals] = useState<TermInstance[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  
  // Keep refs for event handlers to avoid stale closures
  const terminalsRef = useRef(terminals);
  terminalsRef.current = terminals;
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  // Initialize first terminal on mount
  useEffect(() => {
    if (!project) return;
    if (terminalsRef.current.length === 0) {
      addTerminal();
    }
  }, [project]);

  // Handle terminal output and exit events
  useEffect(() => {
    const unsubOutput = window.peep.onTerminalOutput(({ id, data }) => {
      const t = terminalsRef.current.find(x => x.id === id);
      if (t) t.term.write(data);
    });

    const unsubExit = window.peep.onTerminalExit(({ id, code }) => {
      const t = terminalsRef.current.find(x => x.id === id);
      if (t && code !== 0) t.term.writeln(`\r\n[process exited with code ${code}]`);
    });

    return () => {
      unsubOutput();
      unsubExit();
    };
  }, []);

  // Update DOM when active terminal changes
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    
    // Clear container
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    
    if (!activeId) return;
    
    const active = terminals.find(t => t.id === activeId);
    if (active && active.term.element) {
      container.appendChild(active.term.element);
      setTimeout(() => {
        active.fit.fit();
        active.term.focus();
      }, 50);
    }
  }, [activeId, terminals]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const active = terminals.find(t => t.id === activeId);
      if (active) active.fit.fit();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeId, terminals]);

  const addTerminal = () => {
    if (!project) return;
    const id = `term-${Date.now()}`;
    const name = `Terminal ${terminalsRef.current.length + 1}`;
    
    const term = new Terminal({
      theme: {
        background: '#0d1117',
        foreground: '#e6edf3',
        cursor: '#58a6ff',
        selectionBackground: '#264f78',
      },
      fontFamily: "'Cascadia Code', Consolas, monospace",
      fontSize: 12,
      cursorBlink: true,
      scrollback: 5000,
      convertEol: true,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    
    // We don't mount it to DOM yet, just create it. 
    // It will be mounted in the useEffect above when activeId changes.
    // Wait, xterm requires an element to be passed to open() before fit() can work.
    // We can create an invisible container for it.
    const tempDiv = document.createElement('div');
    term.open(tempDiv);
    
    term.onData((data) => {
      void window.peep.writeTerminal(id, data);
    });

    void window.peep.createTerminal({ id, cwd: project.path });

    setTerminals(prev => [...prev, { id, name, term, fit }]);
    setActiveId(id);
  };

  const removeTerminal = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const t = terminals.find(x => x.id === id);
    if (t) {
      t.term.dispose();
      void window.peep.destroyTerminal(id);
    }

    setTerminals(prev => {
      const next = prev.filter(x => x.id !== id);
      if (activeId === id) {
        setActiveId(next.length > 0 ? next[next.length - 1].id : null);
      }
      return next;
    });
  };

  if (!project) {
    return <div className="bottom-panel__empty">Open a project to use the terminal.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Terminal Tabs */}
      <div style={{ display: 'flex', background: 'var(--bg-base)', borderBottom: '1px solid var(--border)' }}>
        {terminals.map(t => (
          <div 
            key={t.id} 
            onClick={() => setActiveId(t.id)}
            style={{ 
              padding: '4px 10px', 
              fontSize: '11px', 
              cursor: 'pointer', 
              borderRight: '1px solid var(--border)',
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              background: activeId === t.id ? 'var(--bg-elevated)' : 'transparent',
              color: activeId === t.id ? 'var(--text-primary)' : 'var(--text-muted)'
            }}
          >
            <span>{t.name}</span>
            <button 
              onClick={(e) => removeTerminal(t.id, e)}
              style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, opacity: 0.6 }}
              title="Close terminal"
            >
              ✕
            </button>
          </div>
        ))}
        <button 
          onClick={addTerminal}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px 10px', fontSize: '14px' }}
          title="New Terminal"
        >
          +
        </button>
      </div>

      {/* Terminal Viewport */}
      <div 
        ref={containerRef} 
        style={{ flex: 1, padding: '4px', overflow: 'hidden' }} 
        onClick={() => {
          const active = terminals.find(t => t.id === activeId);
          if (active) active.term.focus();
        }}
      />
    </div>
  );
}
