import Editor, { type OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { useCallback, useRef } from 'react';
import './MonacoEditor.css';

interface MonacoEditorProps {
  path: string;
  value: string;
  onChange: (value: string) => void;
  onSave?: () => void;
}

function languageForPath(filePath: string): string {
  if (filePath.endsWith('.dart')) return 'dart';
  if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) return 'yaml';
  if (filePath.endsWith('.json')) return 'json';
  if (filePath.endsWith('.md')) return 'markdown';
  if (filePath.endsWith('.html')) return 'html';
  if (filePath.endsWith('.css')) return 'css';
  if (filePath.endsWith('.js')) return 'javascript';
  if (filePath.endsWith('.ts')) return 'typescript';
  return 'plaintext';
}

export function MonacoEditor({ path, value, onChange, onSave }: MonacoEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleMount: OnMount = useCallback(
    (editorInstance, monaco) => {
      editorRef.current = editorInstance;

      editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        onSave?.();
      });

      editorInstance.focus();
    },
    [onSave],
  );

  return (
    <div className="monaco-editor-host">
      <Editor
        path={path}
        language={languageForPath(path)}
        theme="vs-dark"
        value={value}
        onChange={(next) => onChange(next ?? '')}
        onMount={handleMount}
        options={{
          fontFamily: "'Cascadia Code', Consolas, monospace",
          fontSize: 13,
          lineHeight: 20,
          minimap: { enabled: true },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: 'on',
          padding: { top: 12 },
          renderWhitespace: 'selection',
          bracketPairColorization: { enabled: true },
        }}
      />
    </div>
  );
}
