import { useEffect, useState } from 'react';
import type { Settings } from '@peep/shared';
import './SettingsModal.css';

type SettingsTab = 'ai' | 'sdk' | 'telemetry' | 'about';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [tab, setTab] = useState<SettingsTab>('ai');
  const [flutterPath, setFlutterPath] = useState('');
  const [saving, setSaving] = useState(false);
  const [sdkVersion, setSdkVersion] = useState<string | null>(null);
  const [telemetryEnabled, setTelemetryEnabled] = useState<boolean | null>(null);
  const [version, setVersion] = useState<string>('');
  const [perfInfo, setPerfInfo] = useState<{ heapUsedMB: number; rssMemMB: number } | null>(null);

  // AI Keys
  const [geminiKey, setGeminiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [showKeys, setShowKeys] = useState(false);
  const [aiSaved, setAiSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    void window.peep.getSettings().then((s) => {
      setFlutterPath(s.flutterSdkPath ?? '');
      setApiProvider(s.apiProvider ?? 'openai');
      setApiModel(s.apiModel ?? 'gpt-4o-mini');
      setApiKeyConfigured(!!s.apiKeyConfigured);
      setApiKey(''); // Clear raw editing input on load
    });
    void window.peep.detectFlutterSdk().then((sdk) => setSdkVersion(sdk?.version ?? null));
    void window.peep.getTelemetryEnabled().then(setTelemetryEnabled);
    void window.peep.getVersion().then(setVersion);

    // Load saved AI keys from localStorage
    setGeminiKey(localStorage.getItem('peep_gemini_key') ?? '');
    setAnthropicKey(localStorage.getItem('peep_anthropic_key') ?? '');
    setOpenaiKey(localStorage.getItem('peep_openai_key') ?? '');
    setAiSaved(false);
  }, [open]);

  useEffect(() => {
    if (tab === 'about') {
      void (window.peep as any).getPerformanceInfo?.()?.then((info: any) => setPerfInfo(info));
    }
  }, [tab]);

  if (!open) return null;

  const handleClose = () => {
    window.dispatchEvent(new CustomEvent('peep:settings-closed'));
    onClose();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const partial: Partial<Settings> = {
        flutterSdkPath: flutterPath || undefined,
        apiProvider,
        apiModel,
      };
      if (apiKey.trim()) {
        partial.apiKey = apiKey.trim();
      }
      const nextSettings = await window.peep.setSettings(partial);
      setApiKeyConfigured(!!nextSettings.apiKeyConfigured);
      setApiKey('');
      handleClose();
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAiKeys = () => {
    if (geminiKey.trim()) localStorage.setItem('peep_gemini_key', geminiKey.trim());
    else localStorage.removeItem('peep_gemini_key');
    if (anthropicKey.trim()) localStorage.setItem('peep_anthropic_key', anthropicKey.trim());
    else localStorage.removeItem('peep_anthropic_key');
    if (openaiKey.trim()) localStorage.setItem('peep_openai_key', openaiKey.trim());
    else localStorage.removeItem('peep_openai_key');
    setAiSaved(true);
    setTimeout(() => setAiSaved(false), 2000);
  };

  const handleTelemetryToggle = async (enabled: boolean) => {
    setTelemetryEnabled(enabled);
    await window.peep.setTelemetryEnabled(enabled);
  };

  const TABS: { id: SettingsTab; label: string }[] = [
    { id: 'ai', label: '🤖 AI Keys' },
    { id: 'sdk', label: '🔧 SDK' },
    { id: 'telemetry', label: '🔒 Privacy' },
    { id: 'about', label: 'ℹ About' },
  ];

  const inputType = showKeys ? 'text' : 'password';

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
          {TABS.map((t) => (
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

          {/* ── AI API Keys ── */}
          {tab === 'ai' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
                Your API keys are stored locally in this browser context and never sent to any server except the respective AI provider.
              </p>

              {/* Gemini */}
              <label className="settings-field">
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><path d="M12 2v20M2 12h20" /></svg>
                  Google Gemini API Key
                </span>
                <input
                  type={inputType}
                  placeholder="AIza…"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  style={{ fontFamily: 'var(--font-code)', letterSpacing: showKeys ? 'normal' : '0.1em' }}
                />
                {geminiKey && <small className="settings-field__ok">✓ Key set</small>}
              </label>

              {/* Anthropic */}
              <label className="settings-field">
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2L2 19h20L12 2z" /></svg>
                  Anthropic (Claude) API Key
                </span>
                <input
                  type={inputType}
                  placeholder="sk-ant-…"
                  value={anthropicKey}
                  onChange={(e) => setAnthropicKey(e.target.value)}
                  style={{ fontFamily: 'var(--font-code)', letterSpacing: showKeys ? 'normal' : '0.1em' }}
                />
                {anthropicKey && <small className="settings-field__ok">✓ Key set</small>}
              </label>

              {/* OpenAI */}
              <label className="settings-field">
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2" /></svg>
                  OpenAI API Key
                </span>
                <input
                  type={inputType}
                  placeholder="sk-…"
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  style={{ fontFamily: 'var(--font-code)', letterSpacing: showKeys ? 'normal' : '0.1em' }}
                />
                {openaiKey && <small className="settings-field__ok">✓ Key set</small>}
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}>
                <input type="checkbox" checked={showKeys} onChange={(e) => setShowKeys(e.target.checked)} />
                Show keys
              </label>
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

              <div className="settings-about__links">
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
        {tab === 'ai' && (
          <div className="settings-modal__footer">
            <button type="button" className="btn btn-ghost" onClick={handleClose}>Cancel</button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveAiKeys}
            >
              {aiSaved ? '✓ Saved!' : 'Save Keys'}
            </button>
          </div>
        )}
        {tab === 'sdk' && (
          <div className="settings-modal__footer">
            <button type="button" className="btn btn-ghost" onClick={handleClose}>Cancel</button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
