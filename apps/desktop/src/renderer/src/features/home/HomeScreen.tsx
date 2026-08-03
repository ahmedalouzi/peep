import { useState } from 'react';
import { useAuthStore } from '../../stores/auth-store';
import { useWorkspaceStore } from '../../stores/workspace-store';
import { useWorkspace } from '../../hooks/useWorkspace';
import './HomeScreen.css';

export function HomeScreen() {
  const { user, settings, logout } = useAuthStore();
  const recentProjects = useWorkspaceStore((s) => s.recentProjects);
  const { openProjectFolder, openProjectByPath } = useWorkspace();
  const [showAllRecent, setShowAllRecent] = useState(false);
  const [activeMenu, setActiveMenu] = useState(false);

  const handleNewProject = () => {
    window.dispatchEvent(new CustomEvent('peep:new-project'));
  };

  const handleOpenSettings = () => {
    window.dispatchEvent(new CustomEvent('peep:open-settings'));
  };

  return (
    <div className="home-container">
      {/* Background glow effects */}
      <div className="home-bg-glow glow-top"></div>
      <div className="home-bg-glow glow-bottom"></div>

      {/* Top Header/Bar */}
      <header className="home-header">
        <div className="home-logo-section">
          <svg width="24" height="24" viewBox="0 0 32 32" fill="none" className="home-logo">
            <circle cx="16" cy="16" r="15" fill="#1e1e26" />
            <g stroke="#93c5fd" strokeWidth="1.8" fill="none" strokeLinecap="round">
              <ellipse cx="16" cy="16" rx="5" ry="10.5" transform="rotate(0 16 16)" />
              <ellipse cx="16" cy="16" rx="5" ry="10.5" transform="rotate(60 16 16)" />
              <ellipse cx="16" cy="16" rx="5" ry="10.5" transform="rotate(120 16 16)" />
            </g>
            <circle cx="16" cy="16" r="1.5" fill="#93c5fd" />
          </svg>
          <span className="home-brand">SYNKRO</span>
        </div>

        {/* Profile / Account Control */}
        {user && (
          <div className="home-profile-container">
            <button className="home-profile-bubble" onClick={() => setActiveMenu(!activeMenu)}>
              {user.email.charAt(0).toUpperCase()}
            </button>
            
            {activeMenu && (
              <div className="home-profile-dropdown">
                <div className="dropdown-info">
                  <div className="dropdown-email">{user.email}</div>
                  <div className="dropdown-plan">{user.plan || user.tier || 'Free Plan'}</div>
                </div>
                <div className="dropdown-divider"></div>
                <button className="dropdown-btn" onClick={() => { setActiveMenu(false); window.open('https://synkro.com/upgrade'); }}>
                  🚀 Upgrade Plan
                </button>
                <button className="dropdown-btn" onClick={() => { setActiveMenu(false); handleOpenSettings(); }}>
                  ⚙ Preferences
                </button>
                <button className="dropdown-btn logout" onClick={() => { setActiveMenu(false); void logout(); }}>
                  🚪 Sign Out
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="home-main">
        <div className="home-hero">
          <h1 className="home-title">Welcome to Synkro</h1>
          <p className="home-subtitle">Create, preview, and build applications autonomously.</p>
          {settings?.isDevBypassActive && (
            <div style={{
              margin: '12px auto 0 auto',
              padding: '6px 16px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: 'bold',
              color: '#f87171',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              width: 'max-content'
            }}>
              <span>⚠️ Development Auth Bypass Enabled</span>
            </div>
          )}
          
          {user && (
            <div className="home-plan-badge">
              <span className="plan-label">Plan:</span>
              <span className="plan-value">{(user.plan || user.tier || 'Free Plan').toUpperCase()}</span>
              <button className="plan-upgrade-btn" onClick={() => window.open('https://synkro.com/upgrade')}>
                Upgrade
              </button>
            </div>
          )}
        </div>

        {/* Action Cards Grid */}
        <div className="home-cards">
          <button className="home-card" onClick={() => void openProjectFolder()}>
            <div className="card-icon">📁</div>
            <div className="card-content">
              <h3>Open Project</h3>
              <p>Load an existing project workspace from your local disk.</p>
            </div>
          </button>

          <button className="home-card" onClick={handleNewProject}>
            <div className="card-icon">⚡</div>
            <div className="card-content">
              <h3>New Project</h3>
              <p>Initialize a fresh React Native or Flutter application template.</p>
            </div>
          </button>

          <button className="home-card" onClick={() => alert('Git clone feature is coming soon!')}>
            <div className="card-icon">🌐</div>
            <div className="card-content">
              <h3>Clone Repository</h3>
              <p>Clone a public or private repository directly from GitHub.</p>
            </div>
          </button>

          <button className="home-card" onClick={() => alert('SSH connection feature is coming soon!')}>
            <div className="card-icon">🔑</div>
            <div className="card-content">
              <h3>Connect via SSH</h3>
              <p>Establish a secure session to code on a remote server.</p>
            </div>
          </button>
        </div>

        {/* Recent Projects List */}
        <section className="home-recent-section">
          <div className="home-recent-header">
            <h2>Recent Projects</h2>
            {recentProjects.length > 5 && (
              <button className="home-recent-toggle" onClick={() => setShowAllRecent(!showAllRecent)}>
                {showAllRecent ? 'Show Less' : `Show All (${recentProjects.length})`}
              </button>
            )}
          </div>

          <div className="home-recent-list">
            {recentProjects.length === 0 ? (
              <div className="home-recent-empty">No projects opened recently</div>
            ) : (
              (showAllRecent ? recentProjects : recentProjects.slice(0, 5)).map((p) => (
                <button
                  key={p.id}
                  className="home-recent-item"
                  onClick={() => void openProjectByPath(p.path)}
                >
                  <span className="recent-folder-icon">📁</span>
                  <div className="recent-info">
                    <span className="recent-name">{p.name}</span>
                    <span className="recent-path">{p.path}</span>
                  </div>
                  <span className="recent-arrow">→</span>
                </button>
              ))
            )}
          </div>
        </section>
      </main>

      {/* Footer Banner */}
      <footer className="home-footer">
        <span>Try opening a new window to workspace multiple apps in parallel ↗</span>
      </footer>
    </div>
  );
}
