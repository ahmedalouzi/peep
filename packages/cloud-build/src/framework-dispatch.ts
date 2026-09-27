// packages/cloud-build/src/framework-dispatch.ts
// Determines the build commands and artifact paths for each framework.
// Pure logic — no I/O, no Docker calls. Fully unit-testable in isolation.

import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';

export type Framework = 'flutter' | 'react-native';
export type Target = 'apk' | 'aab' | 'both';

// ── Command dispatch ──────────────────────────────────────────────────────────

/**
 * Returns the ordered sequence of shell command arrays to execute for the build.
 * Each inner array is [binary, ...args] passed to child_process.spawn (no shell injection).
 *
 * React Native note: uses `./gradlew assembleRelease` directly.
 *   - NOT `expo build:android` (deprecated; sends code to Expo's servers)
 *   - NOT `npx react-native build-android` (thin wrapper; adds unnecessary process)
 *   - `./gradlew` works identically for bare RN and ejected Expo projects.
 */
export function getBuildCommands(
  framework: Framework,
  target: Target,
  versionName: string,
  versionCode: number,
): string[][] {
  if (framework === 'flutter') {
    const cmds: string[][] = [
      ['flutter', 'pub', 'get'],
    ];
    if (target === 'apk' || target === 'both') {
      cmds.push([
        'flutter', 'build', 'apk', '--release',
        '--build-name', versionName,
        '--build-number', String(versionCode),
      ]);
    }
    if (target === 'aab' || target === 'both') {
      cmds.push([
        'flutter', 'build', 'appbundle', '--release',
        '--build-name', versionName,
        '--build-number', String(versionCode),
      ]);
    }
    return cmds;
  }

  if (framework === 'react-native') {
    return [
      ['npm', 'install', '--legacy-peer-deps'],
      // cd is not possible with child_process.spawn directly — use sh -c
      // chmod +x ensures gradlew is executable even if tarball lost permissions
      ['sh', '-c',
        `cd android && chmod +x ./gradlew && ./gradlew assembleRelease ` +
        `-PversionName=${versionName} -PversionCode=${versionCode}`],
    ];
  }

  throw new Error(`Unknown framework: ${String(framework)}`);
}

// ── Artifact path resolution ──────────────────────────────────────────────────

export interface ArtifactPaths {
  apk?: string;   // Relative to build dir inside container
  aab?: string;
}

/**
 * Returns the expected artifact paths inside the container after a successful build.
 * These are used by the worker to docker cp the output files.
 */
export function getArtifactPaths(framework: Framework, target: Target): ArtifactPaths {
  if (framework === 'flutter') {
    return {
      ...(target !== 'aab'  ? { apk: 'build/app/outputs/flutter-apk/app-release.apk' } : {}),
      ...(target !== 'apk'  ? { aab: 'build/app/outputs/bundle/release/app-release.aab' } : {}),
    };
  }
  if (framework === 'react-native') {
    return {
      ...(target !== 'aab'  ? { apk: 'android/app/build/outputs/apk/release/app-release.apk' } : {}),
      ...(target !== 'apk'  ? { aab: 'android/app/build/outputs/bundle/release/app-release.aab' } : {}),
    };
  }
  throw new Error(`Unknown framework: ${String(framework)}`);
}

// ── Framework detection / validation ─────────────────────────────────────────

/**
 * Reads the project directory and detects which framework it is.
 * Returns null if the project cannot be identified.
 */
export async function detectFramework(buildDir: string): Promise<Framework | null> {
  // pubspec.yaml → Flutter
  try {
    await access(join(buildDir, 'pubspec.yaml'));
    return 'flutter';
  } catch { /* not Flutter */ }

  // package.json with react-native or expo dep → React Native
  try {
    const raw = await readFile(join(buildDir, 'package.json'), 'utf-8');
    const pkg = JSON.parse(raw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if ('react-native' in deps || 'expo' in deps) {
      return 'react-native';
    }
  } catch { /* not RN */ }

  return null;
}

/**
 * Validates that the project in buildDir matches the declared framework.
 * Throws a descriptive error if there is a mismatch.
 * Called by the worker before executing any build command.
 */
export async function validateFramework(
  buildDir: string,
  declared: Framework,
): Promise<void> {
  const detected = await detectFramework(buildDir);

  if (detected === null) {
    throw new Error(
      `Framework detection failed: no pubspec.yaml or package.json with ` +
      `react-native/expo found in ${buildDir}`,
    );
  }

  if (detected !== declared) {
    throw new Error(
      `Framework mismatch: job declared '${declared}' but project appears ` +
      `to be '${detected}'. Detected: ` +
      (detected === 'flutter' ? 'pubspec.yaml found' : 'react-native/expo dependency found'),
    );
  }
}
