import { spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { setupBuildNetwork, BUILD_NETWORK, RESOLVER_IP } from './network-setup.js';

export type BuildFramework = 'flutter' | 'react-native';

export interface SandboxConfig {
  jobId: string;
  projectPath: string;
  timeoutMs?: number;
  framework?: BuildFramework;
  keystorePath?: string;
  keystorePassword?: string;
  keyAlias?: string;
  keyPassword?: string;
}

const FRAMEWORK_IMAGES: Record<BuildFramework, string> = {
  'flutter': 'ghcr.io/cirruslabs/flutter@sha256:d82e88a313627bfd8d6411f18ed82f3a4666f772591605335e69e061b4028405',
  'react-native': 'reactnativecommunity/react-native-android@sha256:10ab6f44862b9fb9c1c64fb94566ce9f3c11f5a016f9061ef1a38f30a6bcc76f',
};

function getBuildCommand(framework: BuildFramework, hasKeystore: boolean): string {
  if (framework === 'flutter') {
    return 'flutter build apk --release';
  }
  if (hasKeystore) {
    return 'cd android && ./gradlew assembleRelease';
  }
  return 'npx react-native build-android --mode=release';
}

function getArtifactPath(framework: BuildFramework): string {
  if (framework === 'flutter') {
    return '/workspace/build/app/outputs/flutter-apk/app-release.apk';
  }
  return '/workspace/android/app/build/outputs/apk/release/app-release.apk';
}

export class DockerSandbox {
  private containerName: string;
  private childProcess: ReturnType<typeof spawn> | null = null;
  private config: SandboxConfig;

  constructor(config: SandboxConfig) {
    this.config = config;
    this.containerName = `build_sandbox_${config.jobId}`;
  }

  private async setupNetwork(): Promise<string> {
    try {
      await setupBuildNetwork();
    } catch (e: any) {
      console.warn('[SANDBOX] Network isolation setup failed (expected on non-Linux hosts):', e.message);
    }
    return BUILD_NETWORK;
  }

  async runBuild(onLog: (chunk: string) => void): Promise<boolean> {
    const timeoutMs = this.config.timeoutMs || 15 * 60 * 1000;
    const framework = this.config.framework || 'flutter';
    const image = FRAMEWORK_IMAGES[framework];
    const hasKeystore = !!this.config.keystorePath;
    const buildCommand = getBuildCommand(framework, hasKeystore);

    const netName = await this.setupNetwork();

    const createArgs = [
      'create',
      '--name', this.containerName,
      '--memory=4g',
      '--memory-swap=4g',
      '--cpus=2.0',
      '--pids-limit=200',
      '--storage-opt', 'size=5G',
      '--cap-drop=ALL',
      '--security-opt', 'no-new-privileges',
      '--network', netName,
      '--dns', RESOLVER_IP,
      '--user=1000:1000',
      '-w', '/workspace',
      image,
    ];

    let shellScript = buildCommand;

    if (hasKeystore && this.config.keystorePassword && this.config.keyAlias) {
      const keyPassword = this.config.keyPassword || this.config.keystorePassword;
      if (framework === 'flutter') {
        shellScript = [
          `mkdir -p /workspace/android`,
          `echo "storeFile=/workspace/release.jks" > /workspace/android/key.properties`,
          `echo "storePassword=${this.config.keystorePassword}" >> /workspace/android/key.properties`,
          `echo "keyAlias=${this.config.keyAlias}" >> /workspace/android/key.properties`,
          `echo "keyPassword=${keyPassword}" >> /workspace/android/key.properties`,
          buildCommand,
        ].join(' && ');
      } else {
        shellScript = [
          `mkdir -p /workspace/android`,
          `echo "MYAPP_UPLOAD_STORE_FILE=/workspace/release.jks" >> /workspace/android/gradle.properties`,
          `echo "MYAPP_UPLOAD_STORE_PASSWORD=${this.config.keystorePassword}" >> /workspace/android/gradle.properties`,
          `echo "MYAPP_UPLOAD_KEY_ALIAS=${this.config.keyAlias}" >> /workspace/android/gradle.properties`,
          `echo "MYAPP_UPLOAD_KEY_PASSWORD=${keyPassword}" >> /workspace/android/gradle.properties`,
          buildCommand,
        ].join(' && ');
      }
    }

    createArgs.push('sh', '-c', shellScript);

    onLog(`[SYSTEM] Creating ${framework} sandbox with security constraints...\n`);

    const { execFile } = await import('node:child_process');
    const execFileAsync = promisify(execFile);

    try {
      await execFileAsync('docker', createArgs);
    } catch (err: any) {
      onLog(`[SYSTEM] Container creation failed: ${err.message}\n`);
      return false;
    }

    onLog(`[SYSTEM] Setting source ownership to unprivileged user...\n`);
    try {
      await execFileAsync('chown', ['-R', '1000:1000', this.config.projectPath]);
    } catch (err: any) {
      onLog(`[SYSTEM] Host source chown failed: ${err.message}\n`);
      return false;
    }

    onLog(`[SYSTEM] Injecting source files...\n`);
    try {
      await execFileAsync('docker', ['cp', `${this.config.projectPath}/.`, `${this.containerName}:/workspace`]);
    } catch (err: any) {
      onLog(`[SYSTEM] Source injection failed: ${err.message}\n`);
      return false;
    }

    if (hasKeystore) {
      onLog(`[SYSTEM] Injecting signing keystore...\n`);
      try {
        await execFileAsync('chown', ['1000:1000', this.config.keystorePath!]);
        await execFileAsync('docker', ['cp', this.config.keystorePath!, `${this.containerName}:/workspace/release.jks`]);
      } catch (err: any) {
        onLog(`[SYSTEM] Keystore injection failed: ${err.message}\n`);
        return false;
      }
    }

    onLog(`[SYSTEM] Starting ${framework} build process...\n`);

    return new Promise((resolve) => {
      let isResolved = false;
      this.childProcess = spawn('docker', ['start', '-a', this.containerName]);

      const timeoutTimer = setTimeout(async () => {
        if (!isResolved) {
          isResolved = true;
          onLog(`[SYSTEM] Build timed out after ${Math.round(timeoutMs / 1000)}s. Terminating container...`);
          await this.forceKill();
          resolve(false);
        }
      }, timeoutMs);

      this.childProcess.stdout?.on('data', (data) => {
        onLog(data.toString());
      });

      this.childProcess.stderr?.on('data', (data) => {
        onLog(`[ERROR] ${data.toString()}`);
      });

      this.childProcess.on('close', async (code) => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeoutTimer);
          await this.forceKill();
          if (code === 0) {
            resolve(true);
          } else {
            onLog(`[SYSTEM] Build exited with code ${code}`);
            resolve(false);
          }
        }
      });
    });
  }

  /**
   * Extracts the built artifact using `docker exec cat` instead of `docker cp`.
   *
   * SECURITY: docker cp resolves symlinks found inside the container's tar
   * stream relative to the HOST filesystem (a known Docker behavior class,
   * see CVE-2019-14271). A malicious build could plant a symlink at the
   * expected artifact path pointing to /etc/shadow or similar, and docker cp
   * would happily exfiltrate the HOST's file — proven experimentally today.
   *
   * `docker exec <container> cat <path>` instead resolves the path strictly
   * inside the container's own mount namespace, making symlink escape to the
   * host impossible by construction.
   */
  async extractArtifact(localDestPath: string): Promise<boolean> {
    const framework = this.config.framework || 'flutter';
    const artifactPath = getArtifactPath(framework);
    const { execFile } = await import('node:child_process');
    const execFileAsync = promisify(execFile);

    // Defense-in-depth: reject outright if the artifact path is a symlink.
    // A legitimate build artifact should never be a symlink.
    try {
      await execFileAsync('docker', ['exec', this.containerName, 'test', '-L', artifactPath]);
      console.error(`[SECURITY] Critical: Symlink detected at artifact path. Extraction rejected.`);
      return false;
    } catch {
      // test -L exits non-zero if the path is NOT a symlink — expected/safe.
    }

    try {
      const { createWriteStream } = await import('node:fs');
      return new Promise((resolve) => {
        const child = spawn('docker', ['exec', this.containerName, 'cat', artifactPath]);
        const destStream = createWriteStream(localDestPath);
        child.stdout?.pipe(destStream);
        child.on('close', (code) => {
          resolve(code === 0);
        });
        child.on('error', (err) => {
          console.error(`[DOCKER] Artifact stream spawn error: ${err.message}`);
          resolve(false);
        });
      });
    } catch (err: any) {
      console.error(`[DOCKER] Artifact extraction failed: ${err.message}`);
      return false;
    }
  }

  async forceKill(): Promise<void> {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execFileAsync = promisify(execFile);
    try {
      await execFileAsync('docker', ['rm', '-f', this.containerName]);
    } catch (e: any) {
      console.error(`[DOCKER] Failed to kill container ${this.containerName}:`, e.message);
    }
  }
}
