import { access } from 'node:fs/promises';
import { join } from 'node:path';
import type { Diagnostic } from '@peep/shared';
import { parseFlutterAnalyze } from '@peep/flutter-adapter';
import type { ProcessManager } from './process-manager';

export interface SdkInfo {
  path: string;
  version: string;
}

const PREVIEW_PORT = 5174;
const PREVIEW_STARTUP_MS = 120_000;

export class FlutterService {
  constructor(
    private processManager: ProcessManager,
    private sdkPath?: string,
  ) {}

  setSdkPath(path: string | undefined): void {
    this.sdkPath = path;
  }

  private getFlutterBin(): string {
    if (this.sdkPath) {
      return join(this.sdkPath, 'bin', process.platform === 'win32' ? 'flutter.bat' : 'flutter');
    }
    return process.platform === 'win32' ? 'flutter.bat' : 'flutter';
  }

  async detectSdk(): Promise<SdkInfo | null> {
    try {
      const version = await this.runCommand(['--version'], process.cwd());
      const match = version.match(/Flutter\s+([\d.]+)/);
      return {
        path: this.sdkPath ?? 'PATH',
        version: match?.[1] ?? 'unknown',
      };
    } catch {
      return null;
    }
  }

  async createProject(name: string, parentPath: string): Promise<void> {
    await this.runCommand(['create', name, '--project-name', name], parentPath);
  }

  async pubGet(projectRoot: string): Promise<void> {
    await this.runCommand(['pub', 'get'], projectRoot);
  }

  async analyze(projectRoot: string): Promise<Diagnostic[]> {
    try {
      const output = await this.runCommand(['analyze'], projectRoot);
      return parseFlutterAnalyze(output);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return parseFlutterAnalyze(message);
    }
  }

  async startWebPreview(
    projectRoot: string,
    port = PREVIEW_PORT,
  ): Promise<{ url: string; processId: number; logs: string[] }> {
    const info = this.processManager.spawn(
      this.getFlutterBin(),
      ['run', '-d', 'web-server', '--web-port', String(port), '--web-hostname', '127.0.0.1'],
      projectRoot,
    );

    const url = `http://127.0.0.1:${port}`;
    const logs: string[] = [];

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Preview startup timed out after ${PREVIEW_STARTUP_MS / 1000}s. Is Flutter SDK installed?`));
      }, PREVIEW_STARTUP_MS);

      const handleOutput = (chunk: Buffer) => {
        const text = chunk.toString();
        for (const line of text.split(/\r?\n/)) {
          if (line.trim()) logs.push(line);
        }

        if (
          text.includes(url) ||
          text.includes('is being served at') ||
          text.includes('Serving at')
        ) {
          clearTimeout(timeout);
          resolve({ url, processId: info.id, logs });
        }
      };

      info.process.stdout?.on('data', handleOutput);
      info.process.stderr?.on('data', handleOutput);

      info.process.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      info.process.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          clearTimeout(timeout);
          reject(new Error(logs.join('\n') || `flutter run exited with code ${code}`));
        }
      });
    });
  }

  stopPreview(processId: number): void {
    this.processManager.kill(processId);
  }

  reloadPreview(processId: number): void {
    this.processManager.writeStdin(processId, 'r\n');
  }

  private runCommand(args: string[], cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const info = this.processManager.spawn(this.getFlutterBin(), args, cwd);
      let stdout = '';
      let stderr = '';

      info.process.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      info.process.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      info.process.on('error', reject);

      info.process.on('close', (code) => {
        const output = stdout + stderr;
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(output || `flutter exited with code ${code}`));
        }
      });
    });
  }

  async isFlutterProject(root: string): Promise<boolean> {
    try {
      await access(join(root, 'pubspec.yaml'));
      return true;
    } catch {
      return false;
    }
  }
}
