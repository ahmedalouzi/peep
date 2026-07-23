import { useState, useEffect, useRef } from 'react';
import { usePreviewStore } from '../stores/preview-store';
import { useWorkspaceStore } from '../stores/workspace-store';
import { PhoneFrame, type DeviceType } from '../features/preview/PhoneFrame';
import './PreviewPane.css';

/* ── Device catalogue ─────────────────────────────────────────────── */
export const DEVICES = [
  { id: 'iphone-15' as const, label: 'iPhone 15', w: 290, h: 600, padding: 6, lw: 393 },
  { id: 'iphone-15-pro' as const, label: 'iPhone 15 Pro', w: 290, h: 600, padding: 6, lw: 393 },
  { id: 'iphone-se' as const, label: 'iPhone SE', w: 250, h: 510, padding: 4, lw: 375 },
  { id: 'pixel-8' as const, label: 'Pixel 8', w: 270, h: 570, padding: 3, lw: 412 },
  { id: 'pixel-fold' as const, label: 'Pixel Fold', w: 380, h: 520, padding: 3, lw: 840 },
  { id: 'galaxy-s24' as const, label: 'Galaxy S24', w: 268, h: 560, padding: 3, lw: 360 },
] as const;

function getPlatformLabel(p: string) {
  if (p === 'react-native') return 'React Native';
  if (p === 'expo') return 'Expo';
  if (p === 'flutter') return 'Flutter';
  return 'Web / Other';
}
function getPlatformColor(p: string) {
  if (p === 'flutter') return '#2d7dd2';
  if (p === 'react-native') return '#7c5cbf';
  if (p === 'expo') return '#4630eb';
  return '#10b981';
}
function getIdleMsg(p: string) {
  if (p === 'react-native' || p === 'expo') {
    return 'Open a React Native project to auto-start Expo Web preview, or press Start.';
  }
  if (p === 'flutter') {
    return 'Open a Flutter project to auto-start preview, or press Start.';
  }
  return 'Web or general project opened. Automated previews are not supported for this project type.';
}
function getStartingMsg(p: string) {
  if (p === 'react-native' || p === 'expo') {
    return 'Running npm install and starting Expo Web… This may take a minute.';
  }
  if (p === 'flutter') {
    return 'Running flutter pub get and web server. This may take a minute.';
  }
  return 'Starting preview…';
}
function getStoppedMsg(p: string) {
  if (p === 'react-native' || p === 'expo') {
    return 'Press Start to launch Expo Web again.';
  }
  if (p === 'flutter') {
    return 'Press Start to launch Flutter Web again.';
  }
  return 'Preview stopped.';
}

