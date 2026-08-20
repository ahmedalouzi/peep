export const theme = {
  colors: {
    background: '#0F172A',
    surface: '#1E293B',
    card: '#334155',
    border: '#475569',
    primary: '#6366F1',
    primaryDark: '#4F46E5',
    accent: '#10B981',
    error: '#EF4444',
    textPrimary: '#F8FAFC',
    textMuted: '#94A3B8',
    white: '#FFFFFF',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  typography: {
    fontSizes: {
      sm: 14,
      md: 16,
      lg: 20,
      xl: 28,
      xxl: 64,
    },
    weights: {
      regular: '400' as const,
      medium: '500' as const,
      semibold: '600' as const,
      bold: '700' as const,
    },
  },
  borderRadius: {
    sm: 8,
    md: 16,
    lg: 24,
    full: 9999,
  },
} as const;

export type Theme = typeof theme;
