import { join } from 'node:path';
import { access } from 'node:fs/promises';
import { BrowserWindow } from 'electron';
import type { ProcessManager } from './process-manager';

export interface PublishStatus {
  status: 'idle' | 'building' | 'deploying' | 'completed' | 'error';
  progress?: number;
  message: string;
  url?: string;
  logs: string[];
}

export class PublishService {
  private activeProcessId: number | null = null;
  private status: PublishStatus = { status: 'idle', message: 'Ready to publish', logs: [] };

  constructor(private processManager: ProcessManager) {}

  // Called by ipc/index.ts — no-op since we broadcast via BrowserWindow.getAllWindows()
  setMainWindow(_window: BrowserWindow | null): void {}

  // Called by ipc/index.ts before builds — apply optional settings
  setSettings(settings: { flutterSdkPath?: string }): void {
    if (settings.flutterSdkPath) {
      // store for future use if needed
    }
  }


  private getBin(name: string): string {
    return process.platform === 'win32' ? `${name}.cmd` : name;
  }

  private emit(partial: Partial<PublishStatus>): void {
    this.status = { ...this.status, ...partial };
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('publish:status', this.status);
      }
    }
  }

  private emitLog(line: string): void {
    this.status.logs.push(line);
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('publish:log', line);
      }
    }
  }

  getStatus(): PublishStatus {
    return this.status;
  }

  cancel(): void {
    if (this.activeProcessId !== null) {
      this.processManager.kill(this.activeProcessId);
      this.activeProcessId = null;
      this.emit({ status: 'idle', message: 'Publishing cancelled.' });
    }
  }

  async buildAndDeploy(
    projectPath: string,
    platform: 'flutter' | 'react-native',
    target: 'vercel' | 'netlify',
    token?: string
  ): Promise<void> {
    this.cancel();
    this.status = { status: 'building', message: 'Building production bundle...', logs: [] };
    this.emit({});

    let buildCmd = '';
    let buildArgs: string[] = [];
    let buildDir = '';

    if (platform === 'flutter') {
      buildCmd = 'flutter';
      buildArgs = ['build', 'web', '--release'];
      buildDir = join(projectPath, 'build', 'web');
    } else {
      buildCmd = this.getBin('npx');
      buildArgs = ['expo', 'export', '--platform', 'web'];
      buildDir = join(projectPath, 'dist');
    }

    try {
      this.emitLog(`> Starting production build for ${platform}...`);
      await this.runCommand(buildCmd, buildArgs, projectPath);
      this.emitLog(`✓ Production build finished successfully.`);
    } catch (err: any) {
      this.emit({ status: 'error', message: `Build failed: ${err.message}` });
      return;
    }

    // Verify build directory exists
    try {
      await access(buildDir);
    } catch {
      this.emit({
        status: 'error',
        message: `Build folder not found at ${buildDir}. Make sure the build completed successfully.`,
      });
      return;
    }

    this.emit({ status: 'deploying', message: `Deploying build to ${target}...` });
    this.emitLog(`> Starting deploy to ${target} from ${buildDir}...`);

    let deployCmd = this.getBin('npx');
    let deployArgs: string[] = [];

    if (target === 'vercel') {
      // Zero-config vercel deploy
      deployArgs = ['vercel', 'deploy', buildDir, '--prod', '--yes'];
      if (token) {
        deployArgs.push('--token', token);
      }
    } else {
      // Netlify deploy
      deployArgs = ['netlify', 'deploy', '--dir', buildDir, '--prod'];
      if (token) {
        deployArgs.push('--auth', token);
      }
    }

    try {
      const output = await this.runCommand(deployCmd, deployArgs, projectPath);
      
      // Parse output for production URL
      let url = '';
      if (target === 'vercel') {
        const matches = output.match(/https:\/\/[a-zA-Z0-9-]+\.vercel\.app/g);
        if (matches && matches.length > 0) {
          url = matches[matches.length - 1];
        }
      } else {
        const matches = output.match(/https:\/\/[a-zA-Z0-9-]+\.netlify\.app/g);
        if (matches && matches.length > 0) {
          url = matches[matches.length - 1];
        }
        if (!url) {
          const siteUrlMatches = output.match(/Website URL:\s*(https:\/\/[^\s]+)/i);
          if (siteUrlMatches && siteUrlMatches[1]) {
            url = siteUrlMatches[1];
          }
        }
      }

      // If regex failed, try a fallback URL search
      if (!url) {
        const fallbackMatch = output.match(/https:\/\/[^\s]+/g);
        if (fallbackMatch) {
          url = fallbackMatch.find(u => u.includes(target)) || '';
        }
      }

      this.emit({
        status: 'completed',
        message: `Application successfully published to ${target}!`,
        url: url || `https://${target}.com`,
      });
      this.emitLog(`✓ Deployment completed! URL: ${url}`);
    } catch (err: any) {
      this.emit({ status: 'error', message: `Deployment failed: ${err.message}` });
    }
  }

  async easBuild(projectPath: string): Promise<void> {
    this.cancel();
    this.status = { status: 'building', message: 'Starting Expo EAS Cloud Build...', logs: [] };
    this.emit({});

    this.emitLog('> Triggering Expo EAS cloud build...');
    const cmd = this.getBin('npx');
    const args = ['eas-cli', 'build', '--platform', 'all', '--non-interactive'];

    try {
      const output = await this.runCommand(cmd, args, projectPath);
      
      // Check output for build details or download URLs
      let url = '';
      const matches = output.match(/https:\/\/expo\.dev\/artifacts\/[^\s]+/g);
      if (matches && matches.length > 0) {
        url = matches[0];
      }

      this.emit({
        status: 'completed',
        message: 'Expo EAS Native Build triggered successfully! Check your Expo Dashboard.',
        url: url || 'https://expo.dev/dashboard',
      });
      this.emitLog('✓ Expo EAS build trigger completed.');
    } catch (err: any) {
      this.emit({ status: 'error', message: `EAS Build failed: ${err.message}` });
    }
  }

  private runCommand(cmd: string, args: string[], cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const info = this.processManager.spawn(cmd, args, cwd);
      this.activeProcessId = info.id;
      
      let stdout = '';
      let stderr = '';

      info.process.stdout?.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        stdout += text;
        for (const line of text.split(/\r?\n/)) {
          if (line.trim()) this.emitLog(line);
        }
      });

      info.process.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        stderr += text;
        for (const line of text.split(/\r?\n/)) {
          if (line.trim()) this.emitLog(line);
        }
      });

      info.process.on('error', (err) => {
        this.activeProcessId = null;
        reject(err);
      });

      info.process.on('close', (code) => {
        this.activeProcessId = null;
        if (code === 0) {
          resolve(stdout + stderr);
        } else {
          reject(new Error(`Command exited with code ${code}`));
        }
      });
    });
  }
}
