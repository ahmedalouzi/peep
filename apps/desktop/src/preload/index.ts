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
  openProjectByPath: (path: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_OPEN_FOLDER, path) as Promise<ProjectInfo>,
  getRecentProjects: () => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_GET_RECENT),
  listDir: (dirPath: string) => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_LIST_DIR, dirPath),
  readFile: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_READ_FILE, filePath),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_WRITE_FILE, filePath, content),
  getProject: () => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_GET_PROJECT),
  searchFiles: (rootPath: string, query: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_SEARCH_FILES, rootPath, query),
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
  detachPreview: () => ipcRenderer.invoke(IPC_CHANNELS.PREVIEW_DETACH) as Promise<void>,
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
  publishGetStatus: () => ipcRenderer.invoke(IPC_CHANNELS.PUBLISH_GET_STATUS),
  publishBuildDeploy: (options: {
    projectPath: string;
    platform: 'flutter' | 'react-native';
    target: 'vercel' | 'netlify';
    token?: string;
  }) => ipcRenderer.invoke(IPC_CHANNELS.PUBLISH_BUILD_DEPLOY, options),
  publishEasBuild: (options: { projectPath: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.PUBLISH_EAS_BUILD, options),
  publishCancel: () => ipcRenderer.invoke(IPC_CHANNELS.PUBLISH_CANCEL),
  onPublishStatus: (callback: (status: any) => void) =>
    subscribe<any>(IPC_EVENTS.PUBLISH_STATUS, callback),
  onPublishLog: (callback: (line: string) => void) =>
    subscribe<string>(IPC_EVENTS.PUBLISH_LOG, callback),
  onOpenFile: (callback: (file: any) => void) =>
    subscribe<any>('workspace:open-file', callback),
};

contextBridge.exposeInMainWorld('peep', api);
