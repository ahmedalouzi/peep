import { useEffect, useState } from 'react';
import type { Settings } from '@peep/shared';
import './SettingsModal.css';

type SettingsTab = 'sdk' | 'telemetry' | 'about';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [tab, setTab] = useState<SettingsTab>('sdk');
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
      };
      await window.peep.setSettings(partial);
    } finally {
      setSaving(false);
    }
  };

  const handleTelemetryToggle = async (enabled: boolean) => {
    setTelemetryEnabled(enabled);
    await window.peep.setTelemetryEnabled(enabled);
  };

  const TABS: { id: SettingsTab; label: string }[] = [
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

        {/* Footer — only show Save for SDK tab */}
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
