import { BrowserWindow } from 'electron';
import { IPC_EVENTS } from '@peep/shared';
import type { PreviewSession } from '@peep/shared';
import type { FlutterService } from './flutter-service';

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
      const { url, processId, logs } = await flutter.startWebPreview(projectRoot);

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
}
