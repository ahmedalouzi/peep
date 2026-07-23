import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Design DNA / Design Manifest
 * Stored at <projectRoot>/.peep/design.json
 * Automatically created and maintained by the AI Agent.
 */
export interface DesignManifest {
  // Brand identity
  brandPersonality: string;         // e.g. "professional, trustworthy, clean"
  targetAudience: string;           // e.g. "busy urban professionals aged 25-40"
  visualDirection: string;          // e.g. "minimalist dark-mode SaaS"

  // Color system
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
    neutral: Record<string, string>; // e.g. { "50": "#fafafa", "100": "#f4f4f5", ... }
  };

  // Typography
  typography: {
    fontFamily: string;             // e.g. "Inter, system-ui"
    headingStyle: string;           // e.g. "bold, large, tight tracking"
    bodyStyle: string;              // e.g. "regular weight, relaxed line height"
    codeFont: string;
    scaleBase: number;              // base font size in dp/sp
  };

  // Spacing & geometry
  spacing: {
    unit: number;                   // base unit in dp
    scale: number[];                // e.g. [4, 8, 12, 16, 24, 32, 48]
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

  // Component styles
  buttons: {
    primary: string;                // e.g. "filled, rounded-full, bold label"
    secondary: string;
    ghost: string;
    destructive: string;
    height: number;
  };
  cards: {
    style: string;                  // e.g. "glassmorphism with soft border"
    radius: number;
    shadow: string;
    padding: number;
  };

  // Navigation
  navigation: {
    pattern: string;                // e.g. "bottom tab bar" | "drawer" | "nested"
    tabCount: number;
    style: string;
  };

  // Icons & motion
  iconStyle: string;               // e.g. "outlined", "filled", "duotone"
  motion: {
    defaultDuration: string;        // e.g. "250ms"
    easing: string;                 // e.g. "easeInOutCubic"
    principleNotes: string;         // e.g. "Micro-interactions for feedback, no heavy animations"
  };

  // States
  loadingState: string;            // e.g. "shimmer skeleton, branded primary color"
  emptyState: string;              // e.g. "centered icon + body text + CTA button"
  errorState: string;              // e.g. "inline error banner with retry action"

  // Accessibility
  accessibility: {
    minimumContrastRatio: number;
    minimumTapTarget: number;
    notes: string;
  };

  // Component patterns (framework-specific notes)
  componentPatterns: string;

  // Metadata
  projectType: string;             // e.g. "flutter", "react-native", "web"
  generatedAt: string;
  lastUpdatedAt: string;
  version: number;
}

const DESIGN_FILE = '.peep/design.json';

export async function loadDesignManifest(projectRoot: string): Promise<DesignManifest | null> {
  try {
    const path = join(projectRoot, DESIGN_FILE);
    const raw = await readFile(path, 'utf-8');
    return JSON.parse(raw) as DesignManifest;
  } catch {
    return null;
  }
}

export async function saveDesignManifest(projectRoot: string, manifest: DesignManifest): Promise<void> {
  const dir = join(projectRoot, '.peep');
  await mkdir(dir, { recursive: true });
  await writeFile(join(projectRoot, DESIGN_FILE), JSON.stringify(manifest, null, 2), 'utf-8');
}

/**
 * Serialize the Design Manifest into a compact prompt-friendly string
 * that can be injected into the Agent's system context.
 */
export function serializeDesignManifest(manifest: DesignManifest): string {
  return `\
=== PROJECT DESIGN MANIFEST (.peep/design.json) ===
Brand: ${manifest.brandPersonality}
Audience: ${manifest.targetAudience}
Visual Direction: ${manifest.visualDirection}
Project Type: ${manifest.projectType}

COLOR SYSTEM:
  Primary: ${manifest.colors.primary}
  Secondary: ${manifest.colors.secondary}
  Accent: ${manifest.colors.accent}
  Background: ${manifest.colors.background}
  Surface: ${manifest.colors.surface}
  Error: ${manifest.colors.error}

TYPOGRAPHY:
  Font: ${manifest.typography.fontFamily}
  Heading: ${manifest.typography.headingStyle}
  Body: ${manifest.typography.bodyStyle}
  Base size: ${manifest.typography.scaleBase}dp

SPACING & GEOMETRY:
  Unit: ${manifest.spacing.unit}dp | Scale: [${manifest.spacing.scale.join(', ')}]
  Border radius: sm=${manifest.borderRadius.sm} md=${manifest.borderRadius.md} lg=${manifest.borderRadius.lg} full=${manifest.borderRadius.full}

COMPONENTS:
  Buttons: primary="${manifest.buttons.primary}", height=${manifest.buttons.height}dp
  Cards: ${manifest.cards.style}, radius=${manifest.cards.radius}dp
  Icons: ${manifest.iconStyle}
  Navigation: ${manifest.navigation.pattern} (${manifest.navigation.tabCount} tabs)

MOTION: ${manifest.motion.defaultDuration} / ${manifest.motion.easing}
  ${manifest.motion.principleNotes}

STATES:
  Loading: ${manifest.loadingState}
  Empty: ${manifest.emptyState}
  Error: ${manifest.errorState}

ACCESSIBILITY:
  Contrast ratio ≥ ${manifest.accessibility.minimumContrastRatio}
  Tap target ≥ ${manifest.accessibility.minimumTapTarget}dp
  ${manifest.accessibility.notes}

COMPONENT PATTERNS: ${manifest.componentPatterns}

IMPORTANT: You MUST follow this Design Manifest for all UI generation. Do NOT deviate from the established design language. Every new screen, widget, or component must use these exact tokens.
===`;
}
