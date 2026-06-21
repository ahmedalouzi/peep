import { spawn, type ChildProcess } from 'node:child_process';
import { platform } from 'node:os';

export interface ProcessInfo {
  id: number;
  command: string;
  process: ChildProcess;
}

export class ProcessManager {
  private processes = new Map<number, ProcessInfo>();
  private nextId = 1;

  spawn(command: string, args: string[], cwd: string): ProcessInfo {
    const shell = platform() === 'win32';
    const child = spawn(command, args, {
      cwd,
      shell,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    const info: ProcessInfo = {
      id: this.nextId++,
      command: [command, ...args].join(' '),
      process: child,
    };

    this.processes.set(info.id, info);

    child.on('exit', () => {
      this.processes.delete(info.id);
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

    info.process.kill();
    this.processes.delete(id);
    return true;
  }

  get(id: number): ProcessInfo | undefined {
    return this.processes.get(id);
  }

  killAll(): void {
    for (const info of this.processes.values()) {
      info.process.kill();
    }
    this.processes.clear();
  }
}
