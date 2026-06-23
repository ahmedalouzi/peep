import { randomUUID } from 'node:crypto';
import { join, isAbsolute, normalize } from 'node:path';
import { access } from 'node:fs/promises';
import type { BrowserWindow } from 'electron';
import { IPC_EVENTS } from '@peep/shared';
import type { ProposedEdit, AgentStreamEvent, AgentSendOptions } from '@peep/shared';
import { buildAgentContext, runAgentLoop, SCAFFOLD_SYSTEM_ADDENDUM, type ChatMessage } from '@peep/agent';
import type { DatabaseService } from './db';
import type { WorkspaceManager } from './workspace-manager';
import type { FlutterService } from './flutter-service';
import type { ReactNativeService } from './react-native-service';
import { searchFiles } from './file-search';
import { searchContent } from './content-search';

const RN_SYSTEM_ADDENDUM = `
This is a React Native / Expo project.
Key rules:
- Keep StyleSheet objects at the BOTTOM of each file.
- Use FlatList for lists, not map() inside ScrollView.
- Navigation: use useNavigation() hook (React Navigation) or expo-router Link/useRouter.
- Images: use require() for local assets, or <Image source={{uri}} />.
- Never inline style objects in JSX — always reference StyleSheet.
- State: prefer useState/useReducer for local; Zustand or Redux for global.
- Avoid deprecated APIs: use Pressable not TouchableOpacity for new code.
- File extensions: .tsx for components, .ts for logic/hooks.
`;

export class AgentService {
  private pendingEdits: ProposedEdit[] = [];
  private abortController: AbortController | null = null;
  private mainWindow: BrowserWindow | null = null;

