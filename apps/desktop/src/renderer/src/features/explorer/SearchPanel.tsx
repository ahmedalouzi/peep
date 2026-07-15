import { useState, useCallback } from 'react';
import { useWorkspaceStore } from '../../stores/workspace-store';
import { useWorkspace } from '../../hooks/useWorkspace';

interface SearchMatch {
  file: string;
  line: number;
  col: number;
  text: string;
}

interface SearchResult {
  file: string;       // relative path
  fullPath: string;
  matches: SearchMatch[];
}

export function SearchPanel() {
  const project = useWorkspaceStore((s) => s.project);
  const { openFile } = useWorkspace();

  const [query, setQuery]     = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const doSearch = useCallback(async (q: string) => {
    if (!project || !q.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const raw = await (window.peep as any).searchContent({
        projectPath: project.path,
        query: q,
        caseSensitive,
        isRegex: useRegex,
      }) as SearchMatch[];

      // Group by file
      const map = new Map<string, SearchResult>();
      for (const m of raw) {
        const rel = m.file.replace(project.path, '').replace(/^[\\/]/, '');
        if (!map.has(rel)) map.set(rel, { file: rel, fullPath: m.file, matches: [] });
        map.get(rel)!.matches.push(m);
      }
      setResults([...map.values()]);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [project, caseSensitive, useRegex]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') void doSearch(query);
  };

  const handleOpenFile = (fullPath: string, content = '') => {
    const name = fullPath.split(/[\\/]/).pop() ?? 'file';
    openFile({ path: fullPath, name, content, dirty: false });
  };

  const toggleCollapse = (file: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(file)) next.delete(file); else next.add(file);
      return next;
    });
  };

  const total = results.reduce((acc, r) => acc + r.matches.length, 0);

  return (
    <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="sidebar-header">
        <span className="sidebar-title">SEARCH</span>
      </div>

      {/* Search input */}
      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ position: 'relative' }}>
          <input
            autoFocus
            type="text"
            placeholder="Search in files…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              width: '100%',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              padding: '6px 32px 6px 8px',
              fontSize: '12px',
              color: 'var(--text-primary)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <button
            onClick={() => void doSearch(query)}
            disabled={!query.trim() || loading}
            style={{
              position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
              padding: '2px', display: 'flex', alignItems: 'center',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </button>
        </div>

        {/* Options */}
        <div style={{ display: 'flex', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} style={{ width: '11px', height: '11px' }} />
            Aa
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={useRegex} onChange={(e) => setUseRegex(e.target.checked)} style={{ width: '11px', height: '11px' }} />
            .*
          </label>
        </div>

        {/* Status */}
        {searched && !loading && (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {total > 0
              ? `${total} result${total > 1 ? 's' : ''} in ${results.length} file${results.length > 1 ? 's' : ''}`
              : 'No results found'}
          </div>
        )}
        {loading && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Searching…</div>}
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 8px' }}>
        {results.map((result) => {
          const isCollapsed = collapsed.has(result.file);
          return (
            <div key={result.file}>
              {/* File header */}
              <button
                onClick={() => toggleCollapse(result.file)}
                style={{
                  width: '100%', textAlign: 'left', background: 'none', border: 'none',
                  padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '6px',
                  cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '12px',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              >
                <span style={{ opacity: 0.6, fontSize: '9px' }}>{isCollapsed ? '▶' : '▼'}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {result.file}
                </span>
                <span style={{
                  background: 'var(--accent)', color: '#fff', fontSize: '10px',
                  borderRadius: '8px', padding: '1px 5px', flexShrink: 0,
                }}>
                  {result.matches.length}
                </span>
              </button>

              {/* Matches */}
              {!isCollapsed && result.matches.map((m, i) => (
                <button
                  key={i}
                  onClick={() => handleOpenFile(result.fullPath)}
                  style={{
                    width: '100%', textAlign: 'left', background: 'none', border: 'none',
                    padding: '3px 10px 3px 24px', cursor: 'pointer', display: 'flex',
                    alignItems: 'baseline', gap: '8px',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                >
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0, minWidth: '28px', textAlign: 'right' }}>
                    {m.line}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-code)' }}>
                    {m.text.trim()}
                  </span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
