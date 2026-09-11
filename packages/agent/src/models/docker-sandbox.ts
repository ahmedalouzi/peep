import { spawn } from 'node:child_process';
import { promisify } from 'node:util';

export type BuildFramework = 'flutter' | 'react-native';

export interface SandboxConfig {
  jobId: string;
  projectPath: string;
  timeoutMs?: number; // Default: 15 minutes
  framework?: BuildFramework; // Default: 'flutter'
  keystorePath?: string; // Optional: path to .jks keystore on host
  keystorePassword?: string;
  keyAlias?: string;
  keyPassword?: string;
}

// Docker images per framework
const FRAMEWORK_IMAGES: Record<BuildFramework, string> = {
  'flutter': 'ghcr.io/cirruslabs/flutter@sha256:d82e88a313627bfd8d6411f18ed82f3a4666f772591605335e69e061b4028405',
  'react-native': 'reactnativecommunity/react-native-android:latest',
};

// Build commands per framework
function getBuildCommand(framework: BuildFramework, hasKeystore: boolean): string {
  if (framework === 'flutter') {
    return 'flutter build apk --release';
  }

  // React Native
  if (hasKeystore) {
    return 'cd android && ./gradlew assembleRelease';
  }
  return 'npx react-native build-android --mode=release';
}

// Expected output artifact path inside the container
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
    const netName = 'build_sandbox_net';
    try {
      const { exec } = await import('node:child_process');
      const execAsync = promisify(exec);
      await execAsync(`docker network create --driver bridge ${netName}`).catch(() => {});
    } catch (e) {}
    return netName;
  }

  /**
   * Executes the build inside an isolated Docker container with strict limits.
   */
  async runBuild(onLog: (chunk: string) => void): Promise<boolean> {
    const timeoutMs = this.config.timeoutMs || 15 * 60 * 1000;
    const framework = this.config.framework || 'flutter';
    const image = FRAMEWORK_IMAGES[framework];
    const hasKeystore = !!this.config.keystorePath;
    const buildCommand = getBuildCommand(framework, hasKeystore);

    const netName = await this.setupNetwork();

    // Build the create args
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
      '--dns', '172.30.0.1',
      '--user=1000:1000',
      '-w', '/workspace',
      image,
    ];

    // Build the actual shell command to run inside the container
    let shellScript = buildCommand;

    // If keystore is provided, set up signing config before building
    if (hasKeystore && this.config.keystorePassword && this.config.keyAlias) {
      const keyPassword = this.config.keyPassword || this.config.keystorePassword;
      if (framework === 'flutter') {
        // Flutter reads key.properties for signing
        shellScript = [
          `echo "storeFile=/signing/release.jks" > /workspace/android/key.properties`,
          `echo "storePassword=${this.config.keystorePassword}" >> /workspace/android/key.properties`,
          `echo "keyAlias=${this.config.keyAlias}" >> /workspace/android/key.properties`,
          `echo "keyPassword=${keyPassword}" >> /workspace/android/key.properties`,
          buildCommand,
        ].join(' && ');
      } else {
        // React Native uses gradle.properties
        shellScript = [
          `echo "MYAPP_UPLOAD_STORE_FILE=/signing/release.jks" >> /workspace/android/gradle.properties`,
          `echo "MYAPP_UPLOAD_STORE_PASSWORD=${this.config.keystorePassword}" >> /workspace/android/gradle.properties`,
          `echo "MYAPP_UPLOAD_KEY_ALIAS=${this.config.keyAlias}" >> /workspace/android/gradle.properties`,
          `echo "MYAPP_UPLOAD_KEY_PASSWORD=${keyPassword}" >> /workspace/android/gradle.properties`,
          buildCommand,
        ].join(' && ');
      }
    }

    createArgs.push('sh', '-c', shellScript);

    onLog(`[SYSTEM] Creating ${framework} sandbox with security constraints...\n`);

    const { exec } = await import('node:child_process');
    const execAsync = promisify(exec);

    try {
      await execAsync(`docker ${createArgs.join(' ')}`);
    } catch (err: any) {
      onLog(`[SYSTEM] Container creation failed: ${err.message}\n`);
      return false;
    }

    // Inject source code
    onLog(`[SYSTEM] Injecting source files...\n`);
    try {
      await execAsync(`docker cp ${this.config.projectPath}/. ${this.containerName}:/workspace`);
    } catch (err: any) {
      onLog(`[SYSTEM] Source injection failed: ${err.message}\n`);
      return false;
    }

    // Inject keystore file if provided
    if (hasKeystore) {
      onLog(`[SYSTEM] Injecting signing keystore...\n`);
      try {
        await execAsync(`docker exec ${this.containerName} mkdir -p /signing`);
        await execAsync(`docker cp ${this.config.keystorePath} ${this.containerName}:/signing/release.jks`);
      } catch (err: any) {
        onLog(`[SYSTEM] Keystore injection failed: ${err.message}\n`);
        return false;
      }
    }

    // Start container and stream logs
    onLog(`[SYSTEM] Starting ${framework} build process...\n`);
    return new Promise((resolve) => {
      let isResolved = false;
      this.childProcess = spawn('docker', ['start', '-a', this.containerName]);

      const timeoutTimer = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          onLog('[SYSTEM] Build timed out after 15 minutes. Terminating container...');
          this.forceKill();
          resolve(false);
        }
      }, timeoutMs);

      this.childProcess.stdout?.on('data', (data) => {
        onLog(data.toString());
      });

      this.childProcess.stderr?.on('data', (data) => {
        onLog(`[ERROR] ${data.toString()}`);
      });

      this.childProcess.on('close', (code) => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeoutTimer);
          if (code === 0) {
            resolve(true);
          } else {
            onLog(`[SYSTEM] Container exited with code ${code}`);
            resolve(false);
          }
        }
      });
    });
  }

  /**
   * Extracts the built artifact from the container to a local path.
   */
  async extractArtifact(localDestPath: string): Promise<boolean> {
    const framework = this.config.framework || 'flutter';
    const artifactPath = getArtifactPath(framework);

    const { exec } = await import('node:child_process');
    const execAsync = promisify(exec);

    try {
      await execAsync(`docker cp ${this.containerName}:${artifactPath} ${localDestPath}`);
      return true;
    } catch (err: any) {
      console.error(`[DOCKER] Artifact extraction failed: ${err.message}`);
      return false;
    }
  }

  /**
   * Forcefully kills the container.
   */
  forceKill() {
    try {
      spawn('docker', ['rm', '-f', this.containerName]);
    } catch (e) {
      console.error(`[DOCKER] Failed to kill container ${this.containerName}`, e);
    }
  }
}
