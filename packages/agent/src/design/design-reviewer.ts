import { DesignManifest, DesignFault } from './design-types';

export class DesignReviewer {
  static evaluateUI(fileContent: string, filepath: string, manifest: DesignManifest): DesignFault[] {
    const faults: DesignFault[] = [];
    const lines = fileContent.split('\n');

    // 1. Verify hardcoded colors violating Design DNA
    // Avoid hardcoded hex colors like #fff, #ffffff, #000, #000000, or colors not in the manifest
    const hexRegex = /#([0-9a-fA-F]{3,6})\b/g;
    const allowedColors = [
      manifest.colors.primary.toLowerCase(),
      manifest.colors.secondary.toLowerCase(),
      manifest.colors.accent.toLowerCase(),
      manifest.colors.background.toLowerCase(),
      manifest.colors.surface.toLowerCase(),
      '#ffffff',
      '#000000',
      '#fff',
      '#000',
      'transparent'
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] || '';
      let match;
      while ((match = hexRegex.exec(line)) !== null) {
        const hex = match[0].toLowerCase();
        if (!allowedColors.includes(hex)) {
          faults.push({
            severity: 'medium',
            category: 'color_consistency',
            file: filepath,
            line: i + 1,
            description: `Hardcoded color '${hex}' detected. Use manifest color tokens instead: primary ('${manifest.colors.primary}'), accent ('${manifest.colors.accent}'), background ('${manifest.colors.background}').`,
            suggestedFix: `Replace '${hex}' with Design DNA token references.`
          });
        }
      }
    }

    // 2. Check for missing error/loading/empty states in screens/components
    const contentLower = fileContent.toLowerCase();
    if (filepath.endsWith('App.tsx') || filepath.includes('screen') || filepath.includes('page')) {
      if (!contentLower.includes('load') && !contentLower.includes('activityindicator') && !contentLower.includes('spinner')) {
        faults.push({
          severity: 'high',
          category: 'missing_states',
          file: filepath,
          description: "No loading state handler (e.g. ActivityIndicator or 'loading' variable) detected in user-facing view.",
          suggestedFix: "Inject a 'loading' visual state handler or spinner."
        });
      }
      if (!contentLower.includes('error') && !contentLower.includes('fail') && !contentLower.includes('wrong')) {
        faults.push({
          severity: 'high',
          category: 'missing_states',
          file: filepath,
          description: "No error state boundaries or descriptive warning visuals found.",
          suggestedFix: "Implement error handling states in visual composition."
        });
      }
      if (!contentLower.includes('empty') && !contentLower.includes('no reservation') && !contentLower.includes('none')) {
        faults.push({
          severity: 'medium',
          category: 'missing_states',
          file: filepath,
          description: "Missing empty states handling for collections or lists.",
          suggestedFix: "Add a placeholder screen or conditional view for empty datasets."
        });
      }
    }

    // 3. Spacing scale consistency checks
    // Verify style margin/padding properties conform to scale
    const spacingRegex = /(?:margin|padding)(?:Top|Bottom|Left|Right|Horizontal|Vertical)?\s*:\s*(\d+)/g;
    const allowedScale = manifest.spacing.scale;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] || '';
      let match;
      while ((match = spacingRegex.exec(line)) !== null) {
        const val = parseInt(match[1] || '0', 10);
        if (val > 0 && !allowedScale.includes(val)) {
          faults.push({
            severity: 'low',
            category: 'spacing_scale',
            file: filepath,
            line: i + 1,
            description: `Spacing value '${val}' does not match Design DNA scale: [${allowedScale.join(', ')}].`,
            suggestedFix: `Adjust spacing value to the nearest scale unit (e.g. 8, 12, 16, 24).`
          });
        }
      }
    }

    return faults;
  }
}
