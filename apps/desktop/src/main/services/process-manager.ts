import { spawn, exec, type ChildProcess } from 'node:child_process';
import { platform } from 'node:os';
import { join } from 'node:path';

export interface ProcessInfo {
  id: number;
  command: string;
  process: ChildProcess;
  status: 'starting' | 'running' | 'degraded' | 'error' | 'crashed' | 'stopped' | 'exited' | 'unknown';
  stdout: string;
  stderr: string;
  exitCode: number | null;
  startedAt: string;
}

export class ProcessManager {
  private processes = new Map<number, ProcessInfo>();
  private nextId = 1;
  private flutterSdkPath?: string;

  setFlutterSdkPath(path: string | undefined): void {
    this.flutterSdkPath = path;
  }

  spawn(command: string, args: string[], cwd: string, envOverrides?: Record<string, string>, spawnOpts?: { shell?: boolean }): ProcessInfo {
    const shell = spawnOpts?.shell !== undefined ? spawnOpts.shell : platform() === 'win32';
    const customEnv = { ...process.env, ...envOverrides };
    if (this.flutterSdkPath) {
      const binPath = join(this.flutterSdkPath, 'bin');
      const pathKeyActual = Object.keys(customEnv).find(k => k.toLowerCase() === 'path') || 'PATH';
      const existingPath = customEnv[pathKeyActual] || '';
      customEnv[pathKeyActual] = platform() === 'win32'
        ? `${binPath};${existingPath}`
        : `${binPath}:${existingPath}`;
    }

    const child = spawn(command, args, {
      cwd,
      shell,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: customEnv,
    });

    const info: ProcessInfo = {
      id: this.nextId++,
      command: [command, ...args].join(' '),
      process: child,
      status: 'running',
      stdout: '',
      stderr: '',
      exitCode: null,
      startedAt: new Date().toISOString()
    };

    child.stdout?.on('data', (chunk) => {
      info.stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      info.stderr += chunk.toString();
    });

    this.processes.set(info.id, info);

    child.on('exit', (code) => {
      info.exitCode = code;
      info.status = code === 0 ? 'exited' : (code === null ? 'stopped' : 'crashed');
    });

    return info;
  }

  writeStdin(id: number, data: string): boolean {
    const info = this.processes.get(id);
    if (!info?.process.stdin?.writable) return false;
    info.process.stdin.write(data);
    return true;
  }

  kill(id: number): boolean {
    const info = this.processes.get(id);
    if (!info) return false;

    const pid = info.process.pid;
    if (pid && platform() === 'win32') {
      exec(`taskkill /pid ${pid} /f /t`, (err) => {
        if (err) {
          console.error(`Failed to kill process tree for PID ${pid}:`, err);
          info.process.kill();
        }
      });
    } else {
      info.process.kill();
    }

    info.status = 'stopped';
    return true;
  }

  get(id: number): ProcessInfo | undefined {
    return this.processes.get(id);
  }

  killAll(): void {
    for (const info of this.processes.values()) {
      const pid = info.process.pid;
      if (pid && platform() === 'win32') {
        exec(`taskkill /pid ${pid} /f /t`);
      } else {
        info.process.kill();
      }
    }
    this.processes.clear();
  }
}
