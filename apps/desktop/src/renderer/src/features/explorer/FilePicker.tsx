import { useEffect, useRef, useState } from 'react';
import type { FileEntry } from '@peep/shared';
import { useWorkspace } from '../../hooks/useWorkspace';
import './FilePicker.css';

interface FilePickerProps {
  open: boolean;
  onClose: () => void;
}

export function FilePicker({ open, onClose }: FilePickerProps) {
  const { project, loadFile } = useWorkspace();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FileEntry[]>([]);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setResults([]);
    setSelected(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!open || !project) return;

    const timer = setTimeout(() => {
      void window.peep.searchFiles(project.path, query).then(setResults);
    }, 120);

    return () => clearTimeout(timer);
  }, [open, project, query]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelected((s) => Math.min(s + 1, Math.max(results.length - 1, 0)));
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelected((s) => Math.max(s - 1, 0));
      }
      if (event.key === 'Enter' && results[selected]) {
        event.preventDefault();
        void loadFile(results[selected].path, results[selected].name);
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, results, selected, loadFile, onClose]);

  if (!open) return null;

  return (
    <div className="file-picker-overlay" onClick={onClose}>
      <div className="file-picker" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="file-picker__input"
          placeholder="Search files by name…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(0);
          }}
        />
        <ul className="file-picker__list">
          {results.length === 0 ? (
            <li className="file-picker__empty">Type to search project files</li>
          ) : (
            results.map((file, index) => (
              <li key={file.path}>
                <button
                  type="button"
                  className={`file-picker__item ${index === selected ? 'file-picker__item--active' : ''}`}
                  onMouseEnter={() => setSelected(index)}
                  onClick={() => {
                    void loadFile(file.path, file.name);
                    onClose();
                  }}
                >
                  <span className="file-picker__name">{file.name}</span>
                  <span className="file-picker__path">{file.path}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
