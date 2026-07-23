import { useState, useEffect } from 'react';
import { MonacoEditor } from '../features/editor/MonacoEditor';

import { NoFileOpenEmptyState, NoProjectEmptyState } from '../features/shared/EmptyState';
import { useWorkspaceStore } from '../stores/workspace-store';
import { useWorkspace } from '../hooks/useWorkspace';
import { ExtensionDetailsView } from '../features/extensions/ExtensionDetailsView';
import { GitDiffView } from '../features/git/GitDiffView';
import { getFileIcon } from '../features/explorer/FileIcons';

/** File extensions treated as images */
const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp', 'tiff', 'avif']);

function isImageFile(name: string): boolean {
  return IMAGE_EXTS.has(name.split('.').pop()?.toLowerCase() ?? '');
}

/** Loads an image file as a base64 data URL via IPC */
function ImageViewer({ filePath, fileName }: { filePath: string; fileName: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    setSrc(null);
    void window.peep.readImage(filePath).then(setSrc);
  }, [filePath]);

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-base)',
      gap: '16px',
      overflow: 'auto',
      padding: '24px',
    }}>
      {src ? (
        <>
          {/* Checkerboard for transparency */}
          <div style={{
            position: 'relative',
            borderRadius: '8px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)',
            overflow: 'hidden',
            maxWidth: '100%',
            maxHeight: 'calc(100% - 80px)',
            border: '1px solid rgba(255,255,255,0.08)',
            background: [
              'linear-gradient(45deg, #222 25%, transparent 25%)',
              'linear-gradient(-45deg, #222 25%, transparent 25%)',
              'linear-gradient(45deg, transparent 75%, #222 75%)',
              'linear-gradient(-45deg, transparent 75%, #222 75%)',
            ].join(', '),
            backgroundSize: '16px 16px',
            backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
          }}>
            <img
              src={src}
              alt={fileName}
              style={{ display: 'block', maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
            />
          </div>
          {/* Info bar */}
          <div style={{
            display: 'flex', gap: '10px', alignItems: 'center',
            fontSize: '11px', color: 'var(--text-muted)',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '6px', padding: '6px 14px',
          }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{fileName}</span>
            <span>·</span>
            <span>{fileName.split('.').pop()?.toUpperCase()}</span>
          </div>
        </>
      ) : (
        <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading…</div>
      )}
    </div>
  );
}

export function EditorPane() {
  const {
    project,
    openFiles,
    activeFilePath,
    setActiveFile,
    closeFile,
    updateFileContent,
    saveActiveFile,
    openProjectFolder,
  } = useWorkspace();

  const activeFile = openFiles.find((f) => f.path === activeFilePath) ?? null;

  const handleNewProject = () => {
    window.dispatchEvent(new CustomEvent('peep:new-project'));
  };



  return (
    <div className="editor-area">
      <div className="editor-tabs">
        {openFiles.map((file) => {
          const isActive = file.path === activeFilePath;
          return (
            <div key={file.path} className={`tab ${isActive ? 'active' : ''}`} onClick={() => setActiveFile(file.path)}>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isActive ? 1 : 0.7, filter: isActive ? 'none' : 'grayscale(0.5)' }}>
                {getFileIcon(file.name)}
              </span>
              {file.name}
              {file.dirty && <span className="tab-dot"></span>}
              <span className="tab-close" onClick={(e) => { e.stopPropagation(); closeFile(file.path); }}>✕</span>
            </div>
          );
        })}
      </div>

      {activeFile && (
        <div className="editor-toolbar">
          <div className="breadcrumb">
            <span style={{ color: 'var(--text-muted)' }}>{project?.name ?? 'Project'}</span>
            <span className="sep">›</span>
            <span style={{ color: 'var(--gold)' }}>{activeFile.name}</span>
          </div>
          <div className="editor-toolbar-right">
            <span className="ctx-pill">
              <svg style={{ width: '10px', height: '10px', stroke: 'currentColor', fill: 'none', strokeWidth: '2' }} viewBox="0 0 16 16"><path d="M8 2v4l3 3" /><circle cx="8" cy="8" r="6" /></svg>
              {activeFile.name.split('.').pop()?.toUpperCase() ?? 'TEXT'}
            </span>
            <button className="toolbar-btn" onClick={() => void saveActiveFile()}>
              <svg style={{ width: '11px', height: '11px', stroke: 'currentColor', fill: 'none', strokeWidth: '2' }} viewBox="0 0 16 16"><path d="M1 4h14M1 8h14M1 12h8" /></svg>
              Save
            </button>
            <button className="toolbar-btn" onClick={() => {
              if (project) {
                useWorkspaceStore.getState().setBottomPanelTab('problems');
                if (!useWorkspaceStore.getState().bottomPanelOpen) useWorkspaceStore.getState().toggleBottomPanel();
                if (project.platform === 'react-native' || project.platform === 'expo') {
                  window.peep.analyzeProject(project.path); // Wait, RN analyze is not exposed properly?
                  // We can just rely on the watcher for now, or just open the tab.
                } else {
                  window.peep.analyzeProject(project.path);
                }
              }
            }}>
              <svg style={{ width: '11px', height: '11px', stroke: 'currentColor', fill: 'none', strokeWidth: '2' }} viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" /><path d="M8 5v3l2 2" /></svg>
              Lint
            </button>
          </div>
        </div>
      )}

      <div className="editor-body" style={{ flex: 1, position: 'relative' }}>
        {!project ? (
          <NoProjectEmptyState
            onOpen={() => void openProjectFolder()}
            onNew={handleNewProject}
          />
        ) : !activeFile ? (
          <NoFileOpenEmptyState />
        ) : activeFile.path.startsWith('extension://') ? (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'auto', background: 'var(--bg-base)' }}>
            <ExtensionDetailsView extensionId={activeFile.path.replace('extension://', '')} />
          </div>
        ) : activeFile.path.startsWith('git-diff://') ? (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', background: 'var(--bg-base)' }}>
            <GitDiffView filePath={activeFile.path.replace('git-diff://', '')} />
          </div>
        ) : isImageFile(activeFile.name) ? (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            <ImageViewer filePath={activeFile.path} fileName={activeFile.name} />
          </div>
        ) : (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            <MonacoEditor
              key={activeFile.path}
              path={activeFile.path}
              value={activeFile.content}
              onChange={(content) => updateFileContent(activeFile.path, content)}
              onSave={() => void saveActiveFile()}
            />
          </div>
        )}
      </div>
    </div>
  );
}
