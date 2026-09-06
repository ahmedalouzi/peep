import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { useBuildStore } from '../../stores/build-store';
import { buildApi } from '../../services/build-api';
import { CloudBuildJob } from '@peep/shared';
// CSS imports are bundled by Vite at build time; Node.js test runner skips them via the
// tsconfig paths resolution — these are safe to keep here.
/* eslint-disable import/no-unresolved */
try { require('./BuildPanel.css'); } catch { /* ignored in node test context */ }
try { require('@xterm/xterm/css/xterm.css'); } catch { /* ignored in node test context */ }

export function BuildPanel() {
  const currentBuild = useBuildStore((s) => s.currentBuild);
  const updateCurrentBuild = useBuildStore((s) => s.updateCurrentBuild);
  const termRef = useRef<HTMLDivElement>(null);
  const termInstance = useRef<Terminal | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Status polling timer
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (currentBuild?.status === 'running' || currentBuild?.status === 'queued') {
      timer = setInterval(async () => {
        try {
          const updated = await buildApi.getBuild(currentBuild.id);
          updateCurrentBuild(updated);
        } catch (e) {
          console.error('Failed to poll build status', e);
        }
      }, 3000);
    }
    return () => clearInterval(timer);
  }, [currentBuild?.id, currentBuild?.status, updateCurrentBuild]);

  // Elapsed time counter
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (currentBuild?.status === 'running' && currentBuild.startedAt) {
      timer = setInterval(() => {
        const start = new Date(currentBuild.startedAt!).getTime();
        setElapsed(Math.floor((Date.now() - start) / 1000));
      }, 1000);
    } else if (
      currentBuild?.status === 'success' ||
      currentBuild?.status === 'failed' ||
      currentBuild?.status === 'cancelled'
    ) {
      if (currentBuild.buildDurationMs) {
        setElapsed(Math.floor(currentBuild.buildDurationMs / 1000));
      }
    } else {
      setElapsed(0);
    }
    return () => clearInterval(timer);
  }, [currentBuild?.status, currentBuild?.startedAt, currentBuild?.buildDurationMs]);

  // Terminal setup & log streaming
  useEffect(() => {
    if (!termRef.current) return;

    if (!termInstance.current) {
      const term = new Terminal({
        theme: {
          background: '#0a0a0f',
          foreground: '#e2e8f0',
          cursor: 'transparent'
        },
        fontSize: 12,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        disableStdin: true,
        convertEol: true,
      });
      term.open(termRef.current);
      termInstance.current = term;
    }

    const term = termInstance.current;
    term.clear();

    if (currentBuild) {
      const unsub = buildApi.streamLogs(currentBuild.id, (chunk) => {
        term.write(chunk);
      });
      return () => unsub();
    }
  }, [currentBuild?.id]);

  if (!currentBuild) {
    return (
      <div id="build-panel-empty" className="build-panel empty">
        No active build.
      </div>
    );
  }

  const isActive = currentBuild.status === 'queued' || currentBuild.status === 'running';

  const handleCancel = () => {
    buildApi.cancelBuild(currentBuild.id);
  };

  const handleDownload = () => {
    if (currentBuild.artifactUrl) {
      window.open(currentBuild.artifactUrl, '_blank');
    }
  };

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div id="build-panel" className="build-panel">
      <div className="build-header">
        <div className="build-info">
          <span id="build-status-badge" className={`status-badge ${currentBuild.status}`}>
            {currentBuild.status.toUpperCase()}
          </span>
          <span id="build-target-label" className="build-target">
            {currentBuild.framework} • {currentBuild.target.toUpperCase()}
          </span>
          {(currentBuild.status === 'running' || elapsed > 0) && (
            <span id="build-elapsed" className="build-time">⏱ {timeStr}</span>
          )}
        </div>
        <div className="build-actions">
          {isActive && (
            <button id="build-cancel-btn" className="btn-cancel" onClick={handleCancel}>
              Cancel Build
            </button>
          )}
          {currentBuild.status === 'success' && currentBuild.artifactUrl && (
            <button id="build-download-btn" className="btn-download" onClick={handleDownload}>
              Download {currentBuild.target.toUpperCase()}
            </button>
          )}
        </div>
      </div>

      {currentBuild.status === 'failed' && currentBuild.errorLog && (
        <div id="build-error-banner" className="build-error-banner">
          <div className="error-title">Build Failed</div>
          <pre id="build-error-log" className="error-log">{currentBuild.errorLog}</pre>
        </div>
      )}

      <div id="build-logs-container" className="build-logs-container" ref={termRef} />
    </div>
  );
}

