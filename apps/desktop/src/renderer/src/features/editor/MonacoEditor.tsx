import Editor, { type OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { useCallback, useEffect, useRef } from 'react';
import './MonacoEditor.css';
import { useDiagnosticsStore } from '../../stores/preview-store';
import { emmetHTML, emmetCSS, emmetJSX } from 'emmet-monaco-es';

let emmetInitialized = false;

interface MonacoEditorProps {
  path: string;
  value: string;
  onChange: (value: string) => void;
  onSave?: () => void;
}

function languageForPath(filePath: string): string {
  const lower    = filePath.toLowerCase();
  // Detect .env files by basename (e.g. .env, .env.local, .env.example)
  const basename = lower.replace(/\\/g, '/').split('/').pop() ?? '';
  if (basename === '.env' || basename.startsWith('.env.') || basename.endsWith('.env')) {
    return 'dotenv';
  }

  const ext = lower.split('.').pop() ?? '';

  const map: Record<string, string> = {
    // Web
    'html': 'html',  'htm': 'html',
    'css':  'css',   'scss': 'scss', 'sass': 'scss', 'less': 'less',
    'js':   'javascript', 'mjs': 'javascript', 'cjs': 'javascript',
    'jsx':  'javascript',
    'ts':   'typescript', 'mts': 'typescript', 'cts': 'typescript',
    'tsx':  'typescript',
    // Data / config
    'json': 'json', 'jsonc': 'json',
    'yaml': 'yaml', 'yml': 'yaml',
    'toml': 'ini',
    'xml':  'xml',
    'svg':  'xml',
    'env':  'dotenv',
    // Database
    'sql':  'sql',
    'psql': 'sql',
    // Docs
    'md':   'markdown', 'mdx': 'markdown',
    // Shell
    'sh':   'shell', 'bash': 'shell', 'zsh': 'shell',
    'bat':  'bat',   'cmd': 'bat',
    'ps1':  'powershell',
    // Mobile / cross-platform
    'dart':   'dart',
    'kt':     'kotlin',
    'kts':    'kotlin',
    'swift':  'swift',
    // Backend
    'py':     'python',
    'pyw':    'python',
    'rb':     'ruby',
    'go':     'go',
    'rs':     'rust',
    'java':   'java',
    'cs':     'csharp',
    'php':    'php',
    // Systems
    'c':      'c',
    'h':      'c',
    'cpp':    'cpp',
    'cxx':    'cpp',
    'cc':     'cpp',
    'hpp':    'cpp',
    // Query / API
    'graphql': 'graphql',
    'gql':     'graphql',
    // Docker / infra
    'dockerfile': 'dockerfile',
    'tf':    'hcl',
    'hcl':   'hcl',
    // Other
    'r':     'r',
    'lua':   'lua',
    'proto': 'proto',
    'gitignore': 'plaintext',
  };

  return map[ext] ?? 'plaintext';
}

export function MonacoEditor({ path, value, onChange, onSave }: MonacoEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleMount: OnMount = useCallback(
    (editorInstance, monaco) => {
      editorRef.current = editorInstance;

      editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        onSave?.();
      });

      editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
        window.dispatchEvent(
          new CustomEvent('peep:open-composer', {
            detail: { filePath: path },
          })
        );
      });

      editorInstance.focus();

      if (!emmetInitialized) {
        try {
          emmetHTML(monaco, ['html', 'htm', 'xml', 'markdown']);
          emmetCSS(monaco, ['css', 'scss', 'sass', 'less']);
          emmetJSX(monaco, ['javascript', 'typescript', 'javascriptreact', 'typescriptreact', 'jsx', 'tsx']);
          emmetInitialized = true;
        } catch (err) {
          console.error('Failed to initialize emmet:', err);
        }
      }

      /* ── Bridge Monaco markers → DiagnosticsStore ── */
      const syncMarkers = () => {
        const allMarkers: any[] = monaco.editor.getModelMarkers({});
        const items = allMarkers
          .filter((m: any) => m.severity >= 4) // Warning(4) Error(8)
          .map((m: any) => ({
            file:     (m.resource?.path ?? m.resource?.toString() ?? '').replace(/^\//, ''),
            line:     m.startLineNumber,
            column:   m.startColumn,
            message:  m.message,
            severity: (m.severity >= 8 ? 'error' : 'warning') as 'error' | 'warning',
          }));
        useDiagnosticsStore.getState().setItems(items);
      };

      monaco.editor.onDidChangeMarkers(() => syncMarkers());
      syncMarkers();
    },
    [onSave],
  );

  /* ── Go-to-line event listener ── */
  useEffect(() => {
    const onGoToLine = (e: Event) => {
      const ed = editorRef.current;
      if (!ed) return;
      const { line, col } = (e as CustomEvent<{ line: number; col: number }>).detail;
      ed.revealLineInCenter(line);
      ed.setPosition({ lineNumber: line, column: col ?? 1 });
      ed.focus();
    };
    window.addEventListener('peep:go-to-line', onGoToLine);
    return () => window.removeEventListener('peep:go-to-line', onGoToLine);
  }, []);

  const handleBeforeMount = useCallback((monaco: any) => {
    /* ── Configure TypeScript Compiler ── */
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.CommonJS,
      noEmit: true,
      esModuleInterop: true,
      jsx: monaco.languages.typescript.JsxEmit.React,
      reactNamespace: 'React',
      allowJs: true,
      typeRoots: ['node_modules/@types']
    });

    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      allowNonTsExtensions: true,
      jsx: monaco.languages.typescript.JsxEmit.React,
      allowJs: true,
    });

    /* ── Register dotenv language ── */
    if (!monaco.languages.getLanguages().some((l: any) => l.id === 'dotenv')) {
      monaco.languages.register({ id: 'dotenv', extensions: ['.env'], filenames: ['.env'] });
      monaco.languages.setMonarchTokensProvider('dotenv', {
        tokenizer: {
          root: [
            // Comment lines
            [/^\s*#.*$/,                    'comment.env'],
            // KEY part (before =)
            [/^[A-Za-z_][A-Za-z0-9_.]*(?=\s*=)/, 'variable.env'],
            // = sign
            [/=/,                           'operator.env'],
            // Quoted strings
            [/"[^"]*"/,                     'string.env'],
            [/'[^']*'/,                     'string.env'],
            // URLs
            [/https?:\/\/[^\s]+/,           'string.link.env'],
            // Numbers
            [/\b\d+\b/,                     'number.env'],
            // Boolean-ish values
            [/\b(true|false|yes|no|on|off)\b/i, 'keyword.env'],
            // Remaining value text
            [/[^\s#]+/,                     'string.value.env'],
          ],
        },
      });
    }

    /* ── Define theme ── */
    monaco.editor.defineTheme('peep-theme', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        // ── Generic language rules ──────────────────────────────────
        { token: 'keyword',           foreground: '569cd6', fontStyle: 'bold' },
        { token: 'keyword.sql',       foreground: '569cd6', fontStyle: 'bold' },
        { token: 'string',            foreground: 'ce9178' },
        { token: 'string.sql',        foreground: 'ce9178' },
        { token: 'number',            foreground: 'b5cea8' },
        { token: 'number.sql',        foreground: 'b5cea8' },
        { token: 'comment',           foreground: '6a9955', fontStyle: 'italic' },
        { token: 'comment.sql',       foreground: '6a9955', fontStyle: 'italic' },
        { token: 'type',              foreground: '4ec9b0' },
        { token: 'type.identifier',   foreground: '4ec9b0' },
        { token: 'predefined',        foreground: 'dcdcaa' },
        { token: 'predefined.sql',    foreground: 'dcdcaa' },
        { token: 'operator',          foreground: 'd4d4d4' },
        { token: 'operator.sql',      foreground: 'd4d4d4' },
        { token: 'identifier',        foreground: '9cdcfe' },
        { token: 'identifier.sql',    foreground: '9cdcfe' },
        // ── .env specific ───────────────────────────────────────────
        // Comments  → muted green italic
        { token: 'comment.env',       foreground: '6a9955', fontStyle: 'italic' },
        // Key name  → cyan-blue (like variable in TS)
        { token: 'variable.env',      foreground: '9cdcfe', fontStyle: 'bold' },
        // = sign    → dim gray
        { token: 'operator.env',      foreground: '808080' },
        // Quoted / plain string values → warm orange
        { token: 'string.env',        foreground: 'ce9178' },
        { token: 'string.value.env',  foreground: 'ce9178' },
        // URLs      → underlined light blue
        { token: 'string.link.env',   foreground: '4fc1ff', fontStyle: 'underline' },
        // Numbers   → light mint green
        { token: 'number.env',        foreground: 'b5cea8' },
        // true/false/yes/no → purple keyword
        { token: 'keyword.env',       foreground: 'c586c0', fontStyle: 'italic' },
      ],
      colors: {
        'editorLineNumber.foreground':       '#4b656b',
        'editorLineNumber.activeForeground': '#34d399',
        'editor.lineHighlightBackground':    '#ffffff0a',
        'editor.background':                 '#030409',
        'editor.selectionBackground':        '#264f78',
        'editorCursor.foreground':           '#aeafad',
        'editorIndentGuide.background':      '#ffffff12',
      },
    });
  }, []);

  return (
    <div className="monaco-editor-host">
      <Editor
        path={path}
        language={languageForPath(path)}
        theme="peep-theme"
        value={value}
        onChange={(next) => onChange(next ?? '')}
        beforeMount={handleBeforeMount}
        onMount={handleMount}
        options={{
          fontFamily: "'Cascadia Code', 'JetBrains Mono', Consolas, monospace",
          fontSize: 14,
          lineHeight: 22,
          minimap: { enabled: true },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: 'on',
          padding: { top: 12 },
          renderWhitespace: 'selection',
          bracketPairColorization: { enabled: true },
          lineNumbers: 'on',
          lineNumbersMinChars: 3,
          glyphMargin: false,
        }}
      />
    </div>
  );
}
