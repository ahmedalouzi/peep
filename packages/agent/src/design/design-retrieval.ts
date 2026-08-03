import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { DesignManifest } from './design-types';

export async function loadDesignManifest(projectRoot: string): Promise<DesignManifest | null> {
  try {
    const filePath = join(projectRoot, '.peep', 'design.json');
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw) as DesignManifest;
  } catch {
    return null;
  }
}

export async function saveDesignManifest(projectRoot: string, manifest: DesignManifest): Promise<void> {
  const dirPath = join(projectRoot, '.peep');
  await mkdir(dirPath, { recursive: true });
  const filePath = join(dirPath, 'design.json');
  await writeFile(filePath, JSON.stringify(manifest, null, 2), 'utf8');
}

export function serializeDesignManifest(manifest: DesignManifest): string {
  return `### App Design DNA
- **Brand Personality**: ${manifest.brandPersonality}
- **Visual Direction**: ${manifest.visualDirection}
- **Primary Color**: ${manifest.colors.primary}
- **Secondary Color**: ${manifest.colors.secondary}
- **Accent Color**: ${manifest.colors.accent}
- **Background**: ${manifest.colors.background}
- **Surface**: ${manifest.colors.surface}
- **Text Color**: ${manifest.colors.onBackground}
- **Typography Scale Base**: ${manifest.typography.scaleBase}dp
- **Iconography Concept**: ${manifest.iconography}
- **Loading State Strategy**: ${manifest.loadingState}
- **Empty State Strategy**: ${manifest.emptyState}
- **Error State Strategy**: ${manifest.errorState}
- **Accessibility Minimum Target**: ${manifest.accessibilityRules}`;
}