// ─── Pure-DOM test harness (no React, no xterm) ──────────────────────────────
// Mirrors the conditional render logic of the BuildPanel React component above.
// Used by build-panel.test.ts via JSDOM — no React, no xterm.js required.
//
// ⚠️  SYNC WARNING: This function is a manually-maintained DOM mirror of
// BuildPanel()'s JSX render. If you change which elements are shown/hidden
// in the real component (status conditions, button visibility, error banner
// logic), you MUST update renderBuildPanel() here to match, or tests will
// silently diverge from actual component behaviour.

export interface BuildPanelOpts {
  currentBuild: CloudBuildJob | null;
  onCancel?: () => void;
  onDownload?: () => void;
}

export function renderBuildPanel(opts: BuildPanelOpts, doc: Document): HTMLElement {
  const { currentBuild, onCancel, onDownload } = opts;

  if (!currentBuild) {
    const empty = doc.createElement('div');
    empty.id = 'build-panel-empty';
    empty.className = 'build-panel empty';
    empty.textContent = 'No active build.';
    return empty;
  }

  const root = doc.createElement('div');
  root.id = 'build-panel';
  root.className = 'build-panel';

  // Header
  const header = doc.createElement('div');
  header.className = 'build-header';

  const info = doc.createElement('div');
  info.className = 'build-info';

  const badge = doc.createElement('span');
  badge.id = 'build-status-badge';
  badge.className = `status-badge ${currentBuild.status}`;
  badge.textContent = currentBuild.status.toUpperCase();
  info.append(badge);

  const targetLabel = doc.createElement('span');
  targetLabel.id = 'build-target-label';
  targetLabel.className = 'build-target';
  targetLabel.textContent = `${currentBuild.framework} • ${currentBuild.target.toUpperCase()}`;
  info.append(targetLabel);

  header.append(info);

  const actions = doc.createElement('div');
  actions.className = 'build-actions';

  const isActive = currentBuild.status === 'queued' || currentBuild.status === 'running';
  if (isActive) {
    const cancelBtn = doc.createElement('button');
    cancelBtn.id = 'build-cancel-btn';
    cancelBtn.className = 'btn-cancel';
    cancelBtn.textContent = 'Cancel Build';
    cancelBtn.onclick = () => onCancel?.();
    actions.append(cancelBtn);
  }

  if (currentBuild.status === 'success' && currentBuild.artifactUrl) {
    const downloadBtn = doc.createElement('button');
    downloadBtn.id = 'build-download-btn';
    downloadBtn.className = 'btn-download';
    downloadBtn.textContent = `Download ${currentBuild.target.toUpperCase()}`;
    downloadBtn.onclick = () => onDownload?.();
    actions.append(downloadBtn);
  }

  header.append(actions);
  root.append(header);

  // Error banner (only when failed AND errorLog is set)
  if (currentBuild.status === 'failed' && currentBuild.errorLog) {
    const banner = doc.createElement('div');
    banner.id = 'build-error-banner';
    banner.className = 'build-error-banner';

    const errTitle = doc.createElement('div');
    errTitle.className = 'error-title';
    errTitle.textContent = 'Build Failed';
    banner.append(errTitle);

    const errLog = doc.createElement('pre');
    errLog.id = 'build-error-log';
    errLog.className = 'error-log';
    errLog.textContent = currentBuild.errorLog;
    banner.append(errLog);

    root.append(banner);
  }

  // Log container (xterm target in real React; a <div> in test harness)
  const logsContainer = doc.createElement('div');
  logsContainer.id = 'build-logs-container';
  logsContainer.className = 'build-logs-container';
  root.append(logsContainer);

  return root;
}

// ─── Pure-DOM test harness for TitleBar Build APK button ───────────────────
//
// ⚠️  SYNC WARNING: This function is a manually-maintained DOM mirror of
// the BUILD APK <button> rendered inside TitleBar.tsx. If you change the
// disabled condition, the onClick guard, or the platform check in TitleBar,
// you MUST update renderBuildButton() here to match.

export interface BuildButtonOpts {
  platform: string | null;
  activeBuildStatus: 'queued' | 'running' | null;
  onBuildApk: () => void;
}

export function renderBuildButton(opts: BuildButtonOpts, doc: Document): HTMLElement | null {
  const { platform, activeBuildStatus, onBuildApk } = opts;

  if (platform !== 'flutter' && platform !== 'react-native') return null;

  const isBuilding = activeBuildStatus === 'queued' || activeBuildStatus === 'running';

  const btn = doc.createElement('button');
  btn.id = 'build-apk-btn';
  btn.title = 'Build Android APK';
  btn.disabled = isBuilding;
  btn.className = 'layout-btn';
  btn.textContent = '🚀 BUILD APK';
  btn.onclick = () => {
    if (!isBuilding) onBuildApk();
  };
  return btn;
}
