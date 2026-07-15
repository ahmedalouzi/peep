function TextIcon({ text, color, size = "12" }: { text: string; color: string; size?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <text x="12" y="16.5" fill={color} stroke="none" fontSize={size} fontWeight="800" textAnchor="middle" fontFamily="sans-serif" letterSpacing="0.5">{text}</text>
    </svg>
  );
}

export function getFileIcon(filename: string) {
  const name = filename.toLowerCase();

  if (name === 'package.json' || name === 'package-lock.json' || name === 'pnpm-lock.yaml') {
    return <TextIcon text="npm" color="#cb3837" size="13" />;
  }
  if (name.includes('tsconfig') || name.endsWith('.ts')) {
    return <TextIcon text="TS" color="#3178c6" />;
  }
  if (name.endsWith('.tsx') || name.endsWith('.jsx')) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#61dafb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="2" fill="#61dafb" />
        <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(30 12 12)"/>
        <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(90 12 12)"/>
        <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(150 12 12)"/>
      </svg>
    );
  }
  if (name.endsWith('.js')) {
    return <TextIcon text="JS" color="#f7df1e" />;
  }
  if (name.endsWith('.json')) {
    return <TextIcon text="{}" color="#238636" size="14" />;
  }
  if (name === '.gitignore' || name.endsWith('.git')) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f14e32" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 22 12 12 22 2 12 12 2"></polygon>
        <line x1="8" y1="12" x2="16" y2="12"></line>
      </svg>
    );
  }
  if (name.endsWith('.md')) {
    return <TextIcon text="M↓" color="#58a6ff" size="13" />;
  }
  if (name.endsWith('.html')) {
    return <TextIcon text="<>" color="#e34f26" size="14" />;
  }
  if (name.endsWith('.css')) {
    return <TextIcon text="#" color="#264de4" size="15" />;
  }
  if (name.endsWith('.dart') || name === 'pubspec.yaml') {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="1" y="1" width="16" height="16" rx="3" fill="#0468D7"/>
        {/* White D lettermark */}
        <path
          d="M5 4.5 L5 13.5 L9.5 13.5 Q14 13.5 14 9 Q14 4.5 9.5 4.5 Z"
          fill="white"
        />
        <path
          d="M7 6.5 L9.2 6.5 Q11.8 6.5 11.8 9 Q11.8 11.5 9.2 11.5 L7 11.5 Z"
          fill="#0468D7"
        />
      </svg>
    );
  }
  if (name.endsWith('.yaml') || name.endsWith('.yml')) {
    return <TextIcon text="YML" color="#8b949e" size="10" />;
  }
  if (name.endsWith('.py') || name.endsWith('.pyw')) {
    return <TextIcon text="PY" color="#3572A5" />;
  }
  if (name.endsWith('.csv')) {
    return <TextIcon text="CSV" color="#238636" size="10" />;
  }
  if (name === '.env' || name.startsWith('.env.')) {
    return <TextIcon text="ENV" color="#e3e15b" size="10" />;
  }
  if (name === 'dockerfile' || name === 'docker-compose.yml') {
    return <TextIcon text="DKR" color="#2496ed" size="10" />;
  }
  if (name.endsWith('.sh') || name.endsWith('.bash')) {
    return <TextIcon text="SH" color="#89e051" />;
  }
  if (name.endsWith('.rs')) {
    return <TextIcon text="RS" color="#dea584" />;
  }
  if (name.endsWith('.go')) {
    return <TextIcon text="GO" color="#00ADD8" />;
  }
  if (name.endsWith('.java') || name.endsWith('.jar')) {
    return <TextIcon text="☕" color="#b07219" />;
  }
  if (name.endsWith('.c') || name.endsWith('.h')) {
    return <TextIcon text="C" color="#555555" />;
  }
  if (name.endsWith('.cpp') || name.endsWith('.hpp')) {
    return <TextIcon text="C++" color="#f34b7d" size="10" />;
  }
  if (name.endsWith('.rb')) {
    return <TextIcon text="RB" color="#701516" />;
  }
  if (name.endsWith('.php')) {
    return <TextIcon text="PHP" color="#4F5D95" size="10" />;
  }
  if (name.endsWith('.sql') || name.endsWith('.sqlite') || name.endsWith('.sqlite3') || name.endsWith('.db')) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e05252" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {/* Cylinder body left/right sides */}
        <line x1="4" y1="7" x2="4" y2="17"/>
        <line x1="20" y1="7" x2="20" y2="17"/>
        {/* Top ellipse */}
        <ellipse cx="12" cy="7" rx="8" ry="3"/>
        {/* Middle ring */}
        <path d="M4 12 C4 13.66 7.58 15 12 15 C16.42 15 20 13.66 20 12"/>
        {/* Bottom ellipse */}
        <ellipse cx="12" cy="17" rx="8" ry="3"/>
      </svg>
    );
  }

  // Default file icon
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b949e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
      <polyline points="13 2 13 9 20 9"></polyline>
    </svg>
  );
}

export function FolderIcon({ isOpen }: { isOpen: boolean }) {
  if (isOpen) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#58a6ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        <line x1="12" y1="11" x2="12" y2="17"></line>
        <line x1="9" y1="14" x2="15" y2="14"></line>
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#58a6ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
    </svg>
  );
}
