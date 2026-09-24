import { spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { setupBuildNetwork, BUILD_NETWORK, RESOLVER_IP } from './network-setup.js';

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

// Docker images per framework — PINNED BY DIGEST for supply-chain safety.
// DO NOT replace these with mutable tags (:latest, :stable, etc.).
// To update: run `docker manifest inspect --verbose <image>:latest` and extract
// the linux/amd64 manifest digest, then update both the digest AND this comment.
//
// Flutter:      ghcr.io/cirruslabs/flutter@sha256:d82e... (unchanged)
// React Native: reactnativecommunity/react-native-android
//               linux/amd64 digest as of 2026-09-12 — resolves via docker manifest
const FRAMEWORK_IMAGES: Record<BuildFramework, string> = {
  'flutter': 'ghcr.io/cirruslabs/flutter@sha256:d82e88a313627bfd8d6411f18ed82f3a4666f772591605335e69e061b4028405',
  // linux/amd64 manifest digest — pinned 2026-09-12
  'react-native': 'reactnativecommunity/react-native-android@sha256:10ab6f44862b9fb9c1c64fb94566ce9f3c11f5a016f9061ef1a38f30a6bcc76f',
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
    // Full FQDN-based allowlist network setup:
    //   - Creates the 'build-restricted' Docker network bound to the build0 bridge
    //   - Creates the 'build-allowed-ips' ipset (1-hour IP expiry for CDN rotation)
    //   - Applies iptables rules: ACCEPT DNS→172.30.0.1:53, ACCEPT HTTPS→ipset,
    //     DROP all other DNS, DROP everything else
    // This must run before any container is created. It is idempotent.
    // Requires root on Linux; silently fails on non-Linux dev hosts (Docker Desktop).
    try {
      await setupBuildNetwork();
    } catch (e: any) {
      // On non-Linux or Docker Desktop hosts, iptables/ipset are unavailable.
      // Log a prominent warning — do NOT silently swallow on production Linux workers.
      console.warn('[SANDBOX] Network isolation setup failed (expected on non-Linux hosts):', e.message);
    }
    return BUILD_NETWORK;
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
      '--dns', RESOLVER_IP,  // Must match the dnsmasq listener in network-setup.ts
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

    // Fix ownership on the host BEFORE injecting, so docker cp preserves 1000:1000
    onLog(`[SYSTEM] Setting source ownership to unprivileged user...\n`);
    try {
      await execFileAsync('chown', ['-R', '1000:1000', this.config.projectPath]);
    } catch (err: any) {
      onLog(`[SYSTEM] Host source chown failed: ${err.message}\n`);
      return false;
    }

    // Inject source code
    onLog(`[SYSTEM] Injecting source files...\n`);
    try {
      await execFileAsync('docker', ['cp', `${this.config.projectPath}/.`, `${this.containerName}:/workspace`]);
    } catch (err: any) {
      onLog(`[SYSTEM] Source injection failed: ${err.message}\n`);
      return false;
    }

    // Inject keystore file if provided
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

    // Start container and stream logs
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

      this.childProcess.on('close', (code) => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeoutTimer);
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
   * Extracts the built artifact from the container to a local path.
   */
  async extractArtifact(localDestPath: string): Promise<boolean> {
    const framework = this.config.framework || 'flutter';
    const artifactPath = getArtifactPath(framework);

    const { execFile } = await import('node:child_process');
    const execFileAsync = promisify(execFile);

    try {
      // 1. SECURITY: Defend against symlink attacks
      try {
        await execFileAsync('docker', ['exec', this.containerName, 'test', '-L', artifactPath]);
        // If test -L returns 0, it IS a symlink. Reject immediately.
        console.error(`[SECURITY] Critical: Symlink detected at artifact path. Extraction rejected.`);
        return false;
      } catch (err: any) {
        // test -L exits with code 1 if the file is NOT a symlink. This is expected.
      }

      // 2. SECURITY: Extract via container namespace instead of host (bypasses docker cp vulnerabilities)
      const { createWriteStream } = await import('node:fs');
      return new Promise((resolve) => {
        const child = spawn('docker', ['exec', this.containerName, 'cat', artifactPath]);
        const destStream = createWriteStream(localDestPath);
        
        child.stdout.pipe(destStream);
        
        child.on('close', (code) => {
          if (code === 0) {
            resolve(true);
          } else {
            console.error(`[DOCKER] Artifact extraction (cat) failed with code ${code}`);
            resolve(false);
          }
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

  /**
   * Forcefully kills the container.
   */
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
