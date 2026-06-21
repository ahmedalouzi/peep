import { useState } from 'react';
import { usePreviewStore } from '../stores/preview-store';
import { useWorkspaceStore } from '../stores/workspace-store';
import './PreviewPane.css';

const DEVICES = [
  { id: 'iphone-15',    label: 'iPhone 15',    width: 393, height: 852, scale: 0.55 },
  { id: 'iphone-se',    label: 'iPhone SE',    width: 375, height: 667, scale: 0.58 },
  { id: 'pixel-8',      label: 'Pixel 8',      width: 412, height: 915, scale: 0.52 },
  { id: 'pixel-fold',   label: 'Pixel Fold',   width: 586, height: 820, scale: 0.48 },
  { id: 'galaxy-s24',   label: 'Galaxy S24',   width: 384, height: 830, scale: 0.53 },
] as const;

type DeviceId = (typeof DEVICES)[number]['id'];

function getPlatformLabel(platform: string): string {
  if (platform === 'react-native') return 'React Native';
  if (platform === 'expo') return 'Expo';
  return 'Flutter';
}

function getStartingMessage(platform: string): string {
  if (platform === 'react-native' || platform === 'expo') {
    return 'Running npm install and starting Expo Web… This may take a minute.';
  }
  return 'Running flutter pub get and web server. This may take a minute.';
}

function getIdleMessage(platform: string): string {
  if (platform === 'react-native' || platform === 'expo') {
    return 'Open a React Native project to auto-start Expo Web preview, or press Start.';
  }
  return 'Open a Flutter project to auto-start preview, or press Start.';
}

function getStoppedMessage(platform: string): string {
  if (platform === 'react-native' || platform === 'expo') {
    return 'Press Start to launch Expo Web again.';
  }
  return 'Press Start to launch Flutter Web again.';
}

export function PreviewPane() {
  const [deviceId, setDeviceId] = useState<DeviceId>('iphone-15');
  const session   = usePreviewStore((s) => s.session);
  const iframeKey = usePreviewStore((s) => s.iframeKey);
  const project   = useWorkspaceStore((s) => s.project);

  const device    = DEVICES.find((d) => d.id === deviceId) ?? DEVICES[0]!;
  const isRunning = session?.status === 'running' && session.url;
  const platform  = project?.platform ?? 'flutter';

  const handleRefresh = () => {
    void window.peep.reloadPreview();
    usePreviewStore.getState().bumpIframe();
  };

  const handleStart = () => {
    if (!project) return;
    void window.peep.startPreview(project.path);
  };

  return (
    <section className="panel preview-pane">
      <div className="panel-header">
        <span className="panel-title">
          Preview
          {project && (
            <span className="preview-platform-badge">
              {platform === 'react-native' ? '⚛️' : '🐦'} {getPlatformLabel(platform)}
            </span>
          )}
        </span>

        <div className="panel-actions">
          <select
            className="preview-device-select"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value as DeviceId)}
            title="Device frame"
          >
            {DEVICES.map((d) => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>

          {isRunning ? (
            <button type="button" className="btn btn-ghost" onClick={handleRefresh} title="Hot reload">
              ↺ Refresh
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleStart}
              disabled={!project}
              title={`Start ${getPlatformLabel(platform)} preview`}
            >
              ▶ Start
            </button>
          )}
        </div>
      </div>

      <div className="panel-body preview-pane__body">
        <div className="preview-stage">
          <div
            className="phone-frame"
            style={{
              width:  device.width  * device.scale,
              height: device.height * device.scale,
            }}
          >
            <div className="phone-frame__notch" />
            <div className="phone-frame__screen">

              {session?.status === 'starting' && (
                <div className="preview-placeholder">
                  <span className="preview-placeholder__icon preview-placeholder__spinner">⏳</span>
                  <h3>Starting preview…</h3>
                  <p>{getStartingMessage(platform)}</p>
                </div>
              )}

              {session?.status === 'error' && (
                <div className="preview-placeholder preview-placeholder--error">
                  <span className="preview-placeholder__icon">⚠️</span>
                  <h3>Preview failed</h3>
                  <p>{session.error ?? `Could not start ${getPlatformLabel(platform)} preview.`}</p>
                  <button
                    type="button"
                    className="preview-retry-btn"
                    onClick={handleStart}
                    disabled={!project}
                  >
                    Retry
                  </button>
                </div>
              )}

              {isRunning && (
                <iframe
                  key={iframeKey}
                  className="preview-iframe"
                  src={session.url}
                  title={`${getPlatformLabel(platform)} preview`}
                />
              )}

              {!session && (
                <div className="preview-placeholder">
                  <span className="preview-placeholder__icon">📱</span>
                  <h3>Live preview</h3>
                  <p>{getIdleMessage(platform)}</p>
                </div>
              )}

              {session?.status === 'stopped' && (
                <div className="preview-placeholder">
                  <span className="preview-placeholder__icon">⏹</span>
                  <h3>Preview stopped</h3>
                  <p>{getStoppedMessage(platform)}</p>
                </div>
              )}

            </div>
            <div className="phone-frame__home" />
          </div>

          {/* Device label */}
          <div className="preview-device-label">{device.label}</div>
        </div>
      </div>
    </section>
  );
}
