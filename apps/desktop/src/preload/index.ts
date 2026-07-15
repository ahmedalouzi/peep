import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, IPC_EVENTS } from '@peep/shared';
import type {
  AgentSendOptions,
  AgentStreamEvent,
  Diagnostic,
  GitDiffResult,
  GitStatusResult,
  IpcApi,
  PreviewSession,
  ProjectInfo,
  ProposedEdit,
  RunCommandResult,
  Settings,
  TerminalCreateOptions,
  UpdateInfo,
} from '@peep/shared';

function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const handler = (_event: unknown, payload: T) => callback(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

const api: IpcApi = {
  openFolder: () => ipcRenderer.invoke(IPC_CHANNELS.DIALOG_OPEN_FOLDER) as Promise<ProjectInfo | null>,
  openFile: () => ipcRenderer.invoke(IPC_CHANNELS.DIALOG_OPEN_FILE) as Promise<{ path: string; content: string } | null>,
  saveFileAs: (defaultPath, content) => ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SAVE_FILE, defaultPath, content) as Promise<string | null>,
  newWindow: () => ipcRenderer.invoke(IPC_CHANNELS.APP_NEW_WINDOW),
  exitApp: () => ipcRenderer.invoke(IPC_CHANNELS.APP_EXIT),
  minimizeWindow: () => ipcRenderer.invoke(IPC_CHANNELS.APP_MINIMIZE),
  maximizeWindow: () => ipcRenderer.invoke(IPC_CHANNELS.APP_MAXIMIZE),
  openProjectByPath: (path: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_OPEN_FOLDER, path) as Promise<ProjectInfo>,
  getRecentProjects: () => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_GET_RECENT),
  listDir: (dirPath: string) => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_LIST_DIR, dirPath),
  readFile: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_READ_FILE, filePath),
  readImage: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_READ_IMAGE, filePath) as Promise<string>,
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_WRITE_FILE, filePath, content),
  getProject: () => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_GET_PROJECT),
  searchFiles: (rootPath: string, query: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_SEARCH_FILES, rootPath, query),
  searchContent: (opts: { projectPath: string; query: string; caseSensitive?: boolean; isRegex?: boolean; maxResults?: number }) =>
    ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_SEARCH_CONTENT, opts),
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET) as Promise<Settings>,
  setSettings: (settings: Partial<Settings>) =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, settings) as Promise<Settings>,
  getVersion: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_VERSION) as Promise<string>,
  detectFlutterSdk: () => ipcRenderer.invoke(IPC_CHANNELS.FLUTTER_DETECT_SDK),
  analyzeProject: (projectPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.FLUTTER_ANALYZE, projectPath) as Promise<Diagnostic[]>,
  pubGet: (projectPath: string) => ipcRenderer.invoke(IPC_CHANNELS.FLUTTER_PUB_GET, projectPath),
  startPreview: (projectPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.PREVIEW_START, projectPath) as Promise<PreviewSession>,
  stopPreview: () => ipcRenderer.invoke(IPC_CHANNELS.PREVIEW_STOP),
  reloadPreview: () => ipcRenderer.invoke(IPC_CHANNELS.PREVIEW_RELOAD),
  getPreviewSession: () =>
    ipcRenderer.invoke(IPC_CHANNELS.PREVIEW_GET_SESSION) as Promise<PreviewSession | null>,
  detachPreview: (deviceId?: string) => ipcRenderer.invoke(IPC_CHANNELS.PREVIEW_DETACH, deviceId) as Promise<void>,
  attachPreview: () => ipcRenderer.invoke(IPC_CHANNELS.PREVIEW_ATTACH) as Promise<void>,
  isPreviewDetached: () => ipcRenderer.invoke(IPC_CHANNELS.PREVIEW_IS_DETACHED) as Promise<boolean>,
  sendAgentMessage: (options: AgentSendOptions) => ipcRenderer.invoke(IPC_CHANNELS.AGENT_SEND, options),
  cancelAgent: () => ipcRenderer.invoke(IPC_CHANNELS.AGENT_CANCEL),
  applyAgentEdits: (editIds: string[]) => ipcRenderer.invoke(IPC_CHANNELS.AGENT_APPLY_EDITS, editIds),
  rejectAgentEdits: (editIds?: string[]) => ipcRenderer.invoke(IPC_CHANNELS.AGENT_REJECT_EDITS, editIds),
  getPendingEdits: () => ipcRenderer.invoke(IPC_CHANNELS.AGENT_GET_PENDING_EDITS) as Promise<ProposedEdit[]>,
  getGitStatus: (projectPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.GIT_STATUS, projectPath) as Promise<GitStatusResult>,
  gitInit: (projectPath: string) => ipcRenderer.invoke(IPC_CHANNELS.GIT_INIT, projectPath),
  gitStage: (projectPath: string, files: string[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.GIT_STAGE, projectPath, files),
  gitUnstage: (projectPath: string, files: string[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.GIT_UNSTAGE, projectPath, files),
  gitCommit: (projectPath: string, message: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.GIT_COMMIT, projectPath, message),
  gitDiff: (projectPath: string, filePath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.GIT_DIFF, projectPath, filePath) as Promise<GitDiffResult>,
  gitPull: (projectPath: string) => ipcRenderer.invoke(IPC_CHANNELS.GIT_PULL, projectPath),
  gitPush: (projectPath: string) => ipcRenderer.invoke(IPC_CHANNELS.GIT_PUSH, projectPath),
  gitCheckout: (projectPath: string, branch: string) => ipcRenderer.invoke(IPC_CHANNELS.GIT_CHECKOUT, projectPath, branch),
  gitBranch: (projectPath: string, branch: string) => ipcRenderer.invoke(IPC_CHANNELS.GIT_BRANCH, projectPath, branch),
  createTerminal: (options: TerminalCreateOptions) =>
    ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_CREATE, options),
  writeTerminal: (id: string, data: string) => ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_WRITE, id, data),
  destroyTerminal: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_DESTROY, id),
  runCommand: (options) =>
    ipcRenderer.invoke(IPC_CHANNELS.RUN_COMMAND, options) as Promise<RunCommandResult>,
  listProjectTemplates: () =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_LIST_TEMPLATES) as Promise<import('@peep/shared').ProjectTemplateInfo[]>,
  createProject: (options) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CREATE, options) as Promise<ProjectInfo>,
  createProjectFromPrompt: (options) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CREATE_FROM_PROMPT, options) as Promise<ProjectInfo>,
  selectFolder: () => ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SELECT_FOLDER) as Promise<string | null>,
  getTelemetryEnabled: () => ipcRenderer.invoke(IPC_CHANNELS.TELEMETRY_GET) as Promise<boolean>,
  setTelemetryEnabled: (enabled: boolean) => ipcRenderer.invoke(IPC_CHANNELS.TELEMETRY_SET, enabled),
  checkForUpdates: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_CHECK),
  downloadAndInstall: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_INSTALL),
  getUpdateStatus: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_GET_STATUS) as Promise<UpdateInfo>,
  completeOnboarding: () => ipcRenderer.invoke(IPC_CHANNELS.ONBOARDING_COMPLETE),
  onPreviewStatus: (callback) => subscribe<PreviewSession>(IPC_EVENTS.PREVIEW_STATUS, callback),
  onDiagnostics: (callback) => subscribe<Diagnostic[]>(IPC_EVENTS.DIAGNOSTICS_UPDATED, callback),
  onPreviewLog: (callback) => subscribe<string>(IPC_EVENTS.PREVIEW_LOG, callback),
  onAgentStream: (callback) => subscribe<AgentStreamEvent>(IPC_EVENTS.AGENT_STREAM, callback),
  onProposedEdits: (callback) => subscribe<ProposedEdit[]>(IPC_EVENTS.AGENT_PROPOSED_EDITS, callback),
  onTerminalOutput: (callback) =>
    subscribe<{ id: string; data: string }>(IPC_EVENTS.TERMINAL_OUTPUT, callback),
  onTerminalExit: (callback) => subscribe<{ id: string; code: number }>(IPC_EVENTS.TERMINAL_EXIT, callback),
  onGitChanged: (callback) => subscribe<void>(IPC_EVENTS.GIT_CHANGED, callback),
  onUpdateStatus: (callback) => subscribe<UpdateInfo>(IPC_EVENTS.APP_UPDATE_STATUS, callback),
  getPerformanceInfo: () => ipcRenderer.invoke(IPC_CHANNELS.AUDIT_PERFORMANCE),
  // Extensions
  searchExtensions: (query, offset, size) => ipcRenderer.invoke(IPC_CHANNELS.EXTENSIONS_SEARCH, query, offset, size) as Promise<import('@peep/shared').ExtensionSearchResult>,
  getInstalledExtensions: () => ipcRenderer.invoke(IPC_CHANNELS.EXTENSIONS_INSTALLED) as Promise<import('@peep/shared').ExtensionInfo[]>,
  installExtension: (id, url) => ipcRenderer.invoke(IPC_CHANNELS.EXTENSIONS_INSTALL, id, url) as Promise<void>,
  uninstallExtension: (id) => ipcRenderer.invoke(IPC_CHANNELS.EXTENSIONS_UNINSTALL, id) as Promise<void>,
  getExtensionDetails: (id) => ipcRenderer.invoke(IPC_CHANNELS.EXTENSIONS_DETAILS, id) as Promise<any>,
};

contextBridge.exposeInMainWorld('peep', api);
