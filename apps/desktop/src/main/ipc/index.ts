import { ipcMain, dialog, app, type BrowserWindow } from 'electron';
import { IPC_CHANNELS, IPC_EVENTS } from '@peep/shared';
import type { Settings } from '@peep/shared';
import { DatabaseService } from '../services/db';
import { WorkspaceManager } from '../services/workspace-manager';
import { ProcessManager } from '../services/process-manager';
import { FlutterService } from '../services/flutter-service';
import { PreviewManager } from '../services/preview-manager';
import { FileWatcherService } from '../services/file-watcher';
import { searchFiles } from '../services/file-search';
import { AgentService } from '../services/agent-service';
import { GitService } from '../services/git-service';
import { TerminalService } from '../services/terminal-service';
import { ProjectService } from '../services/project-service';
import { TelemetryService } from '../services/telemetry-service';
import { AutoUpdateService } from '../services/auto-update-service';
import { ReactNativeService } from '../services/react-native-service';
import { PlatformRegistry } from '../services/platform-registry';
import { buildAuditReport, capturePerformanceSnapshot } from '../services/audit-service';

let db: DatabaseService | null = null;
let mainWindow: BrowserWindow | null = null;
let agentService: AgentService | null = null;

const previewManager = new PreviewManager();
const fileWatcher = new FileWatcherService();
const gitService = new GitService();
const terminalService = new TerminalService();
const telemetryService = new TelemetryService();
let autoUpdateService: AutoUpdateService | null = null;
let rnService: ReactNativeService | null = null;
let platformRegistry: PlatformRegistry | null = null;

export function setMainWindow(window: BrowserWindow | null): void {
  mainWindow = window;
  previewManager.setMainWindow(window);
  agentService?.setMainWindow(window);
  terminalService.setMainWindow(window);
  autoUpdateService?.setMainWindow(window);
}

function notifyGitChanged(): void {
  mainWindow?.webContents.send(IPC_EVENTS.GIT_CHANGED);
}

async function runAnalyze(projectPath: string, flutter: FlutterService): Promise<void> {
  const diagnostics = await flutter.analyze(projectPath);
  mainWindow?.webContents.send(IPC_EVENTS.DIAGNOSTICS_UPDATED, diagnostics);
}

async function openProjectAtPath(
  projectPath: string,
  workspace: WorkspaceManager,
  flutter: FlutterService,
): Promise<Awaited<ReturnType<WorkspaceManager['openFolder']>>> {
  const project = await workspace.openFolder(projectPath);
  await onProjectOpened(project.path, flutter);
  notifyGitChanged();
  return project;
}

async function onProjectOpened(projectPath: string, flutter: FlutterService): Promise<void> {
  fileWatcher.watch(projectPath, mainWindow, () => {
    void runAnalyze(projectPath, flutter);
    previewManager.reload(flutter);
  });

  void runAnalyze(projectPath, flutter);

  try {
    await previewManager.start(projectPath, flutter);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    mainWindow?.webContents.send(IPC_EVENTS.PREVIEW_LOG, `[preview] ${message}`);
  }
}