  constructor(
    private db: DatabaseService,
    private workspace: WorkspaceManager,
    private flutter: FlutterService,
    private rnService?: ReactNativeService,
  ) {}

  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
  }

  private emitStream(event: AgentStreamEvent): void {
    this.mainWindow?.webContents.send(IPC_EVENTS.AGENT_STREAM, event);
  }

  private emitEdits(): void {
    this.mainWindow?.webContents.send(IPC_EVENTS.AGENT_PROPOSED_EDITS, this.pendingEdits);
  }

  private resolvePath(projectPath: string, inputPath: string): string {
    const cleaned = inputPath.replace(/^\.\//, '');
    const resolved = isAbsolute(cleaned) ? normalize(cleaned) : normalize(join(projectPath, cleaned));
    if (!resolved.startsWith(normalize(projectPath))) {
      throw new Error('Path is outside project workspace');
    }
    return resolved;
  }

  private async buildTreeSummary(projectPath: string): Promise<string> {
    const entries = await this.workspace.listDir(projectPath, 0, 2);
    const lines: string[] = [];

    function walk(items: typeof entries, indent = ''): void {
      for (const item of items) {
        lines.push(`${indent}${item.type === 'directory' ? '📁' : '📄'} ${item.name}`);
        if (item.children && indent.length < 4) {
          walk(item.children, `${indent}  `);
        }
      }
    }

    walk(entries);
    return lines.slice(0, 80).join('\n') || projectPath;
  }

  getPendingEdits(): ProposedEdit[] {
    return [...this.pendingEdits];
  }

  rejectEdits(editIds?: string[]): void {
    if (!editIds || editIds.length === 0) {
      this.pendingEdits = [];
    } else {
      this.pendingEdits = this.pendingEdits.filter((e) => !editIds.includes(e.id));
    }
    this.emitEdits();
  }

  async applyEdits(editIds: string[]): Promise<void> {
    const project = this.workspace.getProject();
    if (!project) throw new Error('No project open');

    const toApply = this.pendingEdits.filter((e) => editIds.includes(e.id));
    for (const edit of toApply) {
      await this.workspace.writeFile(edit.path, edit.proposedContent);
    }

    this.pendingEdits = this.pendingEdits.filter((e) => !editIds.includes(e.id));
    this.emitEdits();

    const diagnostics = await this.flutter.analyze(project.path);
    this.mainWindow?.webContents.send(IPC_EVENTS.DIAGNOSTICS_UPDATED, diagnostics);
  }

  cancel(): void {
    this.abortController?.abort();
    this.abortController = null;
  }

  async scaffold(projectPath: string, prompt: string): Promise<void> {
    await this.send({
      message: prompt,
      projectPath,
      autoApplyEdits: true,
      scaffoldMode: true,
    });
  }

  async send(options: AgentSendOptions): Promise<void> {
    const settings = this.db.getSettingsRaw();
    if (!settings.apiKey) {
      this.emitStream({ type: 'error', content: 'Add your OpenAI API key in Settings (gear icon).' });
      return;
    }

    this.cancel();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    // ── Platform-aware context ──────────────────────────────────────────────
    let isReactNative = false;
    let pubspec: string | undefined;
    let mainDart: string | undefined;
    let packageJson: string | undefined;
    let appEntry: string | undefined;

    // Detect platform by checking for pubspec.yaml vs package.json
    try {
      await access(join(options.projectPath, 'pubspec.yaml'));
      // Flutter project
      pubspec = await this.workspace.readFile(join(options.projectPath, 'pubspec.yaml')).catch(() => undefined);
      mainDart = await this.workspace.readFile(join(options.projectPath, 'lib', 'main.dart')).catch(() => undefined);
    } catch {
      const fullText = (options.history?.map(h => h.content).join(' ') || '') + ' ' + options.message;
      if (fullText.toLowerCase().includes('flutter')) {
        isReactNative = false;
        // User explicitly asked for Flutter, check if SDK is installed
        const flutterSdk = await this.flutter.detectSdk();
        if (!flutterSdk) {
          this.emitStream({ type: 'error', content: 'Flutter SDK is not detected. Please install Flutter and add the path in Settings, or ask me to build it with React Native instead.' });
          return;
        }
      } else {
        isReactNative = true;
      }
      
      packageJson = await this.workspace.readFile(join(options.projectPath, 'package.json')).catch(() => undefined);
      // Try common RN entry points
      appEntry = await this.workspace.readFile(join(options.projectPath, 'App.tsx')).catch(() =>
        this.workspace.readFile(join(options.projectPath, 'App.js')).catch(() => undefined)
      );
    }

    const treeSummary = await this.buildTreeSummary(options.projectPath);

    const rnAddendum = isReactNative ? RN_SYSTEM_ADDENDUM : '';
    const systemContext =
      (options.scaffoldMode ? `${SCAFFOLD_SYSTEM_ADDENDUM}\n\n` : '') +
      rnAddendum +
      buildAgentContext({
        projectPath: options.projectPath,
        treeSummary,
        pubspec: pubspec ?? packageJson,
        mainDart: mainDart ?? appEntry,
        openFilePath: options.openFilePath,
        openFileContent: options.openFileContent,
        diagnostics: options.diagnostics?.map((d) => ({
          file: d.file,
          line: d.line,
          message: d.message,
          severity: d.severity,
        })),
        userMessage: options.message,
      });

    const messages: ChatMessage[] = [
      { role: 'system', content: systemContext },
    ];

    if (options.history) {
      for (const msg of options.history) {
        messages.push({ role: msg.role as 'user' | 'assistant', content: msg.content || '' });
      }
    }

    messages.push({ role: 'user', content: options.message });

    const autoApply = options.autoApplyEdits ?? false;

    const executor = {
      execute: async (name: string, args: Record<string, unknown>): Promise<string> => {
        switch (name) {
          case 'read_file': {
            const path = this.resolvePath(options.projectPath, String(args.path));
            const content = await this.workspace.readFile(path);
            return content.length > 12000 ? `${content.slice(0, 12000)}\n...[truncated]` : content;
          }
          case 'list_dir': {
            const path = this.resolvePath(options.projectPath, String(args.path || '.'));
            const entries = await this.workspace.listDir(path, 0, 2);
            return JSON.stringify(entries, null, 2);
          }
          case 'search_files': {
            const matches = await searchFiles(options.projectPath, String(args.query));
            return matches.map((m) => m.path).join('\n') || 'No files found';
          }
          case 'search_content': {
            const matches = await searchContent(options.projectPath, String(args.query));
            return (
              matches.map((m) => `${m.file}:${m.line}: ${m.text}`).join('\n') || 'No matches found'
            );
          }
          case 'propose_file_edit': {
            const path = this.resolvePath(options.projectPath, String(args.path));
            const proposedContent = String(args.content);
            let originalContent = '';
            try {
              originalContent = await this.workspace.readFile(path);
            } catch {
              originalContent = '';
            }

            const edit: ProposedEdit = {
              id: randomUUID(),
              path,
              originalContent,
              proposedContent,
              description: args.description ? String(args.description) : undefined,
            };

            if (autoApply) {
              await this.workspace.writeFile(path, proposedContent);
              
              let diagOutput = '';
              try {
                const isFlutter = await this.flutter.isFlutterProject(options.projectPath);
                if (isFlutter) {
                  const diags = await this.flutter.analyze(options.projectPath);
                  if (diags.length > 0) {
                    diagOutput = '\n\nActive compilation/analysis diagnostics after this change:\n' +
                      diags.map(d => `- [${d.severity}] ${d.file}:${d.line}:${d.column} - ${d.message}`).join('\n');
                  } else {
                    diagOutput = '\n\nAnalysis passed with 0 errors.';
                  }
                } else if (this.rnService) {
                  const isRN = await this.rnService.isReactNativeProject(options.projectPath);
                  if (isRN) {
                    const diags = await this.rnService.analyze(options.projectPath);
                    if (diags.length > 0) {
                      diagOutput = '\n\nActive React Native TS/ESLint diagnostics after this change:\n' +
                        diags.map(d => `- [${d.severity}] ${d.file}:${d.line}:${d.column} - ${d.message}`).join('\n');
                    } else {
                      diagOutput = '\n\nAnalysis passed with 0 errors.';
                    }
                  }
                }
              } catch (e) {
                // Ignore errors
              }

              return `Applied edit to ${path}.${diagOutput}`;
            }

            const existingIndex = this.pendingEdits.findIndex((e) => e.path === path);
            if (existingIndex >= 0) {
              this.pendingEdits[existingIndex] = edit;
            } else {
              this.pendingEdits.push(edit);
            }

            this.emitEdits();
            return `Proposed edit for ${path}. Waiting for user approval.`;
          }
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      },
    };

    try {
      await runAgentLoop(
        {
          apiKey: settings.apiKey,
          provider: settings.apiProvider ?? 'openai',
          model: settings.apiModel,
        },
        systemContext,
        messages.slice(1), // Exclude the first one since it's the system message we just added above, but wait: runAgentLoop will prepend systemContext. Let's just pass the user/assistant messages array.
        executor,
        {
          onStatus: (message) => this.emitStream({ type: 'status', content: message }),
          onDelta: (text) => this.emitStream({ type: 'delta', content: text }),
          onError: (message) => this.emitStream({ type: 'error', content: message }),
          onDone: () => this.emitStream({ type: 'done', content: '' }),
        },
        signal,
      );
    } catch (error) {
      if (signal.aborted) {
        this.emitStream({ type: 'error', content: 'Cancelled' });
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      this.emitStream({ type: 'error', content: message });
    } finally {
      this.abortController = null;
    }
  }
}
