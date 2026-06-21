import chokidar, { type FSWatcher } from 'chokidar';
import type { BrowserWindow } from 'electron';
import { IPC_EVENTS } from '@peep/shared';

const IGNORED = /(^|[\\/])(\.git|node_modules|\.dart_tool|build|\.peep)([\\/]|$)/;

export class FileWatcherService {
  private watcher: FSWatcher | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private onChangeCallback: (() => void) | null = null;

  watch(
    projectPath: string,
    mainWindow: BrowserWindow | null,
    onChange: () => void,
  ): void {
    this.stop();
    this.onChangeCallback = onChange;

    this.watcher = chokidar.watch(projectPath, {
      ignored: IGNORED,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 400, pollInterval: 100 },
    });

    const schedule = () => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        this.onChangeCallback?.();
        mainWindow?.webContents.send(IPC_EVENTS.PREVIEW_LOG, '[watch] Project files changed');
      }, 500);
    };

    this.watcher.on('change', schedule);
    this.watcher.on('add', schedule);
    this.watcher.on('unlink', schedule);
  }

  stop(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    void this.watcher?.close();
    this.watcher = null;
    this.onChangeCallback = null;
  }
}