export async function registerIpcHandlers(): Promise<{
  db: DatabaseService;
  workspace: WorkspaceManager;
  flutter: FlutterService;
  processManager: ProcessManager;
  previewManager: PreviewManager;
  agentService: AgentService;
  gitService: GitService;
  terminalService: TerminalService;
  telemetryService: TelemetryService;
  autoUpdateService: AutoUpdateService;
}> {
  db = new DatabaseService();
  await db.init();

  await telemetryService.init();
  autoUpdateService = new AutoUpdateService(telemetryService);
  autoUpdateService.init();

  const workspace = new WorkspaceManager(db);
  const processManager = new ProcessManager();
  const settings = db.getSettingsRaw();
  const flutter = new FlutterService(processManager, settings.flutterSdkPath);
  rnService = new ReactNativeService(processManager);
  platformRegistry = new PlatformRegistry(flutter, rnService);
  agentService = new AgentService(db, workspace, flutter);
  agentService.setMainWindow(mainWindow);
  const projectService = new ProjectService(flutter, workspace);

  ipcMain.handle(IPC_CHANNELS.DIALOG_SELECT_FOLDER, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select parent folder',
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle(IPC_CHANNELS.DIALOG_OPEN_FOLDER, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Open Flutter Project',
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const project = await openProjectAtPath(result.filePaths[0], workspace, flutter);
    return project;
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_OPEN_FOLDER, async (_event, folderPath: string) => {
    return openProjectAtPath(folderPath, workspace, flutter);
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_GET_RECENT, () => {
    return workspace.getRecentProjects();
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_GET_PROJECT, () => {
    return workspace.getProject();
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_LIST_DIR, async (_event, dirPath: string) => {
    return workspace.listDir(dirPath);
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_READ_FILE, async (_event, filePath: string) => {
    return workspace.readFile(filePath);
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_WRITE_FILE, async (_event, filePath: string, content: string) => {
    await workspace.writeFile(filePath, content);
    const project = workspace.getProject();
    if (project) {
      void runAnalyze(project.path, flutter);
      previewManager.reload(flutter);
      notifyGitChanged();
    }
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_SEARCH_FILES, async (_event, rootPath: string, query: string) => {
    return searchFiles(rootPath, query);
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, () => {
    return db!.getSettings();
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, async (_event, partial: Partial<Settings>) => {
    await db!.setSettings(partial);
    if ('flutterSdkPath' in partial) {
      flutter.setSdkPath(partial.flutterSdkPath);
    }
    return db!.getSettings();
  });

  ipcMain.handle(IPC_CHANNELS.APP_GET_VERSION, () => {
    return app.getVersion();
  });

  ipcMain.handle(IPC_CHANNELS.FLUTTER_DETECT_SDK, () => {
    return flutter.detectSdk();
  });

  ipcMain.handle(IPC_CHANNELS.FLUTTER_ANALYZE, async (_event, projectPath: string) => {
    const diagnostics = await flutter.analyze(projectPath);
    mainWindow?.webContents.send(IPC_EVENTS.DIAGNOSTICS_UPDATED, diagnostics);
    return diagnostics;
  });

  ipcMain.handle(IPC_CHANNELS.FLUTTER_PUB_GET, async (_event, projectPath: string) => {
    await flutter.pubGet(projectPath);
  });

  ipcMain.handle(IPC_CHANNELS.PREVIEW_START, async (_event, projectPath: string) => {
    return previewManager.start(projectPath, flutter);
  });

  ipcMain.handle(IPC_CHANNELS.PREVIEW_STOP, () => {
    previewManager.stop(flutter);
  });

  ipcMain.handle(IPC_CHANNELS.PREVIEW_RELOAD, () => {
    previewManager.reload(flutter);
  });

  ipcMain.handle(IPC_CHANNELS.AGENT_SEND, async (_event, options) => {
    await agentService!.send(options);
  });

  ipcMain.handle(IPC_CHANNELS.AGENT_CANCEL, () => {
    agentService!.cancel();
  });

  ipcMain.handle(IPC_CHANNELS.AGENT_APPLY_EDITS, async (_event, editIds: string[]) => {
    await agentService!.applyEdits(editIds);
    const project = workspace.getProject();
    if (project) {
      previewManager.reload(flutter);
    }
  });

  ipcMain.handle(IPC_CHANNELS.AGENT_REJECT_EDITS, (_event, editIds?: string[]) => {
    agentService!.rejectEdits(editIds);
  });

  ipcMain.handle(IPC_CHANNELS.AGENT_GET_PENDING_EDITS, () => {
    return agentService!.getPendingEdits();
  });

  ipcMain.handle(IPC_CHANNELS.GIT_STATUS, async (_event, projectPath: string) => {
    return gitService.status(projectPath);
  });

  ipcMain.handle(IPC_CHANNELS.GIT_INIT, async (_event, projectPath: string) => {
    await gitService.init(projectPath);
    notifyGitChanged();
  });

  ipcMain.handle(IPC_CHANNELS.GIT_STAGE, async (_event, projectPath: string, files: string[]) => {
    await gitService.stage(projectPath, files);
    notifyGitChanged();
  });

  ipcMain.handle(IPC_CHANNELS.GIT_UNSTAGE, async (_event, projectPath: string, files: string[]) => {
    await gitService.unstage(projectPath, files);
    notifyGitChanged();
  });

  ipcMain.handle(IPC_CHANNELS.GIT_COMMIT, async (_event, projectPath: string, message: string) => {
    await gitService.commit(projectPath, message);
    notifyGitChanged();
  });

  ipcMain.handle(IPC_CHANNELS.GIT_DIFF, async (_event, projectPath: string, filePath: string) => {
    return gitService.diff(projectPath, filePath);
  });

  ipcMain.handle(IPC_CHANNELS.TERMINAL_CREATE, async (_event, options: { id: string; cwd: string }) => {
    terminalService.create(options.id, options.cwd);
  });

  ipcMain.handle(IPC_CHANNELS.TERMINAL_WRITE, async (_event, id: string, data: string) => {
    terminalService.write(id, data);
  });

  ipcMain.handle(IPC_CHANNELS.TERMINAL_DESTROY, async (_event, id: string) => {
    terminalService.destroy(id);
  });

  ipcMain.handle(IPC_CHANNELS.RUN_COMMAND, async (_event, options: { command: string; cwd: string }) => {
    return terminalService.runCommand(options.command, options.cwd);
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_LIST_TEMPLATES, () => {
    return projectService.listTemplates();
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_CREATE, async (_event, options) => {
    const projectPath = await projectService.createFromTemplate(options);
    return openProjectAtPath(projectPath, workspace, flutter);
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_CREATE_FROM_PROMPT, async (_event, options) => {
    const projectPath = await projectService.createFromTemplate({
      name: options.name,
      parentPath: options.parentPath,
      templateId: 'blank',
    });

    mainWindow?.webContents.send(IPC_EVENTS.AGENT_STREAM, {
      type: 'status',
      content: 'Scaffolding project with AI…',
    });

    await agentService!.scaffold(projectPath, options.prompt);
    return openProjectAtPath(projectPath, workspace, flutter);
  });

  // ── Telemetry ──────────────────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.TELEMETRY_GET, () => {
    return telemetryService.isEnabled();
  });

  ipcMain.handle(IPC_CHANNELS.TELEMETRY_SET, async (_event, enabled: boolean) => {
    await telemetryService.setEnabled(enabled);
    await db!.setSettings({ telemetryEnabled: enabled });
  });

  // ── Auto-update ────────────────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.UPDATE_CHECK, async () => {
    await autoUpdateService!.checkForUpdates();
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_INSTALL, async () => {
    await autoUpdateService!.downloadAndInstall();
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_GET_STATUS, () => {
    return autoUpdateService!.getStatus();
  });

  // ── Onboarding ─────────────────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.ONBOARDING_COMPLETE, async () => {
    await db!.setSettings({ onboardingCompleted: true });
    void telemetryService.track('onboarding_completed');
  });

  // ── React Native ───────────────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.PLATFORM_DETECT, async (_event, projectPath: string) => {
    return platformRegistry!.detect(projectPath);
  });

  ipcMain.handle(IPC_CHANNELS.RN_DETECT_PROJECT, async (_event, projectPath: string) => {
    return rnService!.isReactNativeProject(projectPath);
  });

  ipcMain.handle(IPC_CHANNELS.RN_GET_PROJECT_INFO, async (_event, projectPath: string) => {
    return rnService!.getProjectInfo(projectPath);
  });

  ipcMain.handle(IPC_CHANNELS.RN_INSTALL, async (_event, projectPath: string) => {
    await rnService!.install(projectPath);
  });

  ipcMain.handle(IPC_CHANNELS.RN_ANALYZE, async (_event, projectPath: string) => {
    const diagnostics = await rnService!.analyze(projectPath);
    mainWindow?.webContents.send(IPC_EVENTS.DIAGNOSTICS_UPDATED, diagnostics);
    return diagnostics;
  });

  ipcMain.handle(IPC_CHANNELS.RN_START_PREVIEW, async (_event, projectPath: string) => {
    const result = await rnService!.startWebPreview(projectPath);
    return { url: result.url, processId: result.processId, status: 'running' };
  });

  ipcMain.handle(IPC_CHANNELS.RN_STOP_PREVIEW, async (_event, processId: number) => {
    rnService!.stopPreview(processId);
  });

  ipcMain.handle(IPC_CHANNELS.RN_RELOAD_PREVIEW, async (_event, processId: number) => {
    rnService!.reloadPreview(processId);
  });

  // ── Audit / Performance ────────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.AUDIT_PERFORMANCE, async () => {
    return capturePerformanceSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.AUDIT_PROJECT, async (_event, projectPath?: string) => {
    const root = projectPath ?? workspace.getProject()?.path;
    return buildAuditReport(root);
  });

  return { db, workspace, flutter, processManager, previewManager, agentService, gitService, terminalService, telemetryService, autoUpdateService: autoUpdateService! };
}

export function cleanupServices(flutter: FlutterService): void {
  fileWatcher.stop();
  previewManager.stop(flutter);
  agentService?.cancel();
  terminalService.destroyAll();
}
