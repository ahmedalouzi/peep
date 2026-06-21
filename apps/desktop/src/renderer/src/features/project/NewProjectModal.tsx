import { useEffect, useState } from 'react';
import type { ProjectInfo, ProjectTemplateInfo } from '@peep/shared';
import { useWorkspace } from '../../hooks/useWorkspace';
import './NewProjectModal.css';

type Mode = 'template' | 'prompt';
type Platform = 'flutter' | 'react-native';

interface NewProjectModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (project: ProjectInfo) => void;
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

const PLATFORM_META: Record<Platform, { icon: string; label: string; hint: string }> = {
  flutter: {
    icon: '🐦',
    label: 'Flutter',
    hint: 'Dart-based cross-platform. Requires Flutter SDK.',
  },
  'react-native': {
    icon: '⚛️',
    label: 'React Native',
    hint: 'JavaScript/TypeScript. Expo recommended for quick start.',
  },
};

export function NewProjectModal({ open, onClose, onCreated }: NewProjectModalProps) {
  const { syncProject } = useWorkspace();
  const [platform, setPlatform] = useState<Platform>('flutter');
  const [mode, setMode] = useState<Mode>('template');
  const [templates, setTemplates] = useState<ProjectTemplateInfo[]>([]);
  const [templateId, setTemplateId] = useState('material-app');
  const [name, setName] = useState('my_app');
  const [parentPath, setParentPath] = useState('');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!open) return;
    void window.peep.listProjectTemplates().then((items) => {
      setTemplates(items);
      if (items.length > 0) setTemplateId(items[0].id);
    });
    setError('');
    setStatus('');
  }, [open]);

  useEffect(() => {
    const unsub = window.peep.onAgentStream((event) => {
      if (event.type === 'status') setStatus(event.content);
    });
    return unsub;
  }, []);

  if (!open) return null;

  const handleSelectFolder = async () => {
    const folder = await window.peep.selectFolder();
    if (folder) setParentPath(folder);
  };

  const handleCreate = async () => {
    setError('');
    setLoading(true);
    setStatus(mode === 'prompt' ? 'Creating project…' : '');

    try {
      if (!parentPath) throw new Error('Select a parent folder.');
      if (!name.trim()) throw new Error('Enter a project name.');

      const projectName = slugify(name);
      if (!/^[a-z][a-z0-9_]*$/.test(projectName)) {
        throw new Error('Name must start with a letter and use only lowercase, numbers, underscores.');
      }

      let project: ProjectInfo;

      if (mode === 'template') {
        project = await window.peep.createProject({
          name: projectName,
          parentPath,
          templateId,
        });
      } else {
        if (!prompt.trim()) throw new Error('Describe the app you want to build.');
        setStatus(`Creating ${platform === 'flutter' ? 'Flutter' : 'React Native'} project…`);
        project = await window.peep.createProjectFromPrompt({
          name: projectName,
          parentPath,
          prompt: `[Platform: ${platform}] ${prompt.trim()}`,
        });
      }

      await syncProject(project);
      onCreated(project);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setStatus('');
    }
  };

  // Filter templates by selected platform
  const filteredTemplates = templates.filter((t) =>
    platform === 'flutter'
      ? !t.id.startsWith('rn-') && !t.id.startsWith('blank-rn')
      : t.id.startsWith('rn-') || t.id.startsWith('blank-rn'),
  );
  const displayTemplates = filteredTemplates.length > 0 ? filteredTemplates : templates;
  const selectedTemplate = displayTemplates.find((t) => t.id === templateId);

  return (
    <div className="new-project-overlay" onClick={onClose}>
      <div className="new-project-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="new-project-modal__header">
          <h2>New Project</h2>
          <button type="button" className="btn btn-ghost" onClick={onClose}>×</button>
        </div>

        {/* Platform picker */}
        <div className="new-project-platform-picker">
          {(Object.keys(PLATFORM_META) as Platform[]).map((p) => {
            const meta = PLATFORM_META[p];
            return (
              <button
                key={p}
                type="button"
                className={`platform-card ${platform === p ? 'platform-card--active' : ''}`}
                onClick={() => {
                  setPlatform(p);
                  setTemplateId('');
                }}
              >
                <span className="platform-card__icon">{meta.icon}</span>
                <span className="platform-card__label">{meta.label}</span>
                <span className="platform-card__hint">{meta.hint}</span>
              </button>
            );
          })}
        </div>

        {/* Mode tabs */}
        <div className="new-project-modal__tabs">
          <button
            type="button"
            className={`new-project-tab ${mode === 'template' ? 'new-project-tab--active' : ''}`}
            onClick={() => setMode('template')}
          >
            From Template
          </button>
          <button
            type="button"
            className={`new-project-tab ${mode === 'prompt' ? 'new-project-tab--active' : ''}`}
            onClick={() => setMode('prompt')}
          >
            From Prompt (AI)
          </button>
        </div>

        {/* Body */}
        <div className="new-project-modal__body">
          <label className="new-project-field">
            <span>Project name</span>
            <input
              value={name}
              placeholder="my_app"
              onChange={(e) => setName(e.target.value)}
            />
            <small>Folder name: {slugify(name) || '…'}</small>
          </label>

          <label className="new-project-field">
            <span>Parent folder</span>
            <div className="new-project-field__row">
              <input value={parentPath} readOnly placeholder="Select folder…" />
              <button type="button" className="btn btn-ghost" onClick={() => void handleSelectFolder()}>
                Browse
              </button>
            </div>
          </label>

          {mode === 'template' ? (
            <label className="new-project-field">
              <span>Template</span>
              {displayTemplates.length > 0 ? (
                <>
                  <select
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                  >
                    {displayTemplates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  {selectedTemplate && <small>{selectedTemplate.description}</small>}
                </>
              ) : (
                <small style={{ color: 'var(--danger)' }}>
                  No {platform === 'react-native' ? 'React Native' : 'Flutter'} templates found.
                  The project will be created with default settings.
                </small>
              )}
            </label>
          ) : (
            <label className="new-project-field">
              <span>Describe your app</span>
              <textarea
                rows={4}
                value={prompt}
                placeholder={
                  platform === 'flutter'
                    ? 'A todo app with dark mode, categories, and a floating add button…'
                    : 'A social feed app with infinite scroll, like button, and profile screen…'
                }
                onChange={(e) => setPrompt(e.target.value)}
              />
              <small>Requires OpenAI API key in Settings. AI will scaffold the initial code.</small>
            </label>
          )}

          {status && <div className="new-project-status">⏳ {status}</div>}
          {error && <div className="new-project-error">⚠ {error}</div>}
        </div>

        {/* Footer */}
        <div className="new-project-modal__footer">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleCreate()}
            disabled={loading}
          >
            {loading
              ? 'Creating…'
              : `Create ${platform === 'flutter' ? 'Flutter' : 'React Native'} Project`}
          </button>
        </div>
      </div>
    </div>
  );
}
