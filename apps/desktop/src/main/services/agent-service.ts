import { randomUUID } from 'node:crypto';
import { join, isAbsolute, normalize } from 'node:path';
import { access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
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
- **PLANNING**: For requests that require writing, modifying, or scaffolding code files, you MUST first create or update a file named \`.peep/plan.md\` in the project root. This file must contain a clean, simple, bulleted and summarized checklist of the features/tasks you plan to implement. Do NOT edit code files in the same turn as writing/updating the plan. Instead, instruct the user to click the "Proceed with Implementation" button in the plan tab. Only when the user says "Proceed with implementation" should you propose the actual code edits.
- **AUTONOMY**: Never ask conversational questions or request permission for coding tasks. On initial request, immediately write/update the \`.peep/plan.md\` file and tell the user to click "Proceed". Once they click or say "Proceed with implementation", you have full authority to execute ALL edits, run terminal commands, compile/typecheck, and self-correct diagnostics. You MUST NOT update the plan, stop, or ask for confirmation again. Execute all necessary tool calls and finish the task completely in that same run-loop.
- **CONVERSATIONAL CHAT**: If the user's message is a greeting (e.g., "hi", "hello"), a general question, or a discussion that does NOT ask you to write, edit, or scaffold code, respond conversationally, politely, and briefly. In this case, do NOT call any tools, do NOT create/update the plan, and do NOT ask them to click "Proceed".
- **WALKTHROUGH**: After completing the code edits (in the same turn you propose the code changes), you MUST also create or update a file named \`.peep/walkthrough.md\` in the project root via the tool call. This file must contain a clear, professional summary of the changes made, the files created/modified, and details on how the developer can verify the new features.
- **CODE PRESERVATION**: When modifying or refactoring files, you MUST preserve all existing features, UI elements, handlers, imports, and business logic unless explicitly requested to remove or replace them. Never drop progress indicators, buttons, state properties, or helper methods during subsequent feature additions.
- **NO CODEBLOCKS IN CHAT**: Do NOT output full code files or code blocks in your chat responses. All code additions/modifications must be proposed via tool calls. Your text response should only describe/summarize the changes.
- **RUNNING COMMANDS**: You possess the \`run_command\` tool. Use it to install dependencies, run linting checks, typechecks, compiler diagnostics, and unit tests (e.g., \`pnpm install\`, \`pnpm typecheck\`, \`pnpm test\`, etc.) to verify your changes and resolve issues.
- **CHAT FORMATTING STYLE**: Your text responses in the chat must be extremely concise, clean, and conversational. Do NOT output bulleted lists of changed files, markdown lists with asterisks, or duplicate the walkthrough/implementation plan. Speak directly in clean, professional, short paragraphs. Describe the high-level intent/behavior of your change instead of listing files.
- **MULTI-FILE WRITES**: Write or modify ALL files associated with a feature/request in a single turn. Do not propose one file and wait for the user to say "proceed" to propose the next one. Use sequential tool calls in the same response.
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

  async rejectEdits(editIds?: string[]): Promise<void> {
    if (!editIds || editIds.length === 0) {
      for (const edit of this.pendingEdits) {
        await this.workspace.writeFile(edit.path, edit.originalContent);
      }
      this.pendingEdits = [];
    } else {
      const toRevert = this.pendingEdits.filter((e) => editIds.includes(e.id));
      for (const edit of toRevert) {
        await this.workspace.writeFile(edit.path, edit.originalContent);
      }
      this.pendingEdits = this.pendingEdits.filter((e) => !editIds.includes(e.id));
    }
    this.emitEdits();
  }

  async applyEdits(editIds: string[]): Promise<void> {
    const project = this.workspace.getProject();
    if (!project) throw new Error('No project open');

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
    const projectPath = options.projectPath;
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

    if (projectPath) {
      // Detect platform by checking for pubspec.yaml vs package.json
      try {
        await access(join(projectPath, 'pubspec.yaml'));
        // Flutter project
        pubspec = await this.workspace.readFile(join(projectPath, 'pubspec.yaml')).catch(() => undefined);
        mainDart = await this.workspace.readFile(join(projectPath, 'lib', 'main.dart')).catch(() => undefined);
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
        
        packageJson = await this.workspace.readFile(join(projectPath, 'package.json')).catch(() => undefined);
        // Try common RN entry points
        appEntry = await this.workspace.readFile(join(projectPath, 'App.tsx')).catch(() =>
          this.workspace.readFile(join(projectPath, 'App.js')).catch(() => undefined)
        );
      }
    }

    const treeSummary = projectPath ? await this.buildTreeSummary(projectPath) : '';

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
        previewError: options.previewError,
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



    const executor = {
      lastOriginalContent: '',
      execute: async (name: string, args: Record<string, unknown>): Promise<string> => {
        if (!projectPath) {
          throw new Error('No project workspace open. Please open a project first.');
        }

        switch (name) {
          case 'read_file': {
            const path = this.resolvePath(projectPath, String(args.path));
            const content = await this.workspace.readFile(path);
            return content.length > 12000 ? `${content.slice(0, 12000)}\n...[truncated]` : content;
          }
          case 'list_dir': {
            const path = this.resolvePath(projectPath, String(args.path || '.'));
            const entries = await this.workspace.listDir(path, 0, 2);
            return JSON.stringify(entries, null, 2);
          }
          case 'search_files': {
            const matches = await searchFiles(projectPath, String(args.query));
            return matches.map((m) => m.path).join('\n') || 'No files found';
          }
          case 'search_content': {
            const matches = await searchContent(projectPath, String(args.query));
            return (
              matches.map((m) => `${m.file}:${m.line}: ${m.text}`).join('\n') || 'No matches found'
            );
          }
          case 'run_command': {
            const commandStr = String(args.command);
            return new Promise<string>((resolve) => {
              const shell = process.platform === 'win32';
              const child = spawn(commandStr, {
                cwd: projectPath,
                shell,
                env: process.env,
              });

              let stdout = '';
              let stderr = '';

              child.stdout?.on('data', (chunk) => {
                stdout += chunk.toString();
              });
              child.stderr?.on('data', (chunk) => {
                stderr += chunk.toString();
              });

              const timeout = setTimeout(() => {
                child.kill();
                resolve(`Command timed out after 120s.\nStdout:\n${stdout}\nStderr:\n${stderr}`);
              }, 120000);

              child.on('close', (code) => {
                clearTimeout(timeout);
                resolve(`Command exited with code ${code}.\nStdout:\n${stdout}\nStderr:\n${stderr}`);
              });

              child.on('error', (err) => {
                clearTimeout(timeout);
                resolve(`Command execution error: ${err.message}\nStdout:\n${stdout}\nStderr:\n${stderr}`);
              });
            });
          }
          case 'propose_file_edit': {
            const path = this.resolvePath(projectPath, String(args.path));
            const proposedContent = String(args.content);

            if (path.endsWith('.peep/plan.md') || path.endsWith('.peep\\plan.md')) {
              await this.workspace.writeFile(path, proposedContent);
              this.mainWindow?.webContents.send('workspace:open-file', {
                path,
                name: '📋 Implementation Plan',
                content: proposedContent,
                dirty: false,
              });
              return `Plan updated successfully.`;
            }

            if (path.endsWith('.peep/walkthrough.md') || path.endsWith('.peep\\walkthrough.md')) {
              await this.workspace.writeFile(path, proposedContent);
              this.mainWindow?.webContents.send('workspace:open-file', {
                path,
                name: '📋 Walkthrough',
                content: proposedContent,
                dirty: false,
              });
              return `Walkthrough updated successfully.`;
            }

            let originalContent = '';
            try {
              originalContent = await this.workspace.readFile(path);
            } catch {
              originalContent = '';
            }

            executor.lastOriginalContent = originalContent;

            const edit: ProposedEdit = {
              id: randomUUID(),
              path,
              originalContent,
              proposedContent,
              description: args.description ? String(args.description) : undefined,
            };

            // Write the proposed content to disk immediately so simulator hot-reloads and user reviews live!
            await this.workspace.writeFile(path, proposedContent);

            const existingIndex = this.pendingEdits.findIndex((e) => e.path === path);
            if (existingIndex >= 0) {
              // Preserve the first original content for full rollback capability
              edit.originalContent = this.pendingEdits[existingIndex].originalContent;
              this.pendingEdits[existingIndex] = edit;
            } else {
              this.pendingEdits.push(edit);
            }

            this.emitEdits();

            let diagOutput = '';
            try {
              const isFlutter = await this.flutter.isFlutterProject(projectPath);
              if (isFlutter) {
                const diags = await this.flutter.analyze(projectPath);
                if (diags.length > 0) {
                  diagOutput = '\n\nActive compilation/analysis diagnostics after this change:\n' +
                    diags.map(d => `- [${d.severity}] ${d.file}:${d.line}:${d.column} - ${d.message}`).join('\n');
                } else {
                  diagOutput = '\n\nAnalysis passed with 0 errors.';
                }
              } else if (this.rnService) {
                const isRN = await this.rnService.isReactNativeProject(projectPath);
                if (isRN) {
                  const diags = await this.rnService.analyze(projectPath);
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

            return `Proposed edit applied to ${path}.${diagOutput}`;
          }
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      },
    };

    const isComplex = !!(
      options.scaffoldMode || 
      (options.diagnostics && options.diagnostics.length > 0) ||
      options.previewError ||
      options.openFilePath ||
      /\b(create|add|implement|change|write|refactor|fix|composer|build|error|debug|inspect)\b/i.test(options.message)
    );

    try {
      await runAgentLoop(
        {
          provider: settings.apiProvider ?? 'openai',
          apiKey: settings.apiKey || (
            (settings.apiProvider === 'google') ? process.env.GOOGLE_API_KEY :
            (settings.apiProvider === 'anthropic') ? process.env.ANTHROPIC_API_KEY :
            process.env.OPENAI_API_KEY
          ) || '',
          model: settings.apiModel,
        },
        systemContext,
        messages.slice(1),
        executor,
        {
          onStatus: (message) => this.emitStream({ type: 'status', content: message }),
          onDelta: (text) => this.emitStream({ type: 'delta', content: text }),
          onError: (message) => this.emitStream({ type: 'error', content: message }),
          onDone: () => this.emitStream({ type: 'done', content: '' }),
        },
        signal,
        isComplex
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
