import { useState, useRef, useEffect } from 'react';
import { useWorkspaceStore } from '../stores/workspace-store';
import { usePreviewStore } from '../stores/preview-store';
import { useWorkspace } from '../hooks/useWorkspace';
import { useAuthStore } from '../stores/auth-store';
import { DEVICES } from './PreviewPane';
import './TitleBar.css';

interface TitleBarProps {
  onNewProject: () => void;
}

export function TitleBar({ onNewProject }: TitleBarProps) {
  const { project } = useWorkspace();
  const { user, settings, logout } = useAuthStore();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
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
    action();
    setActiveMenu(null);
  };

  const toggleSidebar = () => useWorkspaceStore.getState().toggleSidebar();
  const toggleBottomPanel = () => useWorkspaceStore.getState().toggleBottomPanel();
  const toggleAgentPane = () => useWorkspaceStore.getState().toggleAgentPane();
  const togglePreviewPane = () => {
    const state = useWorkspaceStore.getState();
    state.setPreviewPaneOpen(!state.previewPaneOpen);
  };

  return (
    <>
      {/* ── TITLE BAR ── */}
      <div className="titlebar">
        <div className="titlebar-dots">
          <div className="titlebar-dot dot-red" onClick={() => window.peep.exitApp()}></div>
          <div className="titlebar-dot dot-yellow" onClick={() => window.peep.minimizeWindow()}></div>
          <div className="titlebar-dot dot-green" onClick={() => window.peep.maximizeWindow()}></div>
        </div>
        <div className="titlebar-title">
          <div className="titlebar-logo">Sy</div>
          {project ? `${project.name} — Synkro` : 'Synkro'}
        </div>
      </div>

      {/* ── MENU BAR ── */}
      <div className="menubar" ref={menuRef}>
        
        {/* File Menu */}
        <div style={{ position: 'relative' }}>
          <div className={`menu-item ${activeMenu === 'file' ? 'active' : ''}`} onClick={() => toggleMenu('file')}>File</div>
          {activeMenu === 'file' && (
            <div className="title-menu-dropdown" style={{ top: '100%', left: 0 }}>
              <button className="dropdown-item" onClick={() => handleMenuClick(onNewProject)}>
                <span>New Project...</span>
                <span className="dropdown-shortcut">Ctrl+Alt+N</span>
              </button>
              <button className="dropdown-item" onClick={() => handleMenuClick(() => window.peep.newWindow())}>
                <span>New Window</span>
                <span className="dropdown-shortcut">Ctrl+Shift+N</span>
              </button>
              <div className="dropdown-separator" />
              <button className="dropdown-item" onClick={async () => {
                const result = await window.peep.openFile();
                if (result) {
                  const name = result.path.split(/[/\\]/).pop() || 'Unknown';
                  useWorkspaceStore.getState().openFile({
                    path: result.path,
                    name,
                    content: result.content,
                    dirty: false,
                  });
                }
                setActiveMenu(null);
              }}>
                <span>Open File...</span>
                <span className="dropdown-shortcut">Ctrl+O</span>
              </button>
              <button className="dropdown-item" onClick={async () => {
                const project = await window.peep.openFolder();
                if (project) {
                  useWorkspaceStore.getState().setProject(project);
                  const tree = await window.peep.listDir(project.path);
                  useWorkspaceStore.getState().setFileTree(tree);
                }
                setActiveMenu(null);
              }}>
                <span>Open Folder...</span>
                <span className="dropdown-shortcut">Ctrl+K Ctrl+O</span>
              </button>
              <div className="dropdown-separator" />
              <button className="dropdown-item" onClick={() => handleMenuClick(() => window.dispatchEvent(new CustomEvent('peep:save-file')))}>
                <span>Save</span>
                <span className="dropdown-shortcut">Ctrl+S</span>
              </button>
              <button className="dropdown-item" onClick={() => handleMenuClick(() => {
                const state = useWorkspaceStore.getState();
                state.setProject(null);
                state.setFileTree([]);
                state.setActiveFile(null);
              })}>
                <span>Close Folder</span>
                <span className="dropdown-shortcut">Ctrl+K F</span>
              </button>
              <div className="dropdown-separator" />
              <button className="dropdown-item" onClick={() => handleMenuClick(() => window.dispatchEvent(new CustomEvent('peep:open-settings')))}>
                <span>Preferences</span>
              </button>
              <div className="dropdown-separator" />
              <button className="dropdown-item" onClick={() => handleMenuClick(() => window.peep.exitApp())}>
                <span>Exit</span>
                <span className="dropdown-shortcut">Alt+F4</span>
              </button>
            </div>
          )}
        </div>

        {/* Edit Menu */}
        <div style={{ position: 'relative' }}>
          <div className={`menu-item ${activeMenu === 'edit' ? 'active' : ''}`} onClick={() => toggleMenu('edit')}>Edit</div>
          {activeMenu === 'edit' && (
            <div className="title-menu-dropdown" style={{ top: '100%', left: 0 }}>
              <button className="dropdown-item" onClick={() => handleMenuClick(() => document.execCommand('undo'))}>
                <span>Undo</span>
                <span className="dropdown-shortcut">Ctrl+Z</span>
              </button>
              <button className="dropdown-item" onClick={() => handleMenuClick(() => document.execCommand('redo'))}>
                <span>Redo</span>
                <span className="dropdown-shortcut">Ctrl+Y</span>
              </button>
            </div>
          )}
        </div>

        <div className="menu-item">Selection</div>
        
        {/* View Menu */}
        <div style={{ position: 'relative' }}>
          <div className={`menu-item ${activeMenu === 'view' ? 'active' : ''}`} onClick={() => toggleMenu('view')}>View</div>
          {activeMenu === 'view' && (
            <div className="title-menu-dropdown" style={{ top: '100%', left: 0 }}>
              <button className="dropdown-item" onClick={() => handleMenuClick(toggleSidebar)}>
                <span>Toggle Sidebar</span>
                <span className="dropdown-shortcut">Ctrl+B</span>
              </button>
              <button className="dropdown-item" onClick={() => handleMenuClick(toggleBottomPanel)}>
                <span>Toggle Terminal</span>
                <span className="dropdown-shortcut">Ctrl+`</span>
              </button>
            </div>
          )}
        </div>

        <div className="menu-item">Go</div>
        <div className="menu-item">Run</div>
        
        {/* Terminal Menu */}
        <div style={{ position: 'relative' }}>
          <div className={`menu-item ${activeMenu === 'terminal' ? 'active' : ''}`} onClick={() => toggleMenu('terminal')}>Terminal</div>
          {activeMenu === 'terminal' && (
            <div className="title-menu-dropdown" style={{ top: '100%', left: 0 }}>
              <button className="dropdown-item" onClick={() => handleMenuClick(toggleBottomPanel)}>
                <span>New Terminal</span>
                <span className="dropdown-shortcut">Ctrl+Shift+`</span>
              </button>
            </div>
          )}
        </div>

        {/* Help Menu */}
        <div style={{ position: 'relative' }}>
          <div className={`menu-item ${activeMenu === 'help' ? 'active' : ''}`} onClick={() => toggleMenu('help')}>Help</div>
          {activeMenu === 'help' && (
            <div className="title-menu-dropdown" style={{ top: '100%', left: 0 }}>
              <button className="dropdown-item" onClick={() => handleMenuClick(() => alert('Synkro v0.1.0'))}>
                <span>About</span>
              </button>
            </div>
          )}
        </div>

        <div style={{ flex: 1, WebkitAppRegion: 'drag' } as any}></div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', paddingRight: '8px', WebkitAppRegion: 'no-drag' } as any}>
          <button className="layout-btn" onClick={toggleBottomPanel} title="Toggle Terminal">
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h11A1.5 1.5 0 0 1 15 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9zm1.5-.5a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-11z"/>
              <path d="M2 10.5h12v-1H2v1z"/>
            </svg>
          </button>
          <div style={{ position: 'relative' }}>
            <button className={`layout-btn ${activeMenu === 'preview-devices' ? 'active' : ''}`} onClick={() => toggleMenu('preview-devices')} title="Select Device & Toggle Preview">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
                <rect x="4" y="1.5" width="8" height="13" rx="1.5" ry="1.5" />
                <line x1="8" y1="12.5" x2="8.01" y2="12.5" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            {activeMenu === 'preview-devices' && (
              <div className="title-menu-dropdown" style={{ top: '100%', right: 0, left: 'auto', minWidth: '180px' }}>
                <button className="dropdown-item" onClick={() => handleMenuClick(togglePreviewPane)}>
                  <span>{useWorkspaceStore.getState().previewPaneOpen ? 'Hide Preview Pane' : 'Show Preview Pane'}</span>
                </button>
                <div className="dropdown-separator" />
                <div style={{ padding: '4px 10px', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Devices</div>
                {DEVICES.map((d) => {
                   const isActive = usePreviewStore.getState().deviceId === d.id;
                   return (
                     <button key={d.id} className="dropdown-item" onClick={() => handleMenuClick(() => usePreviewStore.getState().setDeviceId(d.id))}>
                       <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                         {isActive ? (
                           <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                         ) : (
                           <div style={{ width: 12, height: 12 }} />
                         )}
                         {d.label}
                       </span>
                     </button>
                   );
                })}
              </div>
            )}
          </div>
          <button className="layout-btn" onClick={toggleAgentPane} title="Toggle Chat">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M3 3h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H4.5l-2.5 2V4a1 1 0 0 1 1-1z" />
            </svg>
          </button>

          {/* User Account Menu similar to Antigravity */}
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '6px' }}>
              {settings?.isDevBypassActive && (
                <div style={{
                  fontSize: '9px',
                  background: '#ef4444',
                  color: '#fff',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  fontWeight: 'bold',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  border: '1px solid rgba(255,255,255,0.2)',
                  whiteSpace: 'nowrap'
                }} title="Development Authentication Bypass Active">
                  Dev Mode
                </div>
              )}
              <div style={{ position: 'relative' }}>
              <button 
                className={`layout-btn avatar-btn ${activeMenu === 'user-account' ? 'active' : ''}`}
                onClick={() => toggleMenu('user-account')}
                title="Account Menu"
                style={{ 
                  width: '24px', 
                  height: '24px', 
                  borderRadius: '50%', 
                  background: 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%)',
                  color: '#fff',
                  fontWeight: 'bold',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  border: '1px solid rgba(255,255,255,0.1)',
                  padding: 0
                }}
              >
                {user.email.charAt(0).toUpperCase()}
              </button>
              
              {activeMenu === 'user-account' && (
                <div 
                  className="title-menu-dropdown user-dropdown" 
                  style={{ 
                    top: '100%', 
                    right: 0, 
                    left: 'auto', 
                    minWidth: '240px',
                    padding: '12px',
                    background: '#121218',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  {/* User info */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {settings?.isDevBypassActive && (
                      <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#ef4444', marginBottom: '2px' }}>⚠️ DEV AUTH BYPASS ENABLED</span>
                    )}
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</span>
                    <span style={{ 
                      fontSize: '10px', 
                      fontWeight: '700', 
                      color: '#a78bfa',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      {user.plan || user.tier || 'Free Plan'}
                    </span>
                  </div>

                  {/* Quota Usage */}
                  {user.budgetTokens !== undefined && user.usedTokens !== undefined && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8' }}>
                        <span>Token Quota</span>
                        <span>{((user.usedTokens || 0) / 1000).toFixed(1)}K / {((user.budgetTokens || 1000000) / 1000000).toFixed(1)}M</span>
                      </div>
                      <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ 
                          width: `${Math.min(100, ((user.usedTokens || 0) / (user.budgetTokens || 1000000)) * 100)}%`, 
                          height: '100%', 
                          background: '#a78bfa',
                          borderRadius: '2px'
                        }} />
                      </div>
                    </div>
                  )}

                  {/* Quota Cost */}
                  {user.budgetCost !== undefined && user.usedCost !== undefined && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8' }}>
                        <span>Budget Usage</span>
                        <span>${(user.usedCost || 0).toFixed(2)} / ${(user.budgetCost || 10).toFixed(2)}</span>
                      </div>
                      <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ 
                          width: `${Math.min(100, ((user.usedCost || 0) / (user.budgetCost || 10)) * 100)}%`, 
                          height: '100%', 
                          background: '#60a5fa',
                          borderRadius: '2px'
                        }} />
                      </div>
                    </div>
                  )}

                  <div className="dropdown-separator" style={{ margin: '4px 0' }} />

                  {/* Actions */}
                  <button 
                    className="dropdown-item" 
                    onClick={() => handleMenuClick(() => window.open('https://synkro.com/upgrade'))}
                    style={{ padding: '6px 8px', borderRadius: '4px', fontSize: '12px', color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    🚀 Upgrade / Manage Plan
                  </button>

                  <button 
                    className="dropdown-item" 
                    onClick={() => handleMenuClick(() => window.dispatchEvent(new CustomEvent('peep:open-settings')))}
                    style={{ padding: '6px 8px', borderRadius: '4px', fontSize: '12px', color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    ⚙ Settings
                  </button>

                  <button 
                    className="dropdown-item" 
                    onClick={() => handleMenuClick(() => void logout())}
                    style={{ padding: '6px 8px', borderRadius: '4px', fontSize: '12px', color: '#f87171', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    🚪 Sign Out
                  </button>
                </div>
              )}
            </div>
            </div>
          )}
        </div>

      </div>
    </>
  );
}
