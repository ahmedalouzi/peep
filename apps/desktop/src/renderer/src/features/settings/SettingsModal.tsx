import { useEffect, useState, useCallback } from 'react';
import type { Settings } from '@peep/shared';
import './SettingsModal.css';

type SettingsTab = 'account' | 'local_ai' | 'sdk' | 'telemetry' | 'about';

interface AccountInfo {
  email: string;
  plan: string;
  usedCost: number;
  budgetCost: number;
  usedTokens: number;
  budgetTokens: number;
  gatewayConnected: boolean;
}

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [tab, setTab] = useState<SettingsTab>('account');
  const [flutterPath, setFlutterPath] = useState('');
  const [saving, setSaving] = useState(false);
  const [sdkVersion, setSdkVersion] = useState<string | null>(null);
  const [telemetryEnabled, setTelemetryEnabled] = useState<boolean | null>(null);
  const [version, setVersion] = useState<string>('');
  const [perfInfo, setPerfInfo] = useState<{ heapUsedMB: number; rssMemMB: number } | null>(null);
  const [updateInfo, setUpdateInfo] = useState<any>({ status: 'idle' });

  // Account state — session auth only, never provider API keys
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [accountLoading, setAccountLoading] = useState(false);

  const [authMode, setAuthMode] = useState<'signin' | 'signup' | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  // Local AI State
  const [aiProvider, setAiProvider] = useState('gemini');
  const [aiProviderApiKey, setAiProviderApiKey] = useState('');
  const [aiProviderApiKeyConfigured, setAiProviderApiKeyConfigured] = useState(false);
  const [developerMode, setDeveloperMode] = useState(false);

  const loadAccount = useCallback(async (settings: Settings) => {
    setAccountLoading(true);
    try {
      // SECURITY: sessionToken is NEVER sent to the renderer.
      // Use the sessionConfigured boolean flag instead to determine auth state.
      const hasSession = !!settings.sessionConfigured;
      setSessionActive(hasSession);

      if (hasSession) {
        const info = await window.peep.authGetAccount();
        if (info) {
          setAccount({
            email: info.email,
            plan: info.tier || info.plan || 'free',
            usedCost: info.usedCost ?? info.usage ?? 0,
            budgetCost: info.budgetCost ?? info.limit ?? 0,
            usedTokens: info.usedTokens || 0,
            budgetTokens: info.budgetTokens || 0,
            gatewayConnected: info.gatewayConnected ?? true,
          });
        } else {
          setSessionActive(false);
          setAccount(null);
        }
      } else {
        setAccount(null);
      }
    } finally {
      setAccountLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void window.peep.getSettings().then((s) => {
      setFlutterPath(s.flutterSdkPath ?? '');
      setAiProvider(s.aiProvider || 'gemini');
      setAiProviderApiKeyConfigured(!!s.aiProviderApiKeyConfigured);
      setDeveloperMode(!!s.developerMode);
      void loadAccount(s);
    });
    void window.peep.detectFlutterSdk().then((sdk) => setSdkVersion(sdk?.version ?? null));
    void window.peep.getTelemetryEnabled().then(setTelemetryEnabled);
    void window.peep.getVersion().then(setVersion);
  }, [open, loadAccount]);

  useEffect(() => {
    if (tab === 'about') {
      void (window.peep as any).getPerformanceInfo?.()?.then((info: any) => setPerfInfo(info));
      void window.peep.getUpdateStatus?.().then((info) => setUpdateInfo(info || { status: 'idle' }));
    }
  }, [tab]);

  useEffect(() => {
    if (!open) return;
    const unsubUpdate = window.peep.onUpdateStatus?.((info) => setUpdateInfo(info));
    return () => {
      unsubUpdate?.();
    };
  }, [open]);

  if (!open) return null;

  const handleClose = () => {
    window.dispatchEvent(new CustomEvent('peep:settings-closed'));
    onClose();
  };

  const handleSaveSdk = async () => {
    setSaving(true);
    try {
      const partial: Partial<Settings> = {
        flutterSdkPath: flutterPath || undefined,
      };
      await window.peep.setSettings(partial);
      handleClose();
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLocalAi = async () => {
    setSaving(true);
    try {
      const partial: Partial<Settings> = { aiProvider };
      // Only update the key if the user typed a new one.
      if (aiProviderApiKey) {
        partial.aiProviderApiKey = aiProviderApiKey;
      }
      await window.peep.setSettings(partial);
      // Update local state to show it's configured
      if (aiProviderApiKey) {
        setAiProviderApiKeyConfigured(true);
        setAiProviderApiKey('');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleTelemetryToggle = async (enabled: boolean) => {
    setTelemetryEnabled(enabled);
    await window.peep.setTelemetryEnabled(enabled);
  };

  const handleDeveloperModeToggle = async (enabled: boolean) => {
    setDeveloperMode(enabled);
    await window.peep.setSettings({ developerMode: enabled });
    if (!enabled && tab === 'local_ai') {
      setTab('account');
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthBusy(true);
    setAuthError('');
    try {
      const res = authMode === 'signin' 
        ? await window.peep.authSignIn(email, password)
        : await window.peep.authSignUp(email, password);
      
      if (!res.success) {
        setAuthError(res.error || 'Authentication failed');
      } else {
        setAuthMode(null);
        setEmail('');
        setPassword('');
        const s = await window.peep.getSettings();
        await loadAccount(s);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = async () => {
    setAccountLoading(true);
    await window.peep.authLogout();
    const s = await window.peep.getSettings();
    await loadAccount(s);
  };

  const TABS: { id: SettingsTab; label: string; hidden?: boolean }[] = [
    { id: 'account', label: '👤 Account' },
    { id: 'local_ai', label: '🤖 Local AI', hidden: !developerMode },
    { id: 'sdk', label: '🔧 SDK' },
    { id: 'telemetry', label: '🔒 Privacy' },
    { id: 'about', label: 'ℹ About' },
  ];

  const usedPct = account ? Math.min(100, (account.usedCost / account.budgetCost) * 100) : 0;
  const quotaColor = usedPct > 90 ? '#f44336' : usedPct > 70 ? '#ff9800' : '#4CAF50';

  return (
    <div className="settings-overlay" onClick={handleClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="settings-modal__header">
          <h2>Settings</h2>
          <button type="button" className="btn btn-ghost" onClick={handleClose}>×</button>
        </div>

        {/* Tabs */}
        <div className="settings-tabs">
          {TABS.filter(t => !t.hidden).map((t) => (
            <button
              key={t.id}
              type="button"
              className={`settings-tab ${tab === t.id ? 'settings-tab--active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="settings-modal__body">

          {/* ── Account ── */}
          {tab === 'account' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
                AI capabilities are powered by the Synkro Gateway. No provider API keys are ever
                stored on this device.
              </p>

              {accountLoading ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  Loading account…
                </div>
              ) : authMode ? (
                <form onSubmit={handleAuthSubmit} style={{ padding: '20px', background: 'var(--bg-card)', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ fontWeight: '600', fontSize: '15px' }}>{authMode === 'signin' ? 'Sign In' : 'Sign Up'}</div>
                  
                  {authError && (
                    <div style={{ padding: '10px', background: 'rgba(244,67,54,0.1)', color: '#f44336', borderRadius: '6px', fontSize: '12px' }}>
                      {authError}
                    </div>
                  )}

                  <label className="settings-field">
                    <span>Email</span>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={authBusy} autoFocus />
                  </label>
                  
                  <label className="settings-field">
                    <span>Password</span>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} required disabled={authBusy} minLength={8} />
                  </label>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    <button type="submit" className="btn btn-primary" disabled={authBusy} style={{ flex: 1 }}>
                      {authBusy ? 'Please wait…' : authMode === 'signin' ? 'Sign In' : 'Create Account'}
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => { setAuthMode(null); setAuthError(''); }} disabled={authBusy}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : !sessionActive || !account ? (
                /* ── Signed-out state ── */
                <div style={{ padding: '20px', background: 'var(--bg-card)', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', textAlign: 'center' }}>
                  <div style={{ fontSize: '36px' }}>🔐</div>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '15px', marginBottom: '6px' }}>Not signed in</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      Sign in to your Synkro account to unlock AI features.<br />
                      You will never be asked to enter a provider API key.
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                    <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={() => setAuthMode('signin')}>
                      Sign In
                    </button>
                    <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setAuthMode('signup')}>
                      Sign Up
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Signed-in state ── */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Account card */}
                  <div style={{ padding: '16px', background: 'var(--bg-card)', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Account</span>
                      <span style={{ fontSize: '11px', color: '#4CAF50', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '6px', height: '6px', background: '#4CAF50', borderRadius: '50%', display: 'inline-block' }} />
                        Gateway Connected
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Email</span>
                      <span style={{ fontWeight: '500' }}>{account.email}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Plan</span>
                      <span style={{
                        background: 'linear-gradient(135deg, #667eea, #764ba2)',
                        color: '#fff',
                        padding: '2px 10px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '700',
                        letterSpacing: '0.05em'
                      }}>
                        {account.plan.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Usage card */}
                  <div style={{ padding: '16px', background: 'var(--bg-card)', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Monthly Usage</span>

                    {/* Cost quota */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '5px' }}>
                        <span>Cost</span>
                        <span style={{ fontWeight: '600' }}>
                          ${account.usedCost.toFixed(2)} <span style={{ color: 'var(--text-muted)', fontWeight: '400' }}>/ ${account.budgetCost.toFixed(2)}</span>
                        </span>
                      </div>
                      <div style={{ height: '6px', background: 'rgba(128,128,128,0.15)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${usedPct}%`, height: '100%', background: quotaColor, borderRadius: '3px', transition: 'width 0.4s ease' }} />
                      </div>
                    </div>

                    {/* Token quota */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '5px' }}>
                        <span>Tokens</span>
                        <span style={{ fontWeight: '600' }}>
                          {(account.usedTokens / 1000).toFixed(1)}K <span style={{ color: 'var(--text-muted)', fontWeight: '400' }}>/ {(account.budgetTokens / 1000000).toFixed(1)}M</span>
                        </span>
                      </div>
                      <div style={{ height: '6px', background: 'rgba(128,128,128,0.15)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${Math.min(100, (account.usedTokens / account.budgetTokens) * 100)}%`,
                          height: '100%',
                          background: '#667eea',
                          borderRadius: '3px',
                          transition: 'width 0.4s ease'
                        }} />
                      </div>
                    </div>

                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                      Usage is tracked and enforced server-side. Resets monthly.
                    </p>
                  </div>

                  {/* Gateway connection status */}
                  <div style={{ padding: '12px 16px', background: 'var(--bg-card)', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Synkro AI Gateway</span>
                    {account.gatewayConnected ? (
                      <span style={{ color: '#4CAF50', fontWeight: '600', fontSize: '12px' }}>✓ Operational</span>
                    ) : (
                      <span style={{ color: '#f44336', fontWeight: '600', fontSize: '12px' }}>⚠ Unreachable</span>
                    )}
                  </div>

                  {/* Security notice and Logout */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.6, padding: '0 2px', flex: 1 }}>
                      🔒 Provider API keys (OpenAI, Gemini, Anthropic) are never stored on this device.
                      All AI requests are routed securely through the Synkro Gateway.
                    </div>
                    <button type="button" className="btn btn-ghost" style={{ fontSize: '12px', padding: '4px 8px', marginLeft: '10px' }} onClick={handleLogout}>
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Local AI ── */}
          {tab === 'local_ai' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
                  If you do not have a Synkro SaaS account, you can configure a local AI provider here. 
                  The API key will be encrypted and stored securely on your local device.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <label className="settings-field">
                  <span>AI Provider</span>
                  <select
                    value={aiProvider}
                    onChange={(e) => setAiProvider(e.target.value)}
                    style={{
                      background: 'var(--bg-input)',
                      color: 'var(--text)',
                      border: '1px solid var(--border)',
                      padding: '8px',
                      borderRadius: '6px',
                      fontSize: '13px'
                    }}
                  >
                    <option value="gemini">Google Gemini</option>
                    <option value="openai">OpenAI (Coming Soon)</option>
                    <option value="anthropic">Anthropic (Coming Soon)</option>
                    <option value="ollama">Local Ollama (Coming Soon)</option>
                  </select>
                </label>

                <label className="settings-field">
                  <span>Provider API Key</span>
                  <input
                    type="password"
                    placeholder={aiProviderApiKeyConfigured ? "•••••••••••••••• (Configured)" : "Enter API Key..."}
                    value={aiProviderApiKey}
                    onChange={(e) => setAiProviderApiKey(e.target.value)}
                  />
                </label>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    onClick={handleSaveLocalAi}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save Configuration'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── SDK ── */}
          {tab === 'sdk' && (
            <>
              <label className="settings-field">
                <span>Flutter SDK Path</span>
                <input
                  type="text"
                  placeholder="C:\src\flutter or leave empty for PATH"
                  value={flutterPath}
                  onChange={(e) => setFlutterPath(e.target.value)}
                />
                {sdkVersion
                  ? <small className="settings-field__ok">✓ Flutter {sdkVersion} detected</small>
                  : <small>Leave empty to auto-detect from PATH.</small>
                }
              </label>

              <div className="settings-info-card">
                <div className="settings-info-card__row">
                  <span>Flutter SDK</span>
                  <span>{sdkVersion ?? 'Not detected'}</span>
                </div>
                <div className="settings-info-card__row">
                  <span>Node.js</span>
                  <span>Auto-detected from PATH</span>
                </div>
                <div className="settings-info-card__row">
                  <span>React Native CLI</span>
                  <span>Auto-detected from project</span>
                </div>
              </div>
            </>
          )}

          {/* ── Privacy / Telemetry ── */}
          {tab === 'telemetry' && (
            <div className="settings-telemetry">
              <div className="settings-telemetry__card">
                <div className="settings-telemetry__header">
                  <div>
                    <strong>Anonymous analytics</strong>
                    <p>Events stored locally only. No code, file names, or personal data is collected.</p>
                  </div>
                  <label className="settings-toggle">
                    <input
                      type="checkbox"
                      checked={telemetryEnabled ?? false}
                      onChange={(e) => void handleTelemetryToggle(e.target.checked)}
                    />
                    <span className="settings-toggle__slider" />
                  </label>
                </div>
                <ul className="settings-telemetry__list">
                  <li>✓ Feature usage (which panels you open)</li>
                  <li>✓ Error counts (crash-free session rate)</li>
                  <li>✗ No code content</li>
                  <li>✗ No file paths or project names</li>
                  <li>✗ No network requests</li>
                </ul>
              </div>
            </div>
          )}

          {/* ── About ── */}
          {tab === 'about' && (
            <div className="settings-about">
              <div className="settings-about__logo">
                <span>👁</span>
                <div>
                  <strong>Peep</strong>
                  <small>v{version || '—'}</small>
                </div>
              </div>
              <p className="settings-about__tagline">The AI desktop IDE for mobile developers.</p>

              <div className="settings-info-card">
                <div className="settings-info-card__row">
                  <span>Version</span>
                  <span>{version || '—'}</span>
                </div>
                <div className="settings-info-card__row">
                  <span>Platform</span>
                  <span>{navigator.platform}</span>
                </div>
                {perfInfo && (
                  <>
                    <div className="settings-info-card__row">
                      <span>Heap used</span>
                      <span>{perfInfo.heapUsedMB} MB</span>
                    </div>
                    <div className="settings-info-card__row">
                      <span>RSS memory</span>
                      <span>{perfInfo.rssMemMB} MB</span>
                    </div>
                  </>
                )}
              </div>

              {/* ── Auto Update Section ── */}
              <div className="settings-about__links" style={{ marginTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-card)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600' }}>Software Update</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {updateInfo.status === 'idle' && 'Check for the latest version.'}
                      {updateInfo.status === 'checking' && 'Checking for updates...'}
                      {updateInfo.status === 'available' && `Update v${updateInfo.version} is available! Downloading...`}
                      {updateInfo.status === 'not-available' && 'You are up to date!'}
                      {updateInfo.status === 'downloading' && `Downloading update... ${updateInfo.percent}%`}
                      {updateInfo.status === 'ready' && `Update v${updateInfo.version} is ready to install.`}
                      {updateInfo.status === 'error' && <span style={{ color: 'var(--color-error)' }}>Error: {updateInfo.error}</span>}
                    </div>
                  </div>
                  <div>
                    {(updateInfo.status === 'idle' || updateInfo.status === 'not-available' || updateInfo.status === 'error') && (
                      <button className="btn btn-outline" style={{ fontSize: '12px', padding: '4px 12px' }} onClick={() => window.peep.checkForUpdates?.()}>
                        Check for Updates
                      </button>
                    )}
                    {updateInfo.status === 'ready' && (
                      <button className="btn btn-primary" style={{ fontSize: '12px', padding: '4px 12px' }} onClick={() => window.peep.downloadAndInstall?.()}>
                        Restart to Install
                      </button>
                    )}
                    {(updateInfo.status === 'checking' || updateInfo.status === 'available' || updateInfo.status === 'downloading') && (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Working...</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="settings-about__links" style={{ marginTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-card)', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600' }}>Developer Mode</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Enable experimental local AI features.</div>
                  </div>
                  <label className="settings-toggle">
                    <input
                      type="checkbox"
                      checked={developerMode}
                      onChange={(e) => void handleDeveloperModeToggle(e.target.checked)}
                    />
                    <span className="settings-toggle__slider" />
                  </label>
                </div>
                
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => void window.peep.checkForUpdates()}
                >
                  Check for updates
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {tab === 'sdk' && (
          <div className="settings-modal__footer">
            <button type="button" className="btn btn-ghost" onClick={handleClose}>Cancel</button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleSaveSdk()}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
        {tab === 'account' && !accountLoading && !sessionActive && (
          <div className="settings-modal__footer">
            <button type="button" className="btn btn-ghost" onClick={handleClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
