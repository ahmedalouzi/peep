import { BrowserWindow } from 'electron';
import { IPC_EVENTS } from '@peep/shared';
import type { PreviewSession } from '@peep/shared';
import type { FlutterService } from './flutter-service';
import type { ReactNativeService } from './react-native-service';
import { createServer } from 'node:net';

function getFreePort(): Promise<number> {
  const startPort = 10000 + Math.floor(Math.random() * 10000);
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(startPort, '127.0.0.1', () => {
      const port = (server.address() as any).port;
      server.close(() => resolve(port));
    });
    server.on('error', () => {
      resolve(getFreePort());
    });
  });
}

export class PreviewManager {
  private session: PreviewSession | null = null;
  setMainWindow(_window: BrowserWindow | null): void {
    // no-op
  }

  getSession(): PreviewSession | null {
    return this.session;
  }

  setSession(session: PreviewSession): void {
    this.emit(session);
  }

  private emit(session: PreviewSession): void {
    this.session = session;
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC_EVENTS.PREVIEW_STATUS, session);
      }
    }
  }

  async start(projectRoot: string, flutter: FlutterService): Promise<PreviewSession> {
    this.stop(flutter);

    this.emit({ url: '', processId: 0, status: 'starting' });

    try {
      await flutter.pubGet(projectRoot);
      const port = await getFreePort();
      const { url, processId, logs } = await flutter.startWebPreview(projectRoot, port);

      for (const line of logs) {
        for (const win of BrowserWindow.getAllWindows()) {
          if (!win.isDestroyed()) {
            win.webContents.send(IPC_EVENTS.PREVIEW_LOG, line);
          }
        }
      }

      const session: PreviewSession = { url, processId, status: 'running' };
      this.emit(session);
      return session;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const session: PreviewSession = {
        url: '',
        processId: 0,
        status: 'error',
        error: message,
      };
      this.emit(session);
      throw error;
    }
  }

  stop(flutter: FlutterService): void {
    if (this.session?.processId) {
      flutter.stopPreview(this.session.processId);
    }
    this.emit({ url: '', processId: 0, status: 'stopped' });
  }

  reload(flutter: FlutterService): void {
    if (this.session?.processId) {
      flutter.reloadPreview(this.session.processId);
    }
  }

  async startRn(projectRoot: string, rnService: ReactNativeService): Promise<PreviewSession> {
    this.stopRn(rnService);

    this.emit({ url: '', processId: 0, status: 'starting' });

    try {
      // 1. Run npm/pnpm install
      await rnService.install(projectRoot);

      // 2. Resolve a free port
      const port = await getFreePort();

      // 3. Start Expo Web preview
      const { url, processId, logs } = await rnService.startWebPreview(projectRoot, port);

      for (const line of logs) {
        for (const win of BrowserWindow.getAllWindows()) {
          if (!win.isDestroyed()) {
            win.webContents.send(IPC_EVENTS.PREVIEW_LOG, line);
          }
        }
      }

      const session: PreviewSession = { url, processId, status: 'running' };
      this.emit(session);
      return session;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const session: PreviewSession = {
        url: '',
        processId: 0,
        status: 'error',
        error: message,
      };
      this.emit(session);
      throw error;
    }
  }

  stopRn(rnService: ReactNativeService): void {
    if (this.session?.processId) {
      rnService.stopPreview(this.session.processId);
    }
    this.emit({ url: '', processId: 0, status: 'stopped' });
  }
}
