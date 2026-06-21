import type { FlutterService } from './flutter-service';
import type { ReactNativeService } from './react-native-service';

export type PlatformTarget = 'flutter' | 'react-native' | 'unknown';

export interface PlatformDetectionResult {
  platform: PlatformTarget;
  confidence: 'definite' | 'likely';
}

/**
 * Detects which mobile platform a project folder belongs to and
 * routes preview / analyze calls to the correct service.
 */
export class PlatformRegistry {
  constructor(
    private flutter: FlutterService,
    private reactNative: ReactNativeService,
  ) {}

  async detect(root: string): Promise<PlatformDetectionResult> {
    // pubspec.yaml → definite Flutter
    const isFlutter = await this.flutter.isFlutterProject(root);
    if (isFlutter) {
      return { platform: 'flutter', confidence: 'definite' };
    }

    // package.json with react-native / expo → React Native
    const isRN = await this.reactNative.isReactNativeProject(root);
    if (isRN) {
      return { platform: 'react-native', confidence: 'definite' };
    }

    return { platform: 'unknown', confidence: 'likely' };
  }

  async analyze(platform: PlatformTarget, root: string) {
    if (platform === 'flutter') {
      return this.flutter.analyze(root);
    }
    if (platform === 'react-native') {
      return this.reactNative.analyze(root);
    }
    return [];
  }

  async install(platform: PlatformTarget, root: string): Promise<void> {
    if (platform === 'flutter') {
      await this.flutter.pubGet(root);
    } else if (platform === 'react-native') {
      await this.reactNative.install(root);
    }
  }

  async startPreview(
    platform: PlatformTarget,
    root: string,
    port?: number,
  ): Promise<{ url: string; processId: number; logs: string[] }> {
    if (platform === 'flutter') {
      return this.flutter.startWebPreview(root, port);
    }
    if (platform === 'react-native') {
      return this.reactNative.startWebPreview(root, port);
    }
    throw new Error(`Cannot start preview for unknown platform`);
  }

  stopPreview(platform: PlatformTarget, processId: number): void {
    if (platform === 'flutter') {
      this.flutter.stopPreview(processId);
    } else if (platform === 'react-native') {
      this.reactNative.stopPreview(processId);
    }
  }

  reloadPreview(platform: PlatformTarget, processId: number): void {
    if (platform === 'flutter') {
      this.flutter.reloadPreview(processId);
    } else if (platform === 'react-native') {
      this.reactNative.reloadPreview(processId);
    }
  }
}
