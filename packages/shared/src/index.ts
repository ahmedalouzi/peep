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

export const IPC_CHANNELS = {
  WORKSPACE_OPEN_FOLDER: 'workspace:openFolder',
  WORKSPACE_GET_RECENT: 'workspace:getRecent',
  WORKSPACE_LIST_DIR: 'workspace:listDir',
  WORKSPACE_READ_FILE: 'workspace:readFile',
  WORKSPACE_WRITE_FILE: 'workspace:writeFile',
  WORKSPACE_GET_PROJECT: 'workspace:getProject',
  WORKSPACE_SEARCH_FILES: 'workspace:searchFiles',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  APP_GET_VERSION: 'app:getVersion',
  DIALOG_OPEN_FOLDER: 'dialog:openFolder',
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
  // Publish
  PUBLISH_GET_STATUS: 'publish:getStatus',
  PUBLISH_BUILD_DEPLOY: 'publish:buildDeploy',
  PUBLISH_EAS_BUILD: 'publish:easBuild',
  PUBLISH_CANCEL: 'publish:cancel',
} as const;

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
  openProjectByPath: (path: string) => Promise<ProjectInfo>;
  getRecentProjects: () => Promise<ProjectInfo[]>;
  listDir: (dirPath: string) => Promise<FileEntry[]>;
  readFile: (filePath: string) => Promise<string>;
  writeFile: (filePath: string, content: string) => Promise<void>;
  getProject: () => Promise<ProjectInfo | null>;
  searchFiles: (rootPath: string, query: string) => Promise<FileEntry[]>;
  getSettings: () => Promise<Settings>;
  setSettings: (settings: Partial<Settings>) => Promise<Settings>;
  getVersion: () => Promise<string>;
  detectFlutterSdk: () => Promise<SdkInfo | null>;
  analyzeProject: (projectPath: string) => Promise<Diagnostic[]>;
  pubGet: (projectPath: string) => Promise<void>;
  startPreview: (projectPath: string) => Promise<PreviewSession>;
  stopPreview: () => Promise<void>;
  reloadPreview: () => Promise<void>;
  getPreviewSession: () => Promise<PreviewSession | null>;
  detachPreview: () => Promise<void>;
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
  publishGetStatus: () => Promise<any>;
  publishBuildDeploy: (options: { projectPath: string, platform: 'flutter' | 'react-native', target: 'vercel' | 'netlify', token?: string }) => Promise<void>;
  publishEasBuild: (options: { projectPath: string }) => Promise<void>;
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
  onPublishStatus: (callback: (status: any) => void) => () => void;
  onPublishLog: (callback: (line: string) => void) => () => void;
  onOpenFile: (callback: (file: any) => void) => () => void;
}

declare global {
  interface Window {
    peep: IpcApi;
  }
}
