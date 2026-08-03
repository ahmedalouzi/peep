export interface DesignManifest {
  brandPersonality: string;
  visualDirection: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    onPrimary: string;
    onBackground: string;
    error: string;
    success: string;
    warning: string;
    neutral: Record<string, string>;
  };
  typography: {
    fontFamily: string;
    headingStyle: string;
    bodyStyle: string;
    codeFont: string;
    scaleBase: number;
  };
  spacing: {
    unit: number;
    scale: number[];
  };
  borderRadius: {
    sm: number;
    md: number;
    lg: number;
    full: number;
  };
  elevation: {
    none: string;
    sm: string;
    md: string;
    lg: string;
  };
  iconography: string;
  buttons: {
    primary: string;
    secondary: string;
  };
  inputs: string;
  cards: string;
  navigation: string;
  composition: string;
  animations: string;
  loadingState: string;
  emptyState: string;
  errorState: string;
  successState: string;
  accessibilityRules: string;
  version?: number;
  generatedAt?: string;
  lastUpdatedAt?: string;
}

export interface DesignFault {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  file: string;
  line?: number;
  description: string;
  suggestedFix: string;
}
