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
  buffer: string;
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
    console.log(`[TerminalService] Creating terminal session for id: ${id}, cwd: ${cwd}`);
    this.destroy(id);

    const shell = this.getShell();
    console.log(`[TerminalService] Spawning shell command: ${shell.command} with args:`, shell.args);
    const child = spawn(shell.command, shell.args, {
      cwd,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
    });

    const session: TerminalSession = { process: child, cwd, buffer: '' };
    this.sessions.set(id, session);

    const emit = (data: string) => {
      this.mainWindow?.webContents.send(IPC_EVENTS.TERMINAL_OUTPUT, { id, data });
    };

    child.stdout?.on('data', (chunk: Buffer) => {
      const output = chunk.toString();
      console.log(`[TerminalService] stdout: ${JSON.stringify(output)}`);
      emit(output);
    });
    
    child.stderr?.on('data', (chunk: Buffer) => {
      const output = chunk.toString();
      console.log(`[TerminalService] stderr: ${JSON.stringify(output)}`);
      emit(output);
    });

    child.on('exit', (code) => {
      console.log(`[TerminalService] Process exited with code: ${code}`);
      const current = this.sessions.get(id);
      if (current && current.process === child) {
        this.sessions.delete(id);
      }
      this.mainWindow?.webContents.send(IPC_EVENTS.TERMINAL_EXIT, { id, code: code ?? 0 });
    });

    child.on('error', (error) => {
      console.error(`[TerminalService] Spawn error:`, error);
      emit(`\r\n[terminal error] ${error.message}\r\n`);
    });

    emit(`\r\nPeep terminal — ${cwd}\r\n`);

    // Trigger initial command prompt by writing a newline to stdin
    if (child.stdin?.writable) {
      console.log('[TerminalService] Writing initial newline to trigger prompt');
      child.stdin.write('\r\n');
    } else {
      console.warn('[TerminalService] child.stdin is not writable on spawn!');
    }
  }

  write(id: string, data: string): void {
    console.log(`[TerminalService] write called for id: ${id}, data: ${JSON.stringify(data)}`);
    const session = this.sessions.get(id);
    if (!session) {
      console.warn(`[TerminalService] No session found for id: ${id}`);
      return;
    }

    const emit = (str: string) => {
      this.mainWindow?.webContents.send(IPC_EVENTS.TERMINAL_OUTPUT, { id, data: str });
    };

    let i = 0;
    while (i < data.length) {
      const char = data[i];

      // Skip ANSI escape sequences (e.g. arrow keys starting with \x1b[)
      if (char === '\x1b') {
        i++;
        if (data[i] === '[') {
          i++;
          while (i < data.length) {
            const code = data.charCodeAt(i);
            if (code >= 0x40 && code <= 0x7E) {
              i++;
              break;
            }
            i++;
          }
        }
        continue;
      }

      if (char === '\r' || char === '\n') {
        const command = session.buffer;
        console.log(`[TerminalService] Submitting command: ${JSON.stringify(command)}`);
        session.buffer = '';
        if (session.process.stdin?.writable) {
          session.process.stdin.write(command + '\r\n');
        } else {
          console.warn('[TerminalService] session.process.stdin is not writable!');
        }
        emit('\r\n');
      } else if (char === '\x7f' || char === '\x08') {
        if (session.buffer.length > 0) {
          session.buffer = session.buffer.slice(0, -1);
          emit('\b \b');
        }
      } else if (char === '\x03') {
        console.log('[TerminalService] Ctrl+C received');
        session.buffer = '';
        if (session.process.stdin?.writable) {
          session.process.stdin.write('\x03');
        }
        emit('^C\r\n');
      } else {
        const code = char.charCodeAt(0);
        if (code >= 32 || char === '\t') {
          session.buffer += char;
          emit(char);
        }
      }
      i++;
    }
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
