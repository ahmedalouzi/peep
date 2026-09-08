import { spawn } from 'node:child_process';
import { promisify } from 'node:util';
export interface SandboxConfig {
  jobId: string;
  projectPath: string; // Path to the extracted project on the host
  timeoutMs?: number; // Default: 15 minutes
}

export class DockerSandbox {
  private containerName: string;
  private childProcess: ReturnType<typeof spawn> | null = null;
  private config: SandboxConfig;

  constructor(config: SandboxConfig) {
    this.config = config;
    this.containerName = `build_sandbox_${config.jobId}`;
  }

  // Set up dnsmasq isolation network
  private async setupNetwork(): Promise<string> {
    const netName = 'build_sandbox_net';
    try {
      const { exec } = await import('node:child_process');
      const execAsync = promisify(exec);
      // Attempt to create network (ignore error if exists)
      await execAsync(`docker network create --driver bridge ${netName}`).catch(() => {});
    } catch (e) {}
    return netName;
  }

  /**
   * Executes the build inside an isolated Docker container with strict limits.
   */
  async runBuild(onLog: (chunk: string) => void): Promise<boolean> {
    const timeoutMs = this.config.timeoutMs || 15 * 60 * 1000;
    const image = 'ghcr.io/cirruslabs/flutter@sha256:d82e88a313627bfd8d6411f18ed82f3a4666f772591605335e69e061b4028405';
    
    // Ensure network exists
    const netName = await this.setupNetwork();

    // 1. Create the container (do not start yet)
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
      '--dns', '172.30.0.1',  // Assume dnsmasq is on gateway
      '--user=1000:1000',
      '-w', '/workspace',
      image,
      'sh', '-c', 'flutter build apk --release'
    ];

    onLog(`[SYSTEM] Creating sandbox with security constraints...\n`);
    
    const { exec } = await import('node:child_process');
    const execAsync = promisify(exec);
    
    try {
      await execAsync(`docker ${createArgs.join(' ')}`);
    } catch (err: any) {
      onLog(`[SYSTEM] Container creation failed: ${err.message}\n`);
      return false;
    }

    // 2. Inject source code using docker cp (isolated from host kernel mounts)
    onLog(`[SYSTEM] Injecting source files...\n`);
    try {
      await execAsync(`docker cp ${this.config.projectPath}/. ${this.containerName}:/workspace`);
    } catch (err: any) {
      onLog(`[SYSTEM] Source injection failed: ${err.message}\n`);
      return false;
    }

    // 3. Start the container and stream logs
    onLog(`[SYSTEM] Starting build process...\n`);
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
   * Forcefully kills the container if it exceeds limits or is cancelled.
   */
  forceKill() {
    try {
      spawn('docker', ['rm', '-f', this.containerName]);
    } catch (e) {
      console.error(`[DOCKER] Failed to kill container ${this.containerName}`, e);
    }
  }
}
