import { spawn, type ChildProcess } from 'node:child_process';
import { platform } from 'node:os';
import type { BrowserWindow } from 'electron';
import { IPC_EVENTS } from '@peep/shared';
import type { RunCommandResult } from '@peep/shared';

const ALLOWED_PREFIXES = [
  'flutter ',
  'dart ',
  'git status',
  'git diff',
  'git log',
  'git add',
  'git commit',
  'git branch',
  'pwd',
  'cd ',
  'dir',
  'ls',
  'echo ',
];

interface TerminalSession {
  process: ChildProcess;
  cwd: string;
}

export class TerminalService {
  private sessions = new Map<string, TerminalSession>();
  private mainWindow: BrowserWindow | null = null;

  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
  }

  private getShell(): { command: string; args: string[] } {
    if (platform() === 'win32') {
      return { command: 'cmd.exe', args: [] };
    }
    return { command: process.env.SHELL ?? '/bin/bash', args: ['-i'] };
  }

  create(id: string, cwd: string): void {
    this.destroy(id);

    const shell = this.getShell();
    const child = spawn(shell.command, shell.args, {
      cwd,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
    });

    this.sessions.set(id, { process: child, cwd });

    const emit = (data: string) => {
      this.mainWindow?.webContents.send(IPC_EVENTS.TERMINAL_OUTPUT, { id, data });
    };

    child.stdout?.on('data', (chunk: Buffer) => emit(chunk.toString()));
    child.stderr?.on('data', (chunk: Buffer) => emit(chunk.toString()));

    child.on('exit', (code) => {
      this.sessions.delete(id);
      this.mainWindow?.webContents.send(IPC_EVENTS.TERMINAL_EXIT, { id, code: code ?? 0 });
    });

    child.on('error', (error) => {
      emit(`\r\n[terminal error] ${error.message}\r\n`);
    });

    emit(`\r\nPeep terminal — ${cwd}\r\n`);
  }

  write(id: string, data: string): void {
    const session = this.sessions.get(id);
    if (!session?.process.stdin?.writable) return;
    session.process.stdin.write(data);
  }

  destroy(id: string): void {
    const session = this.sessions.get(id);
    if (!session) return;
    session.process.kill();
    this.sessions.delete(id);
  }

  destroyAll(): void {
    for (const id of [...this.sessions.keys()]) {
      this.destroy(id);
    }
  }

  isCommandAllowed(command: string): boolean {
    const trimmed = command.trim().toLowerCase();
    if (!trimmed) return false;

    return ALLOWED_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
  }

  async runCommand(command: string, cwd: string): Promise<RunCommandResult> {
    if (!this.isCommandAllowed(command)) {
      throw new Error(`Command not allowed: ${command}`);
    }

    return new Promise((resolve, reject) => {
      const shell = platform() === 'win32';
      const child = spawn(command, [], { cwd, shell, env: { ...process.env } });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on('error', reject);

      child.on('close', (code) => {
        resolve({ stdout, stderr, exitCode: code ?? 1 });
      });
    });
  }
}
