import { spawn } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

export interface SandboxConfig {
  jobId: string;
  projectPath: string; // Path to the extracted project on the host
  timeoutMs?: number; // Default: 15 minutes
}

export class DockerSandbox {
  private containerName: string;

  constructor(private config: SandboxConfig) {
    this.containerName = `build_sandbox_${this.config.jobId}`;
  }

  /**
   * Executes the build inside an isolated Docker container with strict limits.
   */
  async runBuild(onLog: (chunk: string) => void): Promise<boolean> {
    const timeoutMs = this.config.timeoutMs || 15 * 60 * 1000;

    // Use a lightweight base image with Flutter installed
    // In production, this would be an image like `ghcr.io/cirruslabs/flutter:latest`
    const image = 'ghcr.io/cirruslabs/flutter:latest';

    // Build the docker run arguments with strict resource limits
    const args = [
      'run',
      '--rm', // Auto-remove container when done
      '--name', this.containerName,
      '--memory=4g', // 4GB RAM limit
      '--cpus=2.0', // 2 CPUs limit
      '-v', `${this.config.projectPath}:/workspace`, // Mount source code
      '-w', '/workspace',
      image,
      'sh', '-c', 'flutter build apk --release'
    ];

    return new Promise((resolve) => {
      let isResolved = false;
      
      const child = spawn('docker', args);
      console.log(`[DOCKER] Spawning container: ${this.containerName}`);

      // Hard timeout safety net
      const timeoutTimer = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          onLog('[SYSTEM] Build timed out after 15 minutes. Terminating container...');
          this.forceKill();
          resolve(false);
        }
      }, timeoutMs);

      child.stdout.on('data', (data) => {
        onLog(data.toString());
      });

      child.stderr.on('data', (data) => {
        onLog(`[ERROR] ${data.toString()}`);
      });

      child.on('close', (code) => {
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
