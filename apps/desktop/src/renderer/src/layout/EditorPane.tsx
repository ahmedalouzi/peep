import { MonacoEditor } from '../features/editor/MonacoEditor';
import { NoFileOpenEmptyState, NoProjectEmptyState } from '../features/shared/EmptyState';
import { useWorkspace } from '../hooks/useWorkspace';
import './EditorPane.css';

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
    // Dispatch a custom event that App.tsx listens to so we can open the modal
    window.dispatchEvent(new CustomEvent('peep:new-project'));
  };

  return (
    <section className="panel editor-pane">
      <div className="panel-header">
        <span className="panel-title">Editor</span>
        <div className="panel-actions">
          {activeFile && (
            <button type="button" className="btn btn-ghost" onClick={() => void saveActiveFile()}>
              Save
            </button>
          )}
        </div>
      </div>

      {openFiles.length > 0 && (
        <div className="editor-tabs">
          {openFiles.map((file) => (
            <div
              key={file.path}
              className={`editor-tab ${file.path === activeFilePath ? 'editor-tab--active' : ''}`}
            >
              <button type="button" className="editor-tab__label" onClick={() => setActiveFile(file.path)}>
                {file.name}
                {file.dirty ? ' •' : ''}
              </button>
              <button
                type="button"
                className="editor-tab__close"
                onClick={() => closeFile(file.path)}
                aria-label={`Close ${file.name}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="panel-body editor-pane__body">
        {!project ? (
          <NoProjectEmptyState
            onOpen={() => void openProjectFolder()}
            onNew={handleNewProject}
          />
        ) : !activeFile ? (
          <NoFileOpenEmptyState />
        ) : (
          <MonacoEditor
            key={activeFile.path}
            path={activeFile.path}
            value={activeFile.content}
            onChange={(content) => updateFileContent(activeFile.path, content)}
            onSave={() => void saveActiveFile()}
          />
        )}
      </div>
    </section>
  );
}
