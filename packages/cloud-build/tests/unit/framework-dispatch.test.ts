// packages/cloud-build/tests/unit/framework-dispatch.test.ts
// Unit tests for getBuildCommands(), getArtifactPaths(), validateFramework().
// Pure logic tests — no Docker, no database, no network.

import assert from 'node:assert/strict';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  getBuildCommands,
  getArtifactPaths,
  validateFramework,
  detectFramework,
} from '../../src/framework-dispatch.js';

export default async function run() {

  // ── getBuildCommands ────────────────────────────────────────────────────────

  {
    const cmds = getBuildCommands('flutter', 'apk', '1.2.3', 5);
    assert.equal(cmds.length, 2, 'Flutter APK: pub get + build apk');
    assert.deepEqual(cmds[0], ['flutter', 'pub', 'get']);
    assert.ok(cmds[1].includes('apk'), 'Second command is apk build');
    assert.ok(cmds[1].includes('--release'), 'Release mode');
    assert.ok(cmds[1].includes('1.2.3'), 'Version name included');
    assert.ok(cmds[1].includes('5'), 'Version code included');
    // Must NOT contain appbundle
    const flat = cmds.flat().join(' ');
    assert.ok(!flat.includes('appbundle'), 'APK-only: no appbundle command');
    console.log('  ✓ Flutter APK commands correct');
  }

  {
    const cmds = getBuildCommands('flutter', 'aab', '1.0.0', 1);
    assert.equal(cmds.length, 2, 'Flutter AAB: pub get + build appbundle');
    assert.deepEqual(cmds[0], ['flutter', 'pub', 'get']);
    assert.ok(cmds[1].includes('appbundle'), 'Second command is appbundle');
    const flat = cmds.flat().join(' ');
    assert.ok(!flat.includes('build apk'), 'AAB-only: no APK command');
    console.log('  ✓ Flutter AAB commands correct');
  }

  {
    const cmds = getBuildCommands('flutter', 'both', '2.0.0', 10);
    assert.equal(cmds.length, 3, 'Flutter both: pub get + apk + appbundle');
    assert.deepEqual(cmds[0], ['flutter', 'pub', 'get']);
    const flat = cmds.flat().join(' ');
    assert.ok(flat.includes('apk'), 'Both: APK command present');
    assert.ok(flat.includes('appbundle'), 'Both: AAB command present');
    console.log('  ✓ Flutter both commands correct');
  }

  {
    const cmds = getBuildCommands('react-native', 'apk', '1.0.0', 1);
    assert.equal(cmds.length, 2, 'RN APK: npm install + gradlew');

    // First command must be npm install
    assert.deepEqual(cmds[0], ['npm', 'install', '--legacy-peer-deps']);

    // Second command must use sh -c with ./gradlew assembleRelease
    const gradleCmd = cmds[1].join(' ');
    assert.ok(gradleCmd.includes('gradlew assembleRelease'), 'Uses gradlew assembleRelease');
    assert.ok(!gradleCmd.includes('expo build'), 'NOT expo build:android');
    assert.ok(!gradleCmd.includes('react-native build'), 'NOT react-native build-android');
    assert.ok(gradleCmd.includes('versionName=1.0.0'), 'Version name passed to Gradle');
    assert.ok(gradleCmd.includes('versionCode=1'), 'Version code passed to Gradle');
    console.log('  ✓ React Native APK commands correct (gradlew, NOT expo)');
  }

  {
    // Explicitly verify expo build:android is absent in all RN commands
    for (const target of ['apk', 'aab', 'both'] as const) {
      const cmds = getBuildCommands('react-native', target, '1.0.0', 1);
      const flat = cmds.flat().join(' ');
      assert.ok(!flat.includes('expo build'), `RN ${target}: no expo build:android`);
      assert.ok(!flat.includes('react-native build'), `RN ${target}: no react-native build-android`);
    }
    console.log('  ✓ expo build:android absent from all RN commands');
  }

  {
    // Unknown framework must throw
    assert.throws(
      () => getBuildCommands('unknown' as never, 'apk', '1.0.0', 1),
      /Unknown framework/,
    );
    console.log('  ✓ Unknown framework throws');
  }

  // ── getArtifactPaths ────────────────────────────────────────────────────────

  {
    const paths = getArtifactPaths('flutter', 'apk');
    assert.ok(paths.apk?.includes('flutter-apk/app-release.apk'), 'Flutter APK path');
    assert.equal(paths.aab, undefined, 'Flutter APK: no AAB path');
    console.log('  ✓ Flutter APK artifact path correct');
  }

  {
    const paths = getArtifactPaths('flutter', 'aab');
    assert.ok(paths.aab?.includes('bundle/release/app-release.aab'), 'Flutter AAB path');
    assert.equal(paths.apk, undefined, 'Flutter AAB: no APK path');
    console.log('  ✓ Flutter AAB artifact path correct');
  }

  {
    const paths = getArtifactPaths('react-native', 'apk');
    assert.ok(paths.apk?.includes('app/build/outputs/apk/release/app-release.apk'), 'RN APK path');
    assert.equal(paths.aab, undefined);
    console.log('  ✓ RN APK artifact path correct');
  }

  {
    const paths = getArtifactPaths('react-native', 'both');
    assert.ok(paths.apk, 'RN both: has APK path');
    assert.ok(paths.aab, 'RN both: has AAB path');
    console.log('  ✓ RN both artifact paths correct');
  }

  // ── detectFramework + validateFramework ────────────────────────────────────

  const testDir = join(tmpdir(), `cloud-build-test-${Date.now()}`);
  await mkdir(testDir, { recursive: true });

  try {
    // Flutter project: has pubspec.yaml
    const flutterDir = join(testDir, 'flutter-project');
    await mkdir(flutterDir, { recursive: true });
    await writeFile(join(flutterDir, 'pubspec.yaml'), 'name: my_app\n');
    assert.equal(await detectFramework(flutterDir), 'flutter', 'pubspec.yaml → flutter');
    await validateFramework(flutterDir, 'flutter');  // Must not throw
    console.log('  ✓ Flutter detection correct');

    // React Native project: has package.json with react-native dep
    const rnDir = join(testDir, 'rn-project');
    await mkdir(rnDir, { recursive: true });
    await writeFile(join(rnDir, 'package.json'), JSON.stringify({
      name: 'my-rn-app',
      dependencies: { 'react-native': '0.72.6' },
    }));
    assert.equal(await detectFramework(rnDir), 'react-native', 'react-native dep → react-native');
    await validateFramework(rnDir, 'react-native');  // Must not throw
    console.log('  ✓ React Native detection correct');

    // Expo project: has package.json with expo dep
    const expoDir = join(testDir, 'expo-project');
    await mkdir(expoDir, { recursive: true });
    await writeFile(join(expoDir, 'package.json'), JSON.stringify({
      name: 'my-expo-app',
      dependencies: { expo: '49.0.0' },
    }));
    assert.equal(await detectFramework(expoDir), 'react-native', 'expo dep → react-native');
    console.log('  ✓ Expo detection maps to react-native');

    // Unknown project: no recognizable files
    const unknownDir = join(testDir, 'unknown-project');
    await mkdir(unknownDir, { recursive: true });
    assert.equal(await detectFramework(unknownDir), null, 'Unknown project → null');
    console.log('  ✓ Unknown project returns null');

    // Mismatch: declared flutter but has react-native package.json
    await assert.rejects(
      () => validateFramework(rnDir, 'flutter'),
      /Framework mismatch/,
    );
    console.log('  ✓ Framework mismatch throws correctly');

    // Mismatch: declared react-native but has pubspec.yaml
    await assert.rejects(
      () => validateFramework(flutterDir, 'react-native'),
      /Framework mismatch/,
    );
    console.log('  ✓ Reverse framework mismatch throws correctly');

  } finally {
    await rm(testDir, { recursive: true, force: true });
  }

  console.log('\n  All framework-dispatch tests passed.');
}
