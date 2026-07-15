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
  const [apiProvider, setApiProvider] = useState<'openai' | 'anthropic' | 'google'>('openai');
  const [apiKey, setApiKey] = useState('');
  const [apiModel, setApiModel] = useState('gpt-4o-mini');
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [flutterPath, setFlutterPath] = useState('');
  const [saving, setSaving] = useState(false);
  const [sdkVersion, setSdkVersion] = useState<string | null>(null);
  const [telemetryEnabled, setTelemetryEnabled] = useState<boolean | null>(null);
  const [version, setVersion] = useState<string>('');
  const [perfInfo, setPerfInfo] = useState<{ heapUsedMB: number; rssMemMB: number } | null>(null);

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
  }, [open]);

  // Load perf info when About tab is open
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

  const handleTelemetryToggle = async (enabled: boolean) => {
    setTelemetryEnabled(enabled);
    await window.peep.setTelemetryEnabled(enabled);
  };

  const TABS: { id: SettingsTab; label: string }[] = [
    { id: 'ai',        label: '🤖 AI Settings' },
    { id: 'sdk',       label: '🔧 SDK' },
    { id: 'telemetry', label: '🔒 Privacy' },
    { id: 'about',     label: 'ℹ About' },
  ];

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

          {/* ── AI ── */}
          {tab === 'ai' && (
            <>
              <label className="settings-field">
                <span>AI Provider</span>
                <select
                  value={apiProvider}
                  onChange={(e) => {
                    const nextProvider = e.target.value as 'openai' | 'google';
                    setApiProvider(nextProvider);
                    setApiModel(nextProvider === 'google' ? 'gemini-3.5-flash' : 'gpt-4o-mini');
                  }}
                >
                  <option value="openai">OpenAI (BYOK)</option>
                  <option value="google">Google Gemini (BYOK)</option>
                  <option value="anthropic" disabled>Anthropic (Coming Soon)</option>
                </select>
              </label>

              <label className="settings-field">
                <span>API Key</span>
                <input
                  type="password"
                  placeholder={apiKeyConfigured ? '•••••••• (Saved. Enter new key to overwrite)' : `Enter ${apiProvider === 'google' ? 'Google Gemini' : 'OpenAI'} API Key...`}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                {apiKeyConfigured && (
                  <small className="settings-field__ok">✓ API Key is configured and saved locally</small>
                )}
              </label>

              <label className="settings-field">
                <span>Model</span>
                <select
                  value={apiModel}
                  onChange={(e) => {
                    const model = e.target.value;
                    setApiModel(model);
                    if (model.startsWith('gemini-')) {
                      setApiProvider('google');
                    } else if (model.startsWith('gpt-')) {
                      setApiProvider('openai');
                    }
                  }}
                >
                  <option value="gemini-3.5-flash">gemini-3.5-flash (Google Gemini - Default)</option>
                  <option value="gemini-3.1-pro">gemini-3.1-pro (Google Gemini)</option>
                  <option value="gemini-3">gemini-3 (Google Gemini)</option>
                  <option value="gemini-3-flash">gemini-3-flash (Google Gemini)</option>
                  <option value="gemini-2.5-flash">gemini-2.5-flash (Google Gemini)</option>
                  <option value="gemini-1.5-flash">gemini-1.5-flash (Google Gemini)</option>
                  <option value="gemini-1.5-pro">gemini-1.5-pro (Google Gemini - High Quality)</option>
                  <option value="gpt-4o-mini">gpt-4o-mini (OpenAI - Default)</option>
                  <option value="gpt-4o">gpt-4o (OpenAI - High Quality)</option>
                  <option value="gpt-3.5-turbo">gpt-3.5-turbo (OpenAI - Legacy)</option>
                  <option value="o1-mini">o1-mini (OpenAI - Reasoning)</option>
                  <option value="o3-mini">o3-mini (OpenAI - Reasoning)</option>
                  <option value="claude-3-5-sonnet">claude-3-5-sonnet (Claude - Coding)</option>
                  <option value="claude-3-5-haiku">claude-3-5-haiku (Claude - Fast)</option>
                  <option value="claude-3-opus">claude-3-opus (Claude - High Quality)</option>
                  <option value="llama-3.3-70b">llama-3.3-70b (Llama - Open Weights)</option>
                  <option value="codestral">codestral (Mistral - Coding)</option>
                </select>
              </label>
            </>
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

        {/* Footer — show Save for AI and SDK tabs */}
        {(tab === 'ai' || tab === 'sdk') && (
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
