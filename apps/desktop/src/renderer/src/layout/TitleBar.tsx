import { useEffect, useState, useRef } from 'react';
import { useWorkspace } from '../hooks/useWorkspace';
import './TitleBar.css';

interface TitleBarProps {
  onNewProject: () => void;
}

export function TitleBar({ onNewProject }: TitleBarProps) {
  const { project, openProjectFolder, toggleBottomPanel, toggleSidebar, toggleAgentPane } = useWorkspace();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menusRef.current && !menusRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleMenu = (menu: string) => {
    setActiveMenu(activeMenu === menu ? null : menu);
  };

  const handleMenuClick = (action: () => void) => {
    setActiveMenu(null);
    action();
  };

  return (
    <header className="title-bar">
      {/* Left: Brand + Menus */}
      <div className="title-bar__left">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="title-bar__logo-svg"
        >
          <path d="M4 19L12 5L20 19" />
          <path d="M7.5 13.5L16.5 13.5" />
        </svg>
        <div className="title-bar__menus" ref={menusRef}>
          {/* File Menu */}
          <div className="title-menu-wrapper">
            <button className={`title-menu-item ${activeMenu === 'file' ? 'active' : ''}`} onClick={() => toggleMenu('file')}>File</button>
            {activeMenu === 'file' && (
              <div className="title-menu-dropdown">
                <button className="dropdown-item" onClick={() => handleMenuClick(() => onNewProject())}>
                  <span>New Project...</span>
                  <span className="dropdown-shortcut">Ctrl+Shift+P</span>
                </button>
                <button className="dropdown-item" onClick={() => handleMenuClick(() => console.log('New Text File'))}>
                  <span>New Text File</span>
                  <span className="dropdown-shortcut">Ctrl+N</span>
                </button>
                <button className="dropdown-item" onClick={() => handleMenuClick(() => console.log('New File'))}>
                  <span>New File...</span>
                  <span className="dropdown-shortcut">Ctrl+Alt+Windows+N</span>
                </button>
                <button className="dropdown-item" onClick={() => handleMenuClick(() => console.log('New Window'))}>
                  <span>New Window</span>
                  <span className="dropdown-shortcut">Ctrl+Shift+N</span>
                </button>
                <button className="dropdown-item" onClick={() => handleMenuClick(() => console.log('New Window with Profile'))}>
                  <span>New Window with Profile</span>
                  <span className="dropdown-shortcut">›</span>
                </button>
                <div className="dropdown-separator" />
                
                <button className="dropdown-item" onClick={() => handleMenuClick(() => console.log('Open File'))}>
                  <span>Open File...</span>
                  <span className="dropdown-shortcut">Ctrl+O</span>
                </button>
                <button className="dropdown-item" onClick={() => handleMenuClick(() => void openProjectFolder())}>
                  <span>Open Folder...</span>
                  <span className="dropdown-shortcut">Ctrl+K Ctrl+O</span>
                </button>
                <button className="dropdown-item" onClick={() => handleMenuClick(() => console.log('Open Workspace from File'))}>
                  <span>Open Workspace from File...</span>
                </button>
                <button className="dropdown-item" onClick={() => handleMenuClick(() => console.log('Open Recent'))}>
                  <span>Open Recent</span>
                  <span className="dropdown-shortcut">›</span>
                </button>
                <div className="dropdown-separator" />

                <button className="dropdown-item" onClick={() => handleMenuClick(() => console.log('Add Folder to Workspace'))}>
                  <span>Add Folder to Workspace...</span>
                </button>
                <button className="dropdown-item" onClick={() => handleMenuClick(() => console.log('Save Workspace As'))}>
                  <span>Save Workspace As...</span>
                </button>
                <button className="dropdown-item" onClick={() => handleMenuClick(() => console.log('Duplicate Workspace'))}>
                  <span>Duplicate Workspace</span>
                </button>
                <div className="dropdown-separator" />

                <button className="dropdown-item" onClick={() => handleMenuClick(() => console.log('Save'))}>
                  <span>Save</span>
                  <span className="dropdown-shortcut">Ctrl+S</span>
                </button>
                <button className="dropdown-item" onClick={() => handleMenuClick(() => console.log('Save As'))}>
                  <span>Save As...</span>
                  <span className="dropdown-shortcut">Ctrl+Shift+S</span>
                </button>
                <button className="dropdown-item" onClick={() => handleMenuClick(() => console.log('Save All'))}>
                  <span>Save All</span>
                  <span className="dropdown-shortcut">Ctrl+K S</span>
                </button>
                <div className="dropdown-separator" />

                <button className="dropdown-item" onClick={() => handleMenuClick(() => console.log('Share'))}>
                  <span>Share</span>
                  <span className="dropdown-shortcut">›</span>
                </button>
                <div className="dropdown-separator" />

                <button className="dropdown-item" onClick={() => handleMenuClick(() => console.log('Auto Save'))}>
                  <span>Auto Save</span>
                </button>
                <button className="dropdown-item" onClick={() => handleMenuClick(() => console.log('Preferences'))}>
                  <span>Preferences</span>
                  <span className="dropdown-shortcut">›</span>
                </button>
                <div className="dropdown-separator" />

                <button className="dropdown-item" onClick={() => handleMenuClick(() => console.log('Revert File'))}>
                  <span>Revert File</span>
                </button>
                <button className="dropdown-item" onClick={() => handleMenuClick(() => console.log('Close Editor'))}>
                  <span>Close Editor</span>
                  <span className="dropdown-shortcut">Ctrl+F4</span>
                </button>
                <button className="dropdown-item" onClick={() => handleMenuClick(() => console.log('Close Folder'))}>
                  <span>Close Folder</span>
                  <span className="dropdown-shortcut">Ctrl+K F</span>
                </button>
                <button className="dropdown-item" onClick={() => handleMenuClick(() => console.log('Close Window'))}>
                  <span>Close Window</span>
                  <span className="dropdown-shortcut">Alt+F4</span>
                </button>
                <div className="dropdown-separator" />

                <button className="dropdown-item" onClick={() => handleMenuClick(() => window.close())}>
                  <span>Exit</span>
                </button>
              </div>
            )}
          </div>

          {/* Edit Menu */}
          <div className="title-menu-wrapper">
            <button className={`title-menu-item ${activeMenu === 'edit' ? 'active' : ''}`} onClick={() => toggleMenu('edit')}>Edit</button>
            {activeMenu === 'edit' && (
              <div className="title-menu-dropdown">
                <button className="dropdown-item" onClick={() => handleMenuClick(() => document.execCommand('undo'))}>
                  <span>Undo</span>
                  <span className="dropdown-shortcut">Ctrl+Z</span>
                </button>
                <button className="dropdown-item" onClick={() => handleMenuClick(() => document.execCommand('redo'))}>
                  <span>Redo</span>
                  <span className="dropdown-shortcut">Ctrl+Y</span>
                </button>
                <div className="dropdown-separator" />
                <button className="dropdown-item" onClick={() => handleMenuClick(() => document.execCommand('cut'))}>
                  <span>Cut</span>
                  <span className="dropdown-shortcut">Ctrl+X</span>
                </button>
                <button className="dropdown-item" onClick={() => handleMenuClick(() => document.execCommand('copy'))}>
                  <span>Copy</span>
                  <span className="dropdown-shortcut">Ctrl+C</span>
                </button>
                <button className="dropdown-item" onClick={() => handleMenuClick(() => document.execCommand('paste'))}>
                  <span>Paste</span>
                  <span className="dropdown-shortcut">Ctrl+V</span>
                </button>
              </div>
            )}
          </div>

          <button className="title-menu-item">Selection</button>
          
          {/* View Menu */}
          <div className="title-menu-wrapper">
            <button className={`title-menu-item ${activeMenu === 'view' ? 'active' : ''}`} onClick={() => toggleMenu('view')}>View</button>
            {activeMenu === 'view' && (
              <div className="title-menu-dropdown">
                <button className="dropdown-item" onClick={() => handleMenuClick(() => toggleBottomPanel())}>
                  <span>Toggle Terminal</span>
                  <span className="dropdown-shortcut">Ctrl+`</span>
                </button>
              </div>
            )}
          </div>

          <button className="title-menu-item">Go</button>
          <button className="title-menu-item">Run</button>
          
          {/* Terminal Menu */}
          <div className="title-menu-wrapper">
            <button className={`title-menu-item ${activeMenu === 'terminal' ? 'active' : ''}`} onClick={() => toggleMenu('terminal')}>Terminal</button>
            {activeMenu === 'terminal' && (
              <div className="title-menu-dropdown">
                <button className="dropdown-item" onClick={() => handleMenuClick(() => toggleBottomPanel())}>
                  <span>New Terminal</span>
                  <span className="dropdown-shortcut">Ctrl+Shift+`</span>
                </button>
              </div>
            )}
          </div>

          {/* Help Menu */}
          <div className="title-menu-wrapper">
            <button className={`title-menu-item ${activeMenu === 'help' ? 'active' : ''}`} onClick={() => toggleMenu('help')}>Help</button>
            {activeMenu === 'help' && (
              <div className="title-menu-dropdown">
                <button className="dropdown-item" onClick={() => handleMenuClick(() => alert('Antigravity IDE v0.1.0'))}>
                  <span>About</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Center: Title */}
      <div className="title-bar__center">
        {project ? `${project.name} - Antigravity IDE` : 'Antigravity IDE'}
      </div>

      {/* Right: Window Controls */}
      <div className="title-bar__right">
        <div className="title-bar__layout-controls">
          <button className="layout-btn" title="Toggle Sidebar" onClick={toggleSidebar}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
          </button>
          <button className="layout-btn" title="Toggle Bottom Panel" onClick={toggleBottomPanel}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="15" x2="21" y2="15"/></svg>
          </button>
          <button className="layout-btn" title="Toggle Agent Pane" onClick={toggleAgentPane}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
          </button>
        </div>
      </div>
    </header>
  );
}
