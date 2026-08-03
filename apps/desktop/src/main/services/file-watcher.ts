import chokidar, { type FSWatcher } from 'chokidar';
import type { BrowserWindow } from 'electron';
import { IPC_EVENTS } from '@peep/shared';

const IGNORED = /(^|[\\/])(\.git|node_modules|\.dart_tool|build|\.peep)([\\/]|$)/;

export class FileWatcherService {
  private watcher: FSWatcher | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private onChangeCallback: ((event: 'add' | 'change' | 'unlink', path: string) => void) | null = null;

  watch(
    projectPath: string,
    mainWindow: BrowserWindow | null,
    onChange: (event: 'add' | 'change' | 'unlink', path: string) => void,
  ): void {
    this.stop();
    this.onChangeCallback = onChange;

    this.watcher = chokidar.watch(projectPath, {
      ignored: IGNORED,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 400, pollInterval: 100 },
    });

    const handleEvent = (event: 'add' | 'change' | 'unlink', path: string) => {
      this.onChangeCallback?.(event, path);
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        mainWindow?.webContents.send(IPC_EVENTS.PREVIEW_LOG, '[watch] Project files changed');
      }, 500);
    };

    this.watcher.on('change', (path) => handleEvent('change', path));
    this.watcher.on('add', (path) => handleEvent('add', path));
    this.watcher.on('unlink', (path) => handleEvent('unlink', path));
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
