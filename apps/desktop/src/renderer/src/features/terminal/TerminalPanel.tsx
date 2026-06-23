import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useWorkspaceStore } from '../../stores/workspace-store';
import './TerminalPanel.css';

const TERMINAL_ID = 'peep-main-terminal';

export function TerminalPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const project = useWorkspaceStore((s) => s.project);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || !project) return;

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
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();
    term.focus();

    terminalRef.current = term;
    fitRef.current = fit;

    void window.peep.createTerminal({ id: TERMINAL_ID, cwd: project.path });

    const unsubOutput = window.peep.onTerminalOutput(({ id, data }) => {
      if (id === TERMINAL_ID) term.write(data);
    });

    const unsubExit = window.peep.onTerminalExit(({ id, code }) => {
      if (id === TERMINAL_ID) term.writeln(`\r\n[process exited with code ${code}]`);
    });

    const onData = term.onData((data) => {
      console.log('[TerminalPanel] Keypress data:', JSON.stringify(data));
      void window.peep.writeTerminal(TERMINAL_ID, data);
    });

    const handleFocusClick = () => {
      term.focus();
    };
    const container = containerRef.current;
    container.addEventListener('click', handleFocusClick);

    const resizeObserver = new ResizeObserver(() => {
      fit.fit();
    });
    resizeObserver.observe(containerRef.current);

    initializedRef.current = true;

    return () => {
      container.removeEventListener('click', handleFocusClick);
      onData.dispose();
      unsubOutput();
      unsubExit();
      resizeObserver.disconnect();
      void window.peep.destroyTerminal(TERMINAL_ID);
      term.dispose();
      terminalRef.current = null;
      fitRef.current = null;
      initializedRef.current = false;
    };
  }, [project?.path]);

  if (!project) {
    return <div className="bottom-panel__empty">Open a project to use the terminal.</div>;
  }

  return <div ref={containerRef} className="terminal-panel" />;
}
