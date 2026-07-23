import { execFile } from 'node:child_process';
import { access, constants } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { DependencyCheckResult, DependencyInfo } from '@peep/shared';

const execFileAsync = promisify(execFile);

const INSTALL_URLS = {
  flutter:    'https://docs.flutter.dev/get-started/install',
  androidSdk: 'https://developer.android.com/studio',
  java:       'https://adoptium.net/',
  adb:        'https://developer.android.com/studio/command-line/adb',
};

async function runCmd(cmd: string, args: string[]): Promise<string> {
  const { stdout, stderr } = await execFileAsync(cmd, args, { timeout: 10_000 });
  return (stdout + stderr).trim();
}

async function detectFlutter(sdkPath?: string): Promise<DependencyInfo> {
  const bin = sdkPath
    ? join(sdkPath, 'bin', process.platform === 'win32' ? 'flutter.bat' : 'flutter')
    : process.platform === 'win32' ? 'flutter.bat' : 'flutter';

  try {
    const out = await runCmd(bin, ['--version', '--machine']);
    const parsed = JSON.parse(out) as { frameworkVersion?: string; dartSdkVersion?: string };
    return {
      name: 'Flutter SDK',
      status: 'found',
      version: parsed.frameworkVersion ?? 'unknown',
      path: bin,
      installUrl: INSTALL_URLS.flutter,
    };
  } catch {
    // fallback: try plain --version
    try {
      const out = await runCmd(bin, ['--version']);
      const match = out.match(/Flutter\s+([\d.]+)/);
      return {
        name: 'Flutter SDK',
        status: 'found',
        version: match?.[1] ?? 'unknown',
        path: bin,
        installUrl: INSTALL_URLS.flutter,
      };
    } catch (err) {
      return {
        name: 'Flutter SDK',
        status: 'missing',
        installUrl: INSTALL_URLS.flutter,
        errorMessage: 'Flutter not found in PATH. Please install Flutter SDK.',
      };
    }
  }
}

async function detectAndroidSdk(): Promise<DependencyInfo> {
  const androidHome =
    process.env.ANDROID_HOME ??
    process.env.ANDROID_SDK_ROOT ??
    (process.platform === 'win32'
      ? join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk')
      : join(process.env.HOME ?? '', 'Android', 'Sdk'));

  try {
    await access(join(androidHome, 'platforms'), constants.F_OK);
    // Grab build-tools version as proxy for "installed"
    const toolsBin = join(androidHome, 'build-tools');
    let version = 'installed';
    try {
      const { readdir } = await import('node:fs/promises');
      const dirs = await readdir(toolsBin);
      version = dirs[dirs.length - 1] ?? 'installed';
    } catch { /* ignore */ }

    return {
      name: 'Android SDK',
      status: 'found',
      version,
      path: androidHome,
      installUrl: INSTALL_URLS.androidSdk,
    };
  } catch {
    return {
      name: 'Android SDK',
      status: 'missing',
      installUrl: INSTALL_URLS.androidSdk,
      errorMessage: `Android SDK not found at ${androidHome}. Please install Android Studio.`,
    };
  }
}

async function detectJava(): Promise<DependencyInfo> {
  try {
    const out = await runCmd('java', ['-version']);
    // "java version" or "openjdk version" line
    const match = out.match(/(?:java|openjdk)\s+version\s+"([\d._]+)"/i)
      ?? out.match(/([\d]+\.\d+\.\d+)/);
    return {
      name: 'Java (JDK)',
      status: 'found',
      version: match?.[1] ?? 'unknown',
      installUrl: INSTALL_URLS.java,
    };
  } catch {
    return {
      name: 'Java (JDK)',
      status: 'missing',
      installUrl: INSTALL_URLS.java,
      errorMessage: 'Java not found. Flutter Android builds require Java 11 or 17.',
    };
  }
}

async function detectAdb(): Promise<DependencyInfo> {
  const androidHome =
    process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? '';
  const adbBin = androidHome
    ? join(androidHome, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb')
    : process.platform === 'win32' ? 'adb.exe' : 'adb';

  try {
    const out = await runCmd(adbBin, ['version']);
    const match = out.match(/Android Debug Bridge version ([\d.]+)/);
    return {
      name: 'ADB',
      status: 'found',
      version: match?.[1] ?? 'unknown',
      path: adbBin,
      installUrl: INSTALL_URLS.adb,
    };
  } catch {
    return {
      name: 'ADB',
      status: 'missing',
      installUrl: INSTALL_URLS.adb,
      errorMessage: 'ADB not found. It is included with Android SDK Platform Tools.',
    };
  }
}

export async function detectDependencies(flutterSdkPath?: string): Promise<DependencyCheckResult> {
  const [flutter, androidSdk, java, adb] = await Promise.all([
    detectFlutter(flutterSdkPath),
    detectAndroidSdk(),
    detectJava(),
    detectAdb(),
  ]);

  const allReady =
    flutter.status === 'found' &&
    androidSdk.status === 'found' &&
    java.status === 'found';

  return { flutter, androidSdk, java, adb, allReady };
}
