import { useEffect, useState } from 'react';
import './DetachedPreview.css';

export function DetachedPreview() {
  const [session, setSession] = useState<any>(null);
  const [iframeKey, setIframeKey] = useState(0);

  useEffect(() => {
    // 1. Fetch current preview session on mount
    void window.peep.getPreviewSession().then((activeSession) => {
      setSession(activeSession);
    });

    // 2. Listen to real-time session changes from main process
    const unsub = window.peep.onPreviewStatus((s) => {
      setSession(s);
      if (s.status === 'running') {
        setIframeKey((prev) => prev + 1);
      }
    });

    return () => {
      unsub();
    };
  }, []);

  const handleRefresh = () => {
    void window.peep.reloadPreview();
    setIframeKey((prev) => prev + 1);
  };

  const handleAttach = () => {
    void window.peep.attachPreview();
  };

  const isRunning = session?.status === 'running' && session.url;

  return (
    <div className="detached-stage">
      {/* Detached Controls Header */}
      <div className="detached-header">
        <span className="detached-title">📱 Mobile Preview</span>
        <div className="detached-actions">
          {isRunning && (
            <button type="button" className="detached-btn" onClick={handleRefresh} title="Reload Preview">
              ↺ Refresh
            </button>
          )}
          <button type="button" className="detached-btn detached-btn--primary" onClick={handleAttach} title="Attach preview back to IDE">
            📥 Attach to IDE
          </button>
        </div>
      </div>

      {/* Floating Phone mock-up */}
      <div className="detached-body">
        <div className="phone-frame phone-frame--detached">
          <div className="phone-frame__notch" />
          <div className="phone-frame__screen">
            {session?.status === 'starting' && (
              <div className="preview-placeholder">
                <span className="preview-placeholder__icon preview-placeholder__spinner">⏳</span>
                <h3>Starting preview…</h3>
                <p>Starting web server. This may take a minute.</p>
              </div>
            )}

            {session?.status === 'error' && (
              <div className="preview-placeholder preview-placeholder--error">
                <span className="preview-placeholder__icon">⚠️</span>
                <h3>Preview failed</h3>
                <p>{session.error ?? 'Could not start preview.'}</p>
              </div>
            )}

            {isRunning && (
              <iframe
                key={iframeKey}
                className="preview-iframe"
                src={session.url}
                title="Mobile Preview"
              />
            )}

            {!session && (
              <div className="preview-placeholder">
                <span className="preview-placeholder__icon">📱</span>
                <h3>Live preview</h3>
                <p>Open a project to start preview.</p>
              </div>
            )}

            {session?.status === 'stopped' && (
              <div className="preview-placeholder">
                <span className="preview-placeholder__icon">⏹</span>
                <h3>Preview stopped</h3>
                <p>Launch the project preview from the IDE.</p>
              </div>
            )}
          </div>
          <div className="phone-frame__home" />
        </div>
      </div>
    </div>
  );
}
