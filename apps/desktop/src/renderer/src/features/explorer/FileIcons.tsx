export function getFileIcon(filename: string) {
  const name = filename.toLowerCase();

  if (name === 'package.json' || name === 'package-lock.json') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#238636" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
        <line x1="12" y1="22.08" x2="12" y2="12"></line>
      </svg>
    );
  }

  if (name.includes('tsconfig') || name.endsWith('.ts')) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3178c6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16v16H4z"/>
        <path d="M9 9v6"/>
        <path d="M7 9h4"/>
        <path d="M17 14.5c0 1.5-2 1.5-2 1.5s-2 0-2-1.5 2-1.5 2-1.5-2 0-2-1.5 2-1.5 2-1.5 2 0 2 1.5-2 1.5-2 1.5"/>
      </svg>
    );
  }

  if (name.endsWith('.tsx') || name.endsWith('.jsx')) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#61dafb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="2"/>
        <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(30 12 12)"/>
        <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(90 12 12)"/>
        <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(150 12 12)"/>
      </svg>
    );
  }

  if (name.endsWith('.js')) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f7df1e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M15 17c-1.5 0-2-1-2-1.5M10 17v-8M17 11c0-1.5-2-1.5-2-1.5s-2 0-2 1.5 2 1.5 2 1.5 2 0 2-1.5" />
      </svg>
    );
  }

  if (name.endsWith('.json')) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#238636" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16v16H4z"/>
        <path d="M9 12h6"/>
        <path d="M12 9v6"/>
      </svg>
    );
  }

  if (name === '.gitignore' || name.endsWith('.git')) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f14e32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 22 12 12 22 2 12 12 2"></polygon>
        <path d="M12 8v8"/>
        <line x1="8" y1="12" x2="16" y2="12"/>
      </svg>
    );
  }

  if (name.endsWith('.md')) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#58a6ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M7 15V9l2.5 2.5L12 9v6" />
        <path d="M18 15V9" />
        <path d="M15 12l3 3 3-3" />
      </svg>
    );
  }

  if (name.endsWith('.html')) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e34f26" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4l1.5 13.5L12 20l6.5-2.5L20 4H4z"/>
        <path d="M17 8H7.5l.5 4h8l-.5 4.5-3.5 1-3.5-1-.25-2.5"/>
      </svg>
    );
  }

  if (name.endsWith('.css')) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#264de4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4l1.5 13.5L12 20l6.5-2.5L20 4H4z"/>
        <path d="M16 8H8l.5 4h7l-.5 4.5-3 1-3-1-.25-2.5"/>
      </svg>
    );
  }
  
  if (name.endsWith('.dart') || name === 'pubspec.yaml') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0175c2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22l-8-8 8-8 8 8z"/>
        <path d="M4 14l8-8 8 8"/>
      </svg>
    );
  }

  if (name.endsWith('.yaml') || name.endsWith('.yml')) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b949e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16v16H4z"/>
        <path d="M8 8h8M8 12h8M8 16h4"/>
      </svg>
    );
  }

  // Default file icon
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b949e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
      <polyline points="13 2 13 9 20 9"></polyline>
    </svg>
  );
}

export function FolderIcon({ isOpen }: { isOpen: boolean }) {
  if (isOpen) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#58a6ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        <line x1="12" y1="11" x2="12" y2="17"></line>
        <line x1="9" y1="14" x2="15" y2="14"></line>
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#58a6ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
    </svg>
  );
}