export function PreviewPane() {
  const [isDetached, setIsDetached] = useState(false);
  const [scale, setScale] = useState(0.55);

  const session = usePreviewStore((s) => s.session);
  const iframeKey = usePreviewStore((s) => s.iframeKey);
  const deviceId = usePreviewStore((s) => s.deviceId) as DeviceType;
  const setDeviceId = usePreviewStore((s) => s.setDeviceId);

  /* ── Refs ── */
  // Put on the outermost section — it ALWAYS has proper size from react-resizable-panels
  const paneRef = useRef<HTMLElement>(null);
  // Keep latest device in a ref so the ResizeObserver closure sees the current value
  const deviceRef = useRef(deviceId);
  useEffect(() => { deviceRef.current = deviceId; }, [deviceId]);

  const project = useWorkspaceStore((s) => s.project);
  const setPreviewPaneOpen = useWorkspaceStore((s) => s.setPreviewPaneOpen);

  const isRunning = session?.status === 'running' && session.url;
  const platform = project?.platform ?? 'flutter';
  const platColor = getPlatformColor(platform);
  const device = DEVICES.find((d) => d.id === deviceId) ?? DEVICES[0]!;

  /* ── Scale: observe outermost pane ── */
  useEffect(() => {
    const el = paneRef.current;
    if (!el) return;

    const compute = () => {
      const d = DEVICES.find((x) => x.id === deviceRef.current) ?? DEVICES[0]!;
      // Available body area = pane minus: header(34) + gaps(20) [removed toolbar(30)]
      const availW = el.clientWidth - 24;
      const availH = el.clientHeight - 34 - 50;
      if (availW < 10 || availH < 10) return;
      const s = Math.min(availW / d.w, availH / d.h);
      setScale(Math.min(Math.max(s, 0.2), 1.0));
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []); // only once — paneRef is stable

  // Recompute when device changes
  useEffect(() => {
    const el = paneRef.current;
    if (!el) return;
    const d = DEVICES.find((x) => x.id === deviceId) ?? DEVICES[0]!;
    const availW = el.clientWidth - 24;
    const availH = el.clientHeight - 34 - 50;
    if (availW < 10 || availH < 10) return;
    const s = Math.min(availW / d.w, availH / d.h);
    setScale(Math.min(Math.max(s, 0.2), 1.0));
  }, [deviceId]);

  /* ── Detach listener ── */
  useEffect(() => {
    void window.peep.isPreviewDetached().then(setIsDetached);
    const unsub = window.peep.onPreviewStatus(() => {
      void window.peep.isPreviewDetached().then(setIsDetached);
    });
    return () => unsub();
  }, []);

  const handleStart = () => { 
    if (project) {
      if (platform === 'react-native' || platform === 'expo') {
        void window.peep.rnStartPreview(project.path);
      } else {
        void window.peep.startPreview(project.path);
      }
    }
  };
  const handleRefresh = () => { 
    if (platform === 'react-native' || platform === 'expo') {
      if (session?.processId) {
        void window.peep.rnReloadPreview(session.processId);
      }
    } else {
      void window.peep.reloadPreview();
    }
    usePreviewStore.getState().bumpIframe(); 
  };
  const handleDetach = () => void window.peep.detachPreview(deviceId);

  return (
    <section className="preview-panel" ref={paneRef}>

      {/* ── Header ── */}
      <div className="preview-header">
        <div className="preview-header__left">
          <span className="preview-header__title">PREVIEW</span>
          {project && (
            <span className="preview-header__platform"
              style={{ '--plat-color': platColor } as React.CSSProperties}>
              <span className="preview-header__platform-dot" />
              {getPlatformLabel(platform).toUpperCase()}
            </span>
          )}
        </div>

        <div className="preview-header__actions">
          {isDetached ? (
            <button type="button" className="preview-action-btn preview-action-btn--primary"
              onClick={() => void window.peep.attachPreview()}>
              📥 Attach
            </button>
          ) : (
            <>
              <select
                className="preview-device-select"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
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
                  disabled={!project || platform === 'unknown'}
                  title={platform === 'unknown' ? 'Previews are not supported' : `Start ${getPlatformLabel(platform)} preview`}
                >
                  ▶ Start
                </button>
              )}

              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleDetach}
                title="Detach preview to floating window"
              >
                ↗ Detach
              </button>

              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => window.dispatchEvent(new CustomEvent('peep:open-publish'))}
                title="Publish or Deploy App"
              >
                🚀 Publish
              </button>
            </>
          )}
          <button type="button" className="preview-action-btn preview-action-btn--close"
            onClick={() => setPreviewPaneOpen(false)}>✕</button>
        </div>
      </div>
      <div className="preview-body" style={{
        flex: 1, position: 'relative', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>


        {/* ── Body ── */}
        <div className="panel-body preview-pane__body">
          {isDetached ? (
            <div className="preview-placeholder">
              <span className="preview-placeholder__icon">↗️</span>
              <h3>Preview detached</h3>
              <p>The preview is running in a separate floating window.</p>
              <button type="button" className="preview-retry-btn"
                onClick={() => void window.peep.attachPreview()}>
                Attach Back
              </button>
            </div>
          ) : (
            <div className="preview-stage">
              <div className="preview-device-label">{device.label}</div>

              {/* Scaled phone wrapper */}
              <div className="phone-scale-outer" style={{
                width: device.w * scale,
                height: device.h * scale,
              }}>
                <div className="phone-scale-inner" style={{
                  width: device.w,
                  height: device.h,
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                }}>
                  <PhoneFrame device={deviceId}>
                    {session?.status === 'starting' && (
                      <div className="preview-placeholder">
                        <span className="preview-placeholder__icon preview-placeholder__spinner">⏳</span>
                        <h3>Starting…</h3>
                        <p>{getStartingMsg(platform)}</p>
                      </div>
                    )}
                    {session?.status === 'error' && (
                      <div className="preview-placeholder preview-placeholder--error">
                        <span className="preview-placeholder__icon">⚠️</span>
                        <h3>Preview failed</h3>
                        <p>{session.error ?? `Could not start ${getPlatformLabel(platform)} preview.`}</p>
                        <button type="button" className="preview-retry-btn"
                          onClick={handleStart} disabled={!project}>Retry</button>
                      </div>
                    )}
                    {isRunning && (
                      <iframe key={iframeKey} className="preview-iframe"
                        style={{
                          width: `${device.lw}px`,
                          height: `${(device.h - device.padding * 2) / ((device.w - device.padding * 2) / device.lw)}px`,
                          transform: `scale(${(device.w - device.padding * 2) / device.lw})`,
                          transformOrigin: 'top left',
                        }}
                        src={session.url} title={`${getPlatformLabel(platform)} preview`} />
                    )}
                    {!session && (
                      <div className="preview-placeholder">
                        <span className="preview-placeholder__icon">📱</span>
                        <h3>Live preview</h3>
                        <p>{getIdleMsg(platform)}</p>
                      </div>
                    )}
                    {session?.status === 'stopped' && (
                      <div className="preview-placeholder">
                        <span className="preview-placeholder__icon">⏹</span>
                        <h3>Preview stopped</h3>
                        <p>{getStoppedMsg(platform)}</p>
                      </div>
                    )}
                  </PhoneFrame>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
