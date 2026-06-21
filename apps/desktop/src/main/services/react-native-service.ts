import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Diagnostic } from '@peep/shared';
import type { ProcessManager } from './process-manager';

export interface RnSdkInfo {
  nodeVersion: string;
  hasExpo: boolean;
  hasReactNative: boolean;
  rnVersion?: string;
  expoVersion?: string;
}

const PREVIEW_PORT = 5175;
const PREVIEW_STARTUP_MS = 150_000;

export class ReactNativeService {
  constructor(
    private processManager: ProcessManager,
    private nodePath?: string,
  ) {}

  setNodePath(path: string | undefined): void {
    this.nodePath = path;
  }

  private getNpxBin(): string {
    return process.platform === 'win32' ? 'npx.cmd' : 'npx';
  }

  private getNpmBin(): string {
    return process.platform === 'win32' ? 'npm.cmd' : 'npm';
  }

  // ── Project detection ────────────────────────────────────────────────────

  async isReactNativeProject(root: string): Promise<boolean> {
    try {
      const raw = await readFile(join(root, 'package.json'), 'utf-8');
      const pkg = JSON.parse(raw) as Record<string, unknown>;
      const deps = {
        ...((pkg.dependencies as Record<string, unknown>) ?? {}),
        ...((pkg.devDependencies as Record<string, unknown>) ?? {}),
      };
      return 'react-native' in deps || 'expo' in deps;
    } catch {
      return false;
    }
  }

  async detectSdk(): Promise<RnSdkInfo | null> {
    try {
      const nodeOut = await this.run(['node', '--version'], process.cwd()).catch(() => '');
      const nodeVersion = nodeOut.trim();

      // Read project package.json to check RN/Expo versions
      return {
        nodeVersion,
        hasExpo: false,
        hasReactNative: false,
      };
    } catch {
      return null;
    }
  }

  async getProjectInfo(root: string): Promise<RnSdkInfo> {
    try {
      const raw = await readFile(join(root, 'package.json'), 'utf-8');
      const pkg = JSON.parse(raw) as Record<string, unknown>;
      const deps = {
        ...((pkg.dependencies as Record<string, unknown>) ?? {}),
        ...((pkg.devDependencies as Record<string, unknown>) ?? {}),
      };

      const nodeOut = await this.run(['node', '--version'], root).catch(() => 'unknown');

      return {
        nodeVersion: nodeOut.trim(),
        hasExpo: 'expo' in deps,
        hasReactNative: 'react-native' in deps,
        rnVersion: deps['react-native'] as string | undefined,
        expoVersion: deps['expo'] as string | undefined,
      };
    } catch {
      return { nodeVersion: 'unknown', hasExpo: false, hasReactNative: false };
    }
  }

  // ── Package management ───────────────────────────────────────────────────

  async install(projectRoot: string): Promise<void> {
    await this.run([this.getNpmBin(), 'install'], projectRoot);
  }

  // ── Diagnostics ──────────────────────────────────────────────────────────

  async analyze(projectRoot: string): Promise<Diagnostic[]> {
    const diagnostics: Diagnostic[] = [];

    // TypeScript check
    try {
      await access(join(projectRoot, 'tsconfig.json'));
      const tsOut = await this.run(
        [this.getNpxBin(), 'tsc', '--noEmit', '--pretty', 'false'],
        projectRoot,
      ).catch((e: Error) => e.message);

      diagnostics.push(...parseTscOutput(tsOut, projectRoot));
    } catch {
      // No tsconfig — skip TS check
    }

    // ESLint check
    try {
      const eslintOut = await this.run(
        [this.getNpxBin(), 'eslint', '.', '--ext', '.ts,.tsx,.js,.jsx', '-f', 'compact'],
        projectRoot,
      ).catch((e: Error) => e.message);

      diagnostics.push(...parseEslintOutput(eslintOut, projectRoot));
    } catch {
      // ESLint not configured — skip
    }

    return diagnostics;
  }

  // ── Preview (Expo Web) ───────────────────────────────────────────────────

  async startWebPreview(
    projectRoot: string,
    port = PREVIEW_PORT,
  ): Promise<{ url: string; processId: number; logs: string[] }> {
    const projectInfo = await this.getProjectInfo(projectRoot);

    if (!projectInfo.hasExpo) {
      throw new Error(
        'Expo is not installed in this project. Run: npx install-expo-modules, or add Expo to use web preview.',
      );
    }

    const info = this.processManager.spawn(
      this.getNpxBin(),
      ['expo', 'start', '--web', '--port', String(port)],
      projectRoot,
    );

    const url = `http://localhost:${port}`;
    const logs: string[] = [];

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error(
            `Expo Web startup timed out after ${PREVIEW_STARTUP_MS / 1000}s. Is Expo installed?`,
          ),
        );
      }, PREVIEW_STARTUP_MS);

      const handleOutput = (chunk: Buffer) => {
        const text = chunk.toString();
        for (const line of text.split(/\r?\n/)) {
          if (line.trim()) logs.push(line);
        }

        if (
          text.includes('Webpack compiled') ||
          text.includes('Starting Metro') ||
          text.includes(`localhost:${port}`) ||
          text.includes('Web is waiting')
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
          reject(new Error(logs.join('\n') || `expo exited with code ${code}`));
        }
      });
    });
  }

  stopPreview(processId: number): void {
    this.processManager.kill(processId);
  }

  reloadPreview(processId: number): void {
    // Metro hot reload — send 'r' to stdin
    this.processManager.writeStdin(processId, 'r\n');
  }

  // ── Internal helpers ─────────────────────────────────────────────────────

  private run(cmd: string[], cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const [bin, ...args] = cmd;
      const info = this.processManager.spawn(bin!, args, cwd);
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
        if (code === 0) resolve(output);
        else reject(new Error(output || `Command exited with code ${code}`));
      });
    });
  }
}

// ── Diagnostics parsers ───────────────────────────────────────────────────

function parseTscOutput(output: string, root: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  // Format: src/App.tsx(10,5): error TS2345: Argument of type ...
  const regex = /^(.+?)\((\d+),(\d+)\):\s+(error|warning|info)\s+TS\d+:\s+(.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(output)) !== null) {
    diagnostics.push({
      file: join(root, m[1]!.replace(/\\/g, '/')),
      line: parseInt(m[2]!, 10),
      column: parseInt(m[3]!, 10),
      severity: m[4] as 'error' | 'warning' | 'info',
      message: m[5]!.trim(),
    });
  }
  return diagnostics;
}

function parseEslintOutput(output: string, root: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  // ESLint compact format: /path/to/file.tsx: line 10, col 5, Error - message (rule)
  const regex = /^(.+?):\s+line\s+(\d+),\s+col\s+(\d+),\s+(Error|Warning|Info)\s+-\s+(.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(output)) !== null) {
    diagnostics.push({
      file: m[1]!.trim(),
      line: parseInt(m[2]!, 10),
      column: parseInt(m[3]!, 10),
      severity: m[4]!.toLowerCase() as 'error' | 'warning' | 'info',
      message: m[5]!.replace(/\s+\([^)]+\)$/, '').trim(),
    });
  }
  return diagnostics;
}
