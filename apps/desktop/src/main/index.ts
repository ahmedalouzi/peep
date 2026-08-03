import { app, BrowserWindow, shell } from 'electron';
import { join } from 'node:path';
import { cleanupServices, registerIpcHandlers, setMainWindow } from './ipc';
import { config } from 'dotenv';
import * as Sentry from '@sentry/electron/main';

config(); // Load .env from root

Sentry.init({
  dsn: process.env.SENTRY_DSN || '',
  beforeSend(event) {
    // Redact sensitive data from crash reports (chain of thought, files, tokens)
    if (event.request && event.request.data) {
      delete event.request.data;
    }
    return event;
  }
});

// Suppress harmless Chromium GPU cache permission errors on Windows
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
  app.commandLine.appendSwitch('disable-gpu-program-cache');
}

let mainWindow: BrowserWindow | null = null;
let appServices: Awaited<ReturnType<typeof registerIpcHandlers>> | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    title: 'Peep',
    backgroundColor: '#0d1117',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  });

  setMainWindow(mainWindow);

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    setMainWindow(null);
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  app.on('certificate-error', (_e, _webContents, _url, _error, _certificate, callback) => {
    callback(true);
  });

  app.on('web-contents-created', (_e, contents) => {
    contents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      console.error(`[DID-FAIL-LOAD] Error Code: ${errorCode}, Description: ${errorDescription}, URL: ${validatedURL}`);
    });
    contents.on('console-message', (_e, _level, msg) => {
      if (msg.includes('error') || msg.includes('fail') || msg.includes('refused') || msg.includes('Content-Security-Policy')) {
        console.error(`[CONSOLE] ${msg}`);
      }
    });
  });

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

import { setupPoCIpc } from './ipc/poc';

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.peep.desktop');
    // Terminate any orphaned dart processes to release active sockets and lockfiles
    import('node:child_process').then(({ exec }) => {
      exec('taskkill /f /im dart.exe', () => {});
    });
  }

  void registerIpcHandlers().then((services) => {
    appServices = services;
    createWindow();
    setupPoCIpc(mainWindow);
  });


  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (appServices) {
    cleanupServices();
    appServices.processManager.killAll();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (appServices) {
    cleanupServices();
    appServices.processManager.killAll();
  }
});
