export type PlatformTarget = 'flutter' | 'react-native' | 'expo' | 'unknown';


export interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileEntry[];
}

export interface ProjectInfo {
  id: string;
  path: string;
  name: string;
  lastOpened: string;
  platform: PlatformTarget;
}

export interface RnProjectInfo {
  nodeVersion: string;
  hasExpo: boolean;
  hasReactNative: boolean;
  rnVersion?: string;
  expoVersion?: string;
}


export interface Diagnostic {
  file: string;
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface PreviewSession {
  url: string;
  processId: number;
  status: 'starting' | 'running' | 'stopped' | 'error';
  error?: string;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

export interface ProposedEdit {
  id: string;
  path: string;
  originalContent: string;
  proposedContent: string;
  description?: string;
}

export interface AgentStreamEvent {
  type: 'status' | 'delta' | 'done' | 'error';
  content: string;
}

export interface Settings {
  flutterSdkPath?: string;
  theme: 'dark' | 'light';
  autoSave: boolean;
  apiProvider?: 'openai' | 'anthropic' | 'google';
  apiKey?: string;
  apiModel?: string;
  apiKeyConfigured?: boolean;
  onboardingCompleted?: boolean;
  telemetryEnabled?: boolean;
}

export type UpdateStatus = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'ready' | 'error';

export interface UpdateInfo {
  status: UpdateStatus;
  version?: string;
  percent?: number;
  error?: string;
}

export interface SdkInfo {
  path: string;
  version: string;
}

export interface AgentSendOptions {
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  projectPath?: string;
  openFilePath?: string;
  openFileContent?: string;
  diagnostics?: Diagnostic[];
  autoApplyEdits?: boolean;
  scaffoldMode?: boolean;
}

export interface ProjectTemplateInfo {
  id: string;
  name: string;
  description: string;
}

export interface CreateProjectOptions {
  name: string;
  parentPath: string;
  templateId: string;
}

export interface CreateProjectFromPromptOptions {
  name: string;
  parentPath: string;
  prompt: string;
}

export interface GitFileChange {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'staged';
  staged: boolean;
}

export interface GitStatusResult {
  isRepo: boolean;
  branch: string;
  changes: GitFileChange[];
}

export interface GitDiffResult {
  path: string;
  diff: string;
}

export interface TerminalCreateOptions {
  id: string;
  cwd: string;
}

export interface RunCommandOptions {
  command: string;
  cwd: string;
}

export interface RunCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ExtensionInfo {
  id: string;           // "ms-python.python"
  name: string;
  namespace: string;
  version: string;
  displayName?: string;
  description?: string;
  iconUrl?: string;
  downloadCount?: number;
  averageRating?: number;
  downloadUrl?: string;
  installed: boolean;
}

export interface ExtensionSearchResult {
  extensions: ExtensionInfo[];
  totalSize: number;
  offset: number;
}

export const IPC_CHANNELS = {
  WORKSPACE_OPEN_FOLDER: 'workspace:openFolder',
  WORKSPACE_GET_RECENT: 'workspace:getRecent',
  WORKSPACE_LIST_DIR: 'workspace:listDir',
  WORKSPACE_READ_FILE: 'workspace:readFile',
  WORKSPACE_READ_IMAGE: 'workspace:readImage',
  WORKSPACE_WRITE_FILE: 'workspace:writeFile',
  WORKSPACE_CREATE_DIR: 'workspace:createDir',
  WORKSPACE_RENAME_ITEM: 'workspace:renameItem',
  WORKSPACE_DELETE_ITEM: 'workspace:deleteItem',
  WORKSPACE_REVEAL_ITEM: 'workspace:revealItem',
  WORKSPACE_GET_PROJECT: 'workspace:getProject',
  WORKSPACE_SEARCH_FILES: 'workspace:searchFiles',
  WORKSPACE_SEARCH_CONTENT: 'workspace:searchContent',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  APP_GET_VERSION: 'app:getVersion',
  APP_NEW_WINDOW: 'app:newWindow',
  APP_EXIT: 'app:exit',
  APP_MINIMIZE: 'app:minimize',
  APP_MAXIMIZE: 'app:maximize',
  DIALOG_OPEN_FOLDER: 'dialog:openFolder',
  DIALOG_OPEN_FILE: 'dialog:openFile',
  DIALOG_SAVE_FILE: 'dialog:saveFile',
  FLUTTER_DETECT_SDK: 'flutter:detectSdk',
  FLUTTER_ANALYZE: 'flutter:analyze',
  FLUTTER_PUB_GET: 'flutter:pubGet',
  PREVIEW_START: 'preview:start',
  PREVIEW_STOP: 'preview:stop',
  PREVIEW_RELOAD: 'preview:reload',
  AGENT_SEND: 'agent:send',
  AGENT_CANCEL: 'agent:cancel',
  AGENT_APPLY_EDITS: 'agent:applyEdits',
  AGENT_REJECT_EDITS: 'agent:rejectEdits',
  AGENT_GET_PENDING_EDITS: 'agent:getPendingEdits',
  GIT_STATUS: 'git:status',
  GIT_INIT: 'git:init',
  GIT_STAGE: 'git:stage',
  GIT_UNSTAGE: 'git:unstage',
  GIT_COMMIT: 'git:commit',
  GIT_DIFF: 'git:diff',
  GIT_PULL: 'git:pull',
  GIT_PUSH: 'git:push',
  GIT_CHECKOUT: 'git:checkout',
  GIT_BRANCH: 'git:branch',
  TERMINAL_CREATE: 'terminal:create',
  TERMINAL_WRITE: 'terminal:write',
  TERMINAL_DESTROY: 'terminal:destroy',
  RUN_COMMAND: 'terminal:runCommand',
  PROJECT_LIST_TEMPLATES: 'project:listTemplates',
  PROJECT_CREATE: 'project:create',
  PROJECT_CREATE_FROM_PROMPT: 'project:createFromPrompt',
  DIALOG_SELECT_FOLDER: 'dialog:selectFolder',
  TELEMETRY_GET: 'telemetry:get',
  TELEMETRY_SET: 'telemetry:set',
  UPDATE_CHECK: 'update:check',
  UPDATE_INSTALL: 'update:install',
  UPDATE_GET_STATUS: 'update:getStatus',
  ONBOARDING_COMPLETE: 'onboarding:complete',
  // React Native
  RN_DETECT_PROJECT: 'rn:detectProject',
  RN_GET_PROJECT_INFO: 'rn:getProjectInfo',
  RN_INSTALL: 'rn:install',
  RN_ANALYZE: 'rn:analyze',
  RN_START_PREVIEW: 'rn:startPreview',
  RN_STOP_PREVIEW: 'rn:stopPreview',
  RN_RELOAD_PREVIEW: 'rn:reloadPreview',
  // Platform
  PLATFORM_DETECT: 'platform:detect',
  // Audit
  AUDIT_PERFORMANCE: 'audit:performance',
  AUDIT_PROJECT: 'audit:project',
  // Preview Detached Window
  PREVIEW_GET_SESSION: 'preview:getSession',
  PREVIEW_DETACH: 'preview:detach',
  PREVIEW_ATTACH: 'preview:attach',
  PREVIEW_IS_DETACHED: 'preview:isDetached',
  // Extensions
  EXTENSIONS_SEARCH: 'extensions:search',
  EXTENSIONS_INSTALLED: 'extensions:installed',
  EXTENSIONS_INSTALL: 'extensions:install',
  EXTENSIONS_UNINSTALL: 'extensions:uninstall',
  EXTENSIONS_DETAILS: 'extensions:details',
  // Publish
  PUBLISH_GET_STATUS: 'publish:getStatus',
  PUBLISH_DEPLOY: 'publish:deploy',
  PUBLISH_EAS_BUILD: 'publish:easBuild',
  PUBLISH_DETECT_DEPS: 'publish:detectDeps',
  PUBLISH_BUILD: 'publish:build',
  PUBLISH_CANCEL: 'publish:cancel',
  PUBLISH_GET_BUILD: 'publish:getBuild',
  PUBLISH_LIST_BUILDS: 'publish:listBuilds',
  PUBLISH_OPEN_FOLDER: 'publish:openFolder',
  PUBLISH_EXPORT_PROJECT: 'publish:exportProject',
} as const;

// ── Publish / Build types ─────────────────────────────────────────────────────

export interface PublishStatus {
  status: 'idle' | 'building' | 'deploying' | 'completed' | 'error';
  progress?: number;
  message: string;
  url?: string;
  logs: string[];
}

export type BuildStatus =
  | 'idle'
  | 'waiting'
  | 'preparing'
  | 'building'
  | 'packaging'
  | 'signing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type BuildTarget = 'apk' | 'aab' | 'both';

export interface PublishOptions {
  projectPath: string;
  target: BuildTarget;
  versionName?: string;  // e.g. "1.0.0"
  versionCode?: number;  // e.g. 1
}

export interface BuildArtifact {
  type: 'apk' | 'aab';
  path: string;
  sizeBytes: number;
}

export interface BuildRecord {
  id: string;
  projectPath: string;
  target: BuildTarget;
  status: BuildStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  artifacts: BuildArtifact[];
  error?: string;
  versionName: string;
  versionCode: number;
  qrDataUrl?: string;  // base64 data URL of QR code
}

export type DependencyStatus = 'checking' | 'found' | 'missing' | 'error';

export interface DependencyInfo {
  name: string;
  status: DependencyStatus;
  version?: string;
  path?: string;
  installUrl?: string;
  errorMessage?: string;
}

export interface DependencyCheckResult {
  flutter: DependencyInfo;
  androidSdk: DependencyInfo;
  java: DependencyInfo;
  adb: DependencyInfo;
  allReady: boolean;
}


export const IPC_EVENTS = {
  PREVIEW_STATUS: 'preview:status',
  DIAGNOSTICS_UPDATED: 'diagnostics:updated',
  PREVIEW_LOG: 'preview:log',
  AGENT_STREAM: 'agent:stream',
  AGENT_PROPOSED_EDITS: 'agent:proposedEdits',
  TERMINAL_OUTPUT: 'terminal:output',
  TERMINAL_EXIT: 'terminal:exit',
  GIT_CHANGED: 'git:changed',
  APP_UPDATE_STATUS: 'app:updateStatus',
  PUBLISH_STATUS: 'publish:status',
  PUBLISH_LOG: 'publish:log',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
export type IpcEvent = (typeof IPC_EVENTS)[keyof typeof IPC_EVENTS];

export interface IpcApi {
  openFolder: () => Promise<ProjectInfo | null>;
  openFile: () => Promise<{ path: string; content: string } | null>;
  saveFileAs: (defaultPath?: string, content?: string) => Promise<string | null>;
  newWindow: () => Promise<void>;
  exitApp: () => Promise<void>;
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  openProjectByPath: (path: string) => Promise<ProjectInfo>;
  getRecentProjects: () => Promise<ProjectInfo[]>;
  listDir: (dirPath: string) => Promise<FileEntry[]>;
  readFile: (filePath: string) => Promise<string>;
  readImage: (filePath: string) => Promise<string>;
  writeFile: (filePath: string, content: string) => Promise<void>;
  createDir: (dirPath: string) => Promise<void>;
  renameItem: (oldPath: string, newPath: string) => Promise<void>;
  deleteItem: (path: string) => Promise<void>;
  revealItem: (path: string) => Promise<void>;
  getProject: () => Promise<ProjectInfo | null>;
  searchFiles: (rootPath: string, query: string) => Promise<FileEntry[]>;
  searchContent: (opts: { projectPath: string; query: string; caseSensitive?: boolean; isRegex?: boolean; maxResults?: number }) => Promise<any[]>;
  getSettings: () => Promise<Settings>;
  setSettings: (settings: Partial<Settings>) => Promise<Settings>;
  getVersion: () => Promise<string>;
  detectFlutterSdk: () => Promise<SdkInfo | null>;
  analyzeProject: (projectPath: string) => Promise<Diagnostic[]>;
  pubGet: (projectPath: string) => Promise<void>;
  startPreview: (projectPath: string) => Promise<PreviewSession>;
  rnStartPreview: (projectPath: string) => Promise<PreviewSession>;
  stopPreview: () => Promise<void>;
  rnStopPreview: (processId: number) => Promise<void>;
  reloadPreview: () => Promise<void>;
  rnReloadPreview: (processId: number) => Promise<void>;
  getPreviewSession: () => Promise<PreviewSession | null>;
  detachPreview: (deviceId?: string) => Promise<void>;
  attachPreview: () => Promise<void>;
  isPreviewDetached: () => Promise<boolean>;
  sendAgentMessage: (options: AgentSendOptions) => Promise<void>;
  cancelAgent: () => Promise<void>;
  applyAgentEdits: (editIds: string[]) => Promise<void>;
  rejectAgentEdits: (editIds?: string[]) => Promise<void>;
  getPendingEdits: () => Promise<ProposedEdit[]>;
  getGitStatus: (projectPath: string) => Promise<GitStatusResult>;
  gitInit: (projectPath: string) => Promise<void>;
  gitStage: (projectPath: string, files: string[]) => Promise<void>;
  gitUnstage: (projectPath: string, files: string[]) => Promise<void>;
  gitCommit: (projectPath: string, message: string) => Promise<void>;
  gitDiff: (projectPath: string, filePath: string) => Promise<GitDiffResult>;
  gitPull: (projectPath: string) => Promise<void>;
  gitPush: (projectPath: string) => Promise<void>;
  gitCheckout: (projectPath: string, branch: string) => Promise<void>;
  gitBranch: (projectPath: string, branch: string) => Promise<void>;
  createTerminal: (options: TerminalCreateOptions) => Promise<void>;
  writeTerminal: (id: string, data: string) => Promise<void>;
  destroyTerminal: (id: string) => Promise<void>;
  runCommand: (options: RunCommandOptions) => Promise<RunCommandResult>;
  listProjectTemplates: () => Promise<ProjectTemplateInfo[]>;
  createProject: (options: CreateProjectOptions) => Promise<ProjectInfo>;
  createProjectFromPrompt: (options: CreateProjectFromPromptOptions) => Promise<ProjectInfo>;
  selectFolder: () => Promise<string | null>;
  getTelemetryEnabled: () => Promise<boolean>;
  setTelemetryEnabled: (enabled: boolean) => Promise<void>;
  checkForUpdates: () => Promise<void>;
  downloadAndInstall: () => Promise<void>;
  getUpdateStatus: () => Promise<UpdateInfo>;
  completeOnboarding: () => Promise<void>;
  getPerformanceInfo?: () => Promise<{ heapUsedMB: number; rssMemMB: number }>;
  publishGetStatus: () => Promise<PublishStatus>;
  publishDeploy: (projectPath: string, platform: 'flutter' | 'react-native', target: 'vercel' | 'netlify', token?: string) => Promise<void>;
  publishCancel: () => Promise<void>;
  onPreviewStatus: (callback: (session: PreviewSession) => void) => () => void;
  onDiagnostics: (callback: (diagnostics: Diagnostic[]) => void) => () => void;
  onPreviewLog: (callback: (line: string) => void) => () => void;
  onAgentStream: (callback: (event: AgentStreamEvent) => void) => () => void;
  onProposedEdits: (callback: (edits: ProposedEdit[]) => void) => () => void;
  onTerminalOutput: (callback: (payload: { id: string; data: string }) => void) => () => void;
  onTerminalExit: (callback: (payload: { id: string; code: number }) => void) => () => void;
  onGitChanged: (callback: () => void) => () => void;
  onUpdateStatus: (callback: (info: UpdateInfo) => void) => () => void;
  // Extensions
  searchExtensions: (query: string, offset?: number, size?: number) => Promise<ExtensionSearchResult>;
  getInstalledExtensions: () => Promise<ExtensionInfo[]>;
  installExtension: (extensionId: string, downloadUrl?: string) => Promise<void>;
  uninstallExtension: (extensionId: string) => Promise<void>;
  getExtensionDetails: (extensionId: string) => Promise<any>;
  onPublishStatus: (callback: (status: any) => void) => () => void;
  onPublishLog: (callback: (line: string) => void) => () => void;
  onOpenFile: (callback: (file: any) => void) => () => void;

}

declare global {
  interface Window {
    peep: IpcApi;
  }
}
