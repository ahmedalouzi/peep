import './KeyboardHelp.css';

interface KeyboardHelpProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { group: 'Navigation',   key: 'Ctrl+P',        desc: 'Quick file open' },
  { group: 'Navigation',   key: 'Ctrl+Shift+F',  desc: 'Find in project' },
  { group: 'Navigation',   key: 'Ctrl+`',        desc: 'Toggle terminal' },
  { group: 'Editor',       key: 'Ctrl+S',        desc: 'Save file' },
  { group: 'Editor',       key: 'Ctrl+Z',        desc: 'Undo' },
  { group: 'Editor',       key: 'Ctrl+Shift+Z',  desc: 'Redo' },
  { group: 'Editor',       key: 'Ctrl+/',        desc: 'Toggle comment' },
  { group: 'Editor',       key: 'F2',            desc: 'Rename symbol' },
  { group: 'Preview',      key: 'Ctrl+R',        desc: 'Refresh preview' },
  { group: 'Preview',      key: 'Ctrl+Shift+P',  desc: 'Start/stop preview' },
  { group: 'AI Agent',     key: 'Ctrl+Enter',    desc: 'Send message' },
  { group: 'AI Agent',     key: 'Escape',        desc: 'Cancel agent' },
  { group: 'App',          key: 'Ctrl+,',        desc: 'Open settings' },
  { group: 'App',          key: 'Ctrl+N',        desc: 'New project' },
  { group: 'App',          key: 'F1',            desc: 'Show keyboard shortcuts' },
];

const groups = [...new Set(SHORTCUTS.map((s) => s.group))];

export function KeyboardHelp({ open, onClose }: KeyboardHelpProps) {
  if (!open) return null;
  return (
    <div className="kbd-overlay" onClick={onClose}>
      <div className="kbd-modal" onClick={(e) => e.stopPropagation()}>
        <div className="kbd-modal__header">
          <span className="kbd-modal__title">⌨ Keyboard Shortcuts</span>
          <button type="button" className="btn btn-ghost" onClick={onClose}>×</button>
        </div>

        <div className="kbd-modal__body">
          {groups.map((group) => (
            <div key={group} className="kbd-group">
              <div className="kbd-group__title">{group}</div>
              <div className="kbd-group__items">
                {SHORTCUTS.filter((s) => s.group === group).map((s) => (
                  <div key={s.key} className="kbd-row">
                    <span className="kbd-desc">{s.desc}</span>
                    <kbd className="kbd-key">{s.key}</kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="kbd-modal__footer">
          <span>Press <kbd className="kbd-key-inline">F1</kbd> or <kbd className="kbd-key-inline">?</kbd> to toggle this panel</span>
        </div>
      </div>
    </div>
  );
}
