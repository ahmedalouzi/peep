import { randomUUID } from 'node:crypto';
import { join, isAbsolute, normalize } from 'node:path';
import { unlink, rename as fsRename } from 'node:fs/promises';
// @ts-ignore - TS cache issue with export
import { discoverProjectContext } from '@peep/agent';
import { spawn } from 'node:child_process';
import type { BrowserWindow } from 'electron';
import { IPC_EVENTS } from '@peep/shared';
import type { ProposedEdit, AgentStreamEvent, AgentSendOptions } from '@peep/shared';
import { buildAgentContext, runAgentLoop, SCAFFOLD_SYSTEM_ADDENDUM, type ChatMessage, classifyCommand, loadDesignManifest, saveDesignManifest, serializeDesignManifest, ProductionAIGateway, MockAIGateway, GoogleGeminiAdapter } from '@peep/agent';
import type { DatabaseService } from './db';
import type { WorkspaceManager } from './workspace-manager';
import { searchFiles } from './file-search';
import { searchContent } from './content-search';

const RN_SYSTEM_ADDENDUM = `
This is a React Native / Expo project.
Key rules:
- **PLANNING**: For multi-step software engineering requests (such as creating projects, installing packages, building features across files, or complex refactoring), you MUST first initialize a structured task plan using \`manage_plan\` (action: "init"). Do NOT create a plan for simple single-step requests (such as "explain this file", "rename a variable", or a single conversation question). All plan updates must go through \`manage_plan\`. As you execute tools, call \`manage_plan\` (action: "update_step") to transition step statuses (pending -> in_progress -> completed | failed). If a step fails, call \`manage_plan\` with action: "update_step" and status: "failed". You MAY retry a failed step by calling \`manage_plan\` (action: "retry_step").
- **DETERMINISTIC COMPLETION**: You MUST NOT declare a task completed if any required step in the plan remains in "pending", "in_progress", or "failed" status. Completion is only valid when all required steps are marked "completed".
- **AUTONOMY**: On receiving a multi-step prompt, immediately initialize the plan using \`manage_plan\` and continue executing all tools required to complete the steps autonomously. You have full authority to execute ALL edits, run terminal commands, compile/typecheck, and self-correct diagnostics. Do not pause unnecessarily once a plan is active.
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

import { ProjectIndexer, ProjectRetrieval, MemoryManager, MemoryRetrieval } from '@peep/agent';
import type { PlatformRegistry } from './platform-registry';

export class AgentService {
  private pendingEdits: ProposedEdit[] = [];
  private abortController: AbortController | null = null;
  private mainWindow: BrowserWindow | null = null;
  private indexers: Map<string, ProjectIndexer> = new Map();
  private memoryManagers: Map<string, MemoryManager> = new Map();
  private activeToolProcesses = new Set<any>();

  constructor(
    private db: DatabaseService,
    private workspace: WorkspaceManager,
    private registry: PlatformRegistry,
  ) {}

  async onFileChanged(projectPath: string, event: 'add' | 'change' | 'unlink', path: string): Promise<void> {
    const indexer = this.indexers.get(projectPath);
    if (!indexer) return;
    
    if (event === 'unlink') {
      await indexer.removeFile(path);
    } else {
      await indexer.updateFile(path, true);
    }
  }

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

  }

  cancel(): void {
    this.abortController?.abort();
    this.abortController = null;

    for (const child of this.activeToolProcesses) {
      const pid = child.pid;
      if (pid) {
        if (process.platform === 'win32') {
          try {
            const { exec } = require('node:child_process');
            exec(`taskkill /pid ${pid} /f /t`);
          } catch {}
        } else {
          try {
            child.kill('SIGKILL');
          } catch {}
        }
      }
    }
    this.activeToolProcesses.clear();
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

    this.cancel();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    // ── Platform-aware context ──────────────────────────────────────────────
    let isReactNative = false;
    let pubspec: string | undefined;
    let mainDart: string | undefined;
    let packageJson: string | undefined;
    let appEntry: string | undefined;
    let providerContextStr = '';
    let mobileEnv: any = null;

    if (projectPath) {
      const detectResult = await this.registry.detect(projectPath);
      const provider = detectResult.provider;
      
      if (provider) {
        mobileEnv = provider.env;
        isReactNative = mobileEnv.framework === 'react-native';
        providerContextStr = await provider.getAgentContext(projectPath);

        if (isReactNative) {
          packageJson = await this.workspace.readFile(join(projectPath, 'package.json')).catch(() => undefined);
          appEntry = await this.workspace.readFile(join(projectPath, 'App.tsx')).catch(() =>
            this.workspace.readFile(join(projectPath, 'App.js')).catch(() => undefined)
          );
        } else {
          pubspec = await this.workspace.readFile(join(projectPath, 'pubspec.yaml')).catch(() => undefined);
          mainDart = await this.workspace.readFile(join(projectPath, 'lib', 'main.dart')).catch(() => undefined);
        }
      } else {
        // Fallback for unknown
        const fullText = (options.history?.map(h => h.content).join(' ') || '') + ' ' + options.message;
        isReactNative = !fullText.toLowerCase().includes('flutter');
      }
    }

    const treeSummary = projectPath ? await this.buildTreeSummary(projectPath) : '';

    let intelligenceContext = '';
    let memoryContext = '';
    
    console.log(`[E2E_VERIFICATION] 1. Chat UI -> IPC -> AgentService (Message: "${options.message}")`);

    if (projectPath) {
      console.log(`[E2E_VERIFICATION] 2. Executing Context Discovery...`);
      let indexer = this.indexers.get(projectPath);
      if (!indexer) {
        indexer = new ProjectIndexer(projectPath, isReactNative ? 'react-native' : 'flutter');
        this.indexers.set(projectPath, indexer);
        const loaded = await indexer.loadIndex();
        if (!loaded) {
          await indexer.fullIndex();
        }
      }
      
      console.log(`[E2E_VERIFICATION] 3. Querying Project Index...`);
      const retrieval = new ProjectRetrieval(indexer.getIndex(), projectPath);
      const retrievalResult = retrieval.retrieveRelevantContext(options.message);
      intelligenceContext = '\n\n' + retrievalResult.summary;

      console.log(`[E2E_VERIFICATION] 4. Loading Memory Engine...`);
      let memoryManager = this.memoryManagers.get(projectPath);
      if (!memoryManager) {
        memoryManager = new MemoryManager(projectPath);
        await memoryManager.loadMemory();
        this.memoryManagers.set(projectPath, memoryManager);
      }
      const memoryRetrieval = new MemoryRetrieval(memoryManager.getStore());
      const relevantMemory = memoryRetrieval.retrieveRelevantMemory(options.message);
      if (relevantMemory) {
        memoryContext = '\n\n' + relevantMemory;
      }
    }

    // Load Design Manifest if it exists — inject into AI context for all UI tasks
    let designManifestContext = '';
    if (projectPath) {
      const designManifest = await loadDesignManifest(projectPath);
      if (designManifest) {
        designManifestContext = '\n\n' + serializeDesignManifest(designManifest) + '\n\n';
      }
    }

    let providerDetails = '';
    if (mobileEnv) {
      providerDetails = `\n\n[ENVIRONMENT CAPABILITIES]\n\`\`\`json\n${JSON.stringify(mobileEnv, null, 2)}\n\`\`\`\n\n[FRAMEWORK CONTEXT]\n${providerContextStr}\n`;
    }

    const rnAddendum = isReactNative ? RN_SYSTEM_ADDENDUM : '';
      console.log(`[E2E_VERIFICATION] 5. Building System Prompt...`);
      const systemContext =
        (options.scaffoldMode ? `${SCAFFOLD_SYSTEM_ADDENDUM}\n\n` : '') +
        `\n[ACTIVE PROJECT ROOT]\n${projectPath ? (await this.registry.detect(projectPath)).projectRoot : 'None'}\n` +
        rnAddendum +
        providerDetails +
        intelligenceContext +
        memoryContext +
        designManifestContext +
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

    console.log(`[E2E_VERIFICATION] 5. System Prompt Built (Size: ${systemContext.length} chars)`);

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
        console.log(`[E2E_VERIFICATION] 7. Tool Execution Requested by LLM: ${name}`);
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
            const safety = classifyCommand(commandStr);

            if (safety.level === 'blocked') {
              return `BLOCKED: ${safety.reason}`;
            }

            if (safety.level === 'dangerous') {
              // Send a confirmation request to the renderer and wait for response
              const confirmId = randomUUID();
              const confirmed = await new Promise<boolean>((resolve) => {
                // Emit confirmation request to renderer
                this.mainWindow?.webContents.send('agent:confirm-command', {
                  id: confirmId,
                  command: commandStr,
                  reason: safety.reason,
                });

                // Register one-time listener on ipcMain for the response
                const { ipcMain } = require('electron');
                ipcMain.once(`agent:confirm-command-response:${confirmId}`, (_: unknown, approved: boolean) => {
                  resolve(approved);
                });

                // Auto-reject after 60s
                setTimeout(() => resolve(false), 60000);
              });

              if (!confirmed) {
                return `Command was rejected by user: ${commandStr}`;
              }
            }

            return new Promise<string>((resolve) => {
              const shell = process.platform === 'win32';
              const child = spawn(commandStr, {
                cwd: projectPath,
                shell,
                env: process.env,
              });
              this.activeToolProcesses.add(child);

              let stdout = '';
              let stderr = '';

              child.stdout?.on('data', (chunk) => {
                stdout += chunk.toString();
              });
              child.stderr?.on('data', (chunk) => {
                stderr += chunk.toString();
              });

              const timeout = setTimeout(() => {
                this.activeToolProcesses.delete(child);
                child.kill();
                resolve(`Command timed out after 120s.\nStdout:\n${stdout}\nStderr:\n${stderr}`);
              }, 120000);

              child.on('close', (code) => {
                this.activeToolProcesses.delete(child);
                clearTimeout(timeout);
                resolve(`Command exited with code ${code}.\nStdout:\n${stdout}\nStderr:\n${stderr}`);
              });

              child.on('error', (err) => {
                this.activeToolProcesses.delete(child);
                clearTimeout(timeout);
                resolve(`Command execution error: ${err.message}\nStdout:\n${stdout}\nStderr:\n${stderr}`);
              });
            });
          }
          case 'delete_file': {
            const path = this.resolvePath(projectPath, String(args.path));
            // Always require user confirmation for file deletion
            const confirmId = randomUUID();
            const confirmed = await new Promise<boolean>((resolve) => {
              this.mainWindow?.webContents.send('agent:confirm-command', {
                id: confirmId,
                command: `DELETE FILE: ${args.path}`,
                reason: `The agent wants to delete ${args.path}. Reason: ${args.reason || 'Not specified'}`,
              });
              const { ipcMain } = require('electron');
              ipcMain.once(`agent:confirm-command-response:${confirmId}`, (_: unknown, approved: boolean) => {
                resolve(approved);
              });
              setTimeout(() => resolve(false), 60000);
            });
            if (!confirmed) return `File deletion rejected by user: ${args.path}`;
            await unlink(path);
            return `Deleted: ${args.path}`;
          }
          case 'rename_file': {
            const oldPath = this.resolvePath(projectPath, String(args.oldPath));
            const newPath = this.resolvePath(projectPath, String(args.newPath));
            await fsRename(oldPath, newPath);
            return `Renamed: ${args.oldPath} → ${args.newPath}`;
          }
          case 'update_design_manifest': {
            const incoming = args.manifest as any;
            const existing = (await loadDesignManifest(projectPath) ?? {}) as any;
            // Merge deeply, with the AI's incoming manifest winning over existing fields.
            const merged = {
              ...existing,
              ...incoming,
              colors: { ...(existing.colors ?? {}), ...(incoming.colors ?? {}) },
              typography: { ...(existing.typography ?? {}), ...(incoming.typography ?? {}) },
              spacing: { ...(existing.spacing ?? {}), ...(incoming.spacing ?? {}) },
              borderRadius: { ...(existing.borderRadius ?? {}), ...(incoming.borderRadius ?? {}) },
              elevation: { ...(existing.elevation ?? {}), ...(incoming.elevation ?? {}) },
              buttons: { ...(existing.buttons ?? {}), ...(incoming.buttons ?? {}) },
              generatedAt: existing?.generatedAt ?? new Date().toISOString(),
              lastUpdatedAt: new Date().toISOString(),
              version: (existing?.version ?? 0) + 1,
            } as any;
            await saveDesignManifest(projectPath, merged);
            return `Design Manifest saved to .peep/design.json (v${merged.version}).`;
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

            return `Proposed edit applied to ${path}.`;
          }
          case 'manage_plan': {
            const jsonPath = this.resolvePath(projectPath, '.peep/plan.json');
            const mdPath = this.resolvePath(projectPath, '.peep/plan.md');
            let plan: any = { taskId: '', goal: '', complexity: 'medium', steps: [], status: 'in_progress' };
            try {
              const content = await this.workspace.readFile(jsonPath);
              plan = JSON.parse(content);
            } catch {
              // Ignore, start fresh
            }

            if (args.action === 'init') {
              plan = {
                taskId: randomUUID(),
                goal: args.goal || 'Software Engineering Task',
                complexity: args.complexity || 'medium',
                steps: (Array.isArray(args.steps) ? (args.steps as any[]) : []).map((s: any) => ({
                  id: String(s.id),
                  description: String(s.description),
                  status: (s.status || 'pending') as any,
                  attempts: 1,
                  required: s.required !== false,
                  relevantFiles: Array.isArray(s.relevantFiles) ? s.relevantFiles.map(String) : undefined,
                  impactRadius: Array.isArray(s.impactRadius) ? s.impactRadius.map(String) : undefined
                })),
                acceptanceCriteria: (Array.isArray(args.acceptanceCriteria) ? (args.acceptanceCriteria as any[]) : []).map((c: any) => ({
                  id: String(c.id),
                  description: String(c.description),
                  status: (c.status || 'pending') as any,
                  verificationMethod: String(c.verificationMethod),
                  linkedStepIds: Array.isArray(c.linkedStepIds) ? c.linkedStepIds.map(String) : undefined
                })),
                status: 'in_progress',
                updatedAt: new Date().toISOString()
              };
            } else if (args.action === 'update_step') {
              const step = plan.steps.find((s: any) => s.id === args.stepId);
              if (step) {
                step.status = args.status;
                if (args.error) step.lastError = String(args.error);
              }
            } else if (args.action === 'retry_step') {
              const step = plan.steps.find((s: any) => s.id === args.stepId);
              if (step) {
                const currentAttempts = (step.attempts || 1) + 1;
                const maxRetries = step.maxRetries || 3;
                if (currentAttempts > maxRetries) {
                  step.status = 'failed';
                  step.lastError = `Max retry limit (${maxRetries}) exhausted. Strategy failed.`;
                } else {
                  step.status = 'in_progress';
                  step.attempts = currentAttempts;
                  if (args.error) step.lastError = String(args.error);
                  if (args.strategy) step.currentStrategy = String(args.strategy);
                }
              }
            } else if (args.action === 'record_recovery') {
              const step = plan.steps.find((s: any) => s.id === args.stepId);
              if (step) {
                step.history = step.history || [];
                step.history.push({
                  attempt: args.attempt || step.attempts || 1,
                  strategy: args.strategy || 'unknown',
                  error: args.error || { message: 'Tool execution error' },
                  status: args.recoveryStatus || 'pending',
                  timestamp: new Date().toISOString()
                });
              }
            } else if (args.action === 'add_step') {
              const st = args.step as any;
              if (st) {
                plan.steps.push({
                  id: String(st.id),
                  description: String(st.description),
                  status: (st.status || 'pending') as any,
                  attempts: 1,
                  maxRetries: st.maxRetries || 3,
                  required: st.required !== false,
                  relevantFiles: Array.isArray(st.relevantFiles) ? st.relevantFiles.map(String) : undefined,
                  impactRadius: Array.isArray(st.impactRadius) ? st.impactRadius.map(String) : undefined
                });
              }
            } else if (args.action === 'remove_step') {
              plan.steps = plan.steps.filter((s: any) => s.id !== args.stepId);
            }

            // Calculate overall plan status deterministically
            let hasFailed = plan.steps.some((s: any) => s.status === 'failed' && s.required !== false);
            let allCompleted = plan.steps.length > 0 && plan.steps.every((s: any) => s.status === 'completed' || s.required === false);
            
            // Phase 4: Enforce Acceptance Criteria validation
            if (Array.isArray(plan.acceptanceCriteria) && plan.acceptanceCriteria.length > 0) {
              const unverifiedCriteria = plan.acceptanceCriteria.filter((c: any) => c.status !== 'verified');
              if (unverifiedCriteria.length > 0) {
                allCompleted = false;
                if (unverifiedCriteria.some((c: any) => c.status === 'failed')) {
                  hasFailed = true;
                }
              }
            }

            if (hasFailed) {
              plan.status = 'failed';
            } else if (allCompleted) {
              plan.status = 'completed';
            } else {
              plan.status = 'in_progress';
            }
            plan.updatedAt = new Date().toISOString();

            await this.workspace.mkdir(this.resolvePath(projectPath, '.peep'), { recursive: true }).catch(() => {});
            await this.workspace.writeFile(jsonPath, JSON.stringify(plan, null, 2));

            // Format markdown checklist for .peep/plan.md
            let md = `# Plan: ${plan.goal || 'Execution Plan'}\n\n`;
            if (plan.complexity) md += `*Complexity:* ${String(plan.complexity).toUpperCase()}\n\n`;
            
            if (Array.isArray(plan.acceptanceCriteria) && plan.acceptanceCriteria.length > 0) {
              md += `## Acceptance Criteria\n`;
              for (const crit of plan.acceptanceCriteria) {
                let check = '[ ]';
                if (crit.status === 'verified') check = '[x]';
                else if (crit.status === 'failed') check = '[!]';
                else if (crit.status === 'not_verifiable') check = '[-]';
                else if (crit.status === 'verifying') check = '[/]';
                md += `- ${check} ${crit.description} *(Method: ${crit.verificationMethod})*\n`;
              }
              md += `\n`;
            }

            md += `## Steps\n`;
            if (Array.isArray(plan.steps)) {
              for (const step of plan.steps) {
                let check = '[ ]';
                if (step.status === 'completed') check = '[x]';
                else if (step.status === 'in_progress') check = '[/]';
                else if (step.status === 'failed') check = '[!]';

                let line = `- ${check} ${step.description}`;
                if (step.currentStrategy) {
                  line += ` *(Strategy: ${step.currentStrategy})*`;
                }
                if (step.attempts && step.attempts > 1) {
                  line += ` *(Attempts: ${step.attempts}/${step.maxRetries || 3})*`;
                }
                if (step.status === 'failed' && step.lastError) {
                  line += ` — **Error:** ${step.lastError}`;
                }
                md += `${line}\n`;
              }
            }
            await this.workspace.writeFile(mdPath, md);

            this.mainWindow?.webContents.send('workspace:plan-updated', plan);

            return `Plan successfully updated. Canonical plan state: ${JSON.stringify(plan)}`;
          }
          case 'verify_criterion': {
            const jsonPath = this.resolvePath(projectPath, '.peep/plan.json');
            let plan: any = null;
            try {
              plan = JSON.parse(await this.workspace.readFile(jsonPath));
            } catch {
              return 'Error: Could not read .peep/plan.json. Ensure plan is initialized.';
            }

            if (!plan.acceptanceCriteria || !Array.isArray(plan.acceptanceCriteria)) {
              return 'Error: No acceptance criteria found in plan.';
            }

            const criterion = plan.acceptanceCriteria.find((c: any) => c.id === args.criterionId);
            if (!criterion) {
              return `Error: Criterion ID ${args.criterionId} not found.`;
            }

            criterion.status = args.status;
            criterion.history = criterion.history || [];
            criterion.history.push({
              status: args.status,
              verificationMethod: args.verificationMethod,
              commandOrAction: args.commandOrAction,
              outputSummary: args.outputSummary,
              timestamp: new Date().toISOString(),
              evidence: args.evidence
            });

            // If a criterion fails, and we are tracking step failure, the agent should handle recovery via manage_plan.
            
            await this.workspace.writeFile(jsonPath, JSON.stringify(plan, null, 2));
            this.mainWindow?.webContents.send('workspace:plan-updated', plan);

            return `Criterion ${args.criterionId} verified as ${args.status}. Evidence recorded.`;
          }
          case 'manage_memory': {
            let memoryManager = this.memoryManagers.get(projectPath);
            if (!memoryManager) {
              memoryManager = new MemoryManager(projectPath);
              await memoryManager.loadMemory();
              this.memoryManagers.set(projectPath, memoryManager);
            }

            if (args.action === 'read') {
              return JSON.stringify(memoryManager.getStore().entries, null, 2);
            } else if (args.action === 'add') {
              if (!args.category || !args.key || !args.value) return 'Error: category, key, and value are required for add.';
              return await memoryManager.addMemory(args.category as any, String(args.key), String(args.value));
            } else if (args.action === 'update') {
              if (!args.key || !args.value) return 'Error: key and value are required for update.';
              return await memoryManager.updateMemory(String(args.key), String(args.value));
            } else if (args.action === 'remove') {
              if (!args.key) return 'Error: key is required for remove.';
              return await memoryManager.removeMemory(String(args.key));
            }
            return 'Invalid memory action.';
          }
          case 'validate_project': {
            if (!projectPath) {
              return JSON.stringify({
                success: false,
                framework: 'unknown',
                environment: 'unknown',
                checks: [],
                blockingErrors: 1,
                warnings: 0,
                errorCategory: 'environment_error',
                message: 'No project path specified for validation.'
              });
            }

            const detection = await this.registry.detect(projectPath);
            if (!detection.provider) {
              return JSON.stringify({
                success: false,
                framework: 'unknown',
                environment: 'unknown',
                checks: [],
                blockingErrors: 1,
                warnings: 0,
                errorCategory: 'environment_error',
                message: 'Could not detect framework provider for this project.'
              });
            }

            try {
              const result = await detection.provider.validateProject(detection.projectRoot);
              return JSON.stringify(result, null, 2);
            } catch (error: any) {
              return JSON.stringify({
                success: false,
                framework: detection.provider.id.includes('flutter') ? 'flutter' : 'react-native',
                environment: detection.provider.id.includes('local') ? 'local' : 'managed',
                checks: [{
                  type: 'validation',
                  success: false,
                  exitCode: 1,
                  stdout: '',
                  stderr: error.message || String(error)
                }],
                blockingErrors: 1,
                warnings: 0,
                errorCategory: 'unknown_error',
                message: `Validation failed with exception: ${error.message || String(error)}`
              });
            }
          }
          case 'bootstrap_project': {
            if (!projectPath) return 'Error: No project path specified.';
            const detection = await this.registry.detect(projectPath);
            if (!detection.provider) return 'Error: Could not detect framework provider.';
            const result = await detection.provider.bootstrapProject(detection.projectRoot, args as any);
            
            // Re-trigger Project Intelligence Indexing upon bootstrap
            const indexer = this.indexers.get(detection.projectRoot);
            if (indexer) {
              await indexer.fullIndex();
            }

            return JSON.stringify(result, null, 2);
          }
          case 'install_dependencies': {
            if (!projectPath) return 'Error: No project path specified.';
            const detection = await this.registry.detect(projectPath);
            if (!detection.provider) return 'Error: Could not detect framework provider.';
            const result = await detection.provider.installDependencies(detection.projectRoot, args.packages as string[]);
            
            // Trigger incremental indexing update
            const indexer = this.indexers.get(detection.projectRoot);
            if (indexer) {
              await indexer.fullIndex();
            }

            return JSON.stringify(result, null, 2);
          }
          case 'build_project': {
            if (!projectPath) return 'Error: No project path specified.';
            const detection = await this.registry.detect(projectPath);
            if (!detection.provider) return 'Error: Could not detect framework provider.';
            const result = await detection.provider.buildProject(detection.projectRoot, String(args.platform));
            return JSON.stringify(result, null, 2);
          }
          case 'run_tests': {
            if (!projectPath) return 'Error: No project path specified.';
            const detection = await this.registry.detect(projectPath);
            if (!detection.provider) return 'Error: Could not detect framework provider.';
            const result = await detection.provider.runTests(detection.projectRoot);
            return JSON.stringify(result, null, 2);
          }
          case 'start_app': {
            if (!projectPath) return 'Error: No project path specified.';
            const detection = await this.registry.detect(projectPath);
            if (!detection.provider) return 'Error: Could not detect framework provider.';
            const result = await detection.provider.startApplication(detection.projectRoot);
            return JSON.stringify(result, null, 2);
          }
          case 'stop_app': {
            if (!projectPath) return 'Error: No project path specified.';
            const detection = await this.registry.detect(projectPath);
            if (!detection.provider) return 'Error: Could not detect framework provider.';
            const success = await detection.provider.stopApplication(Number(args.processId));
            return JSON.stringify({ success });
          }
          case 'get_process_status': {
            if (!projectPath) return 'Error: No project path specified.';
            const detection = await this.registry.detect(projectPath);
            if (!detection.provider) return 'Error: Could not detect framework provider.';
            const result = await detection.provider.getApplicationStatus(Number(args.processId));
            return JSON.stringify(result, null, 2);
          }
          case 'get_runtime_logs': {
            if (!projectPath) return 'Error: No project path specified.';
            const detection = await this.registry.detect(projectPath);
            if (!detection.provider) return 'Error: Could not detect framework provider.';
            const result = await detection.provider.getRuntimeLogs(Number(args.processId));
            return JSON.stringify(result, null, 2);
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
      const GATEWAY_BASE_URL = settings.gatewayUrl || process.env.SYNKRO_GATEWAY_URL || 'https://api.synkro.com';
      console.log(`[AGENT_DEBUG] sessionToken present: ${!!settings.sessionToken}`);

      let gateway: any;

      if (process.env.SYNKRO_USE_MOCK_GATEWAY === 'true') {
        console.log(`[AGENT_DEBUG] Using MockAIGateway (Explicitly Enabled)`);
        gateway = new MockAIGateway();
      } else if (settings.sessionToken && settings.sessionToken !== 'dev_test_session') {
        gateway = new ProductionAIGateway({ 
            baseUrl: GATEWAY_BASE_URL, 
            sessionToken: settings.sessionToken,
            refreshToken: settings.refreshToken,
            onTokensUpdated: async (newSession, newRefresh) => {
              if (newSession === '' && newRefresh === '') {
                await this.db.setSettings({ sessionToken: '', refreshToken: '' });
                this.emitStream({ type: 'error', content: 'Session expired or not signed in. Please sign in via Settings → Account.' });
                this.abortController?.abort();
              } else {
                await this.db.setSettings({ sessionToken: newSession, refreshToken: newRefresh });
                settings.sessionToken = newSession;
                settings.refreshToken = newRefresh;
              }
            }
        });
      } else {
        // Fallback to local AI Provider for development without SaaS session
        const providerName = settings.aiProvider || 'gemini';
        const localKey = settings.aiProviderApiKey || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
        
        if (localKey) {
          if (providerName === 'gemini') {
            console.log(`[AGENT_DEBUG] Using Local GoogleGeminiAdapter`);
            gateway = new GoogleGeminiAdapter(localKey);
          } else {
            this.emitStream({ type: 'error', content: `AUTH_REQUIRED: The selected local provider '${providerName}' is not yet supported in the desktop build.` });
            return;
          }
        } else {
          this.emitStream({ type: 'error', content: 'AUTH_REQUIRED: You must sign in via Settings, or configure a Local AI Provider API Key.' });
          return;
        }
      }

      console.log(`[E2E_VERIFICATION] 6. Gateway Selected: ${gateway.constructor?.name || 'AIGateway'} — Initializing Orchestrator Loop`);

      const executeRunLoop = async (selectedGw: any) => {
        await runAgentLoop(
          {
            capabilityTier: settings.capabilityTier || 'fast',
            gateway: selectedGw,
            sessionToken: settings.sessionToken || 'dev_test_session',
          },
          systemContext,
          messages.slice(1),
          executor,
          {
            onStatus: (message) => this.emitStream({ type: 'status', content: message }),
            onDelta: (text) => this.emitStream({ type: 'delta', content: text }),
            onError: (message) => {
              const errStr = (message as any) instanceof Error 
                ? (message as any).message 
                : (typeof message === 'object' && message !== null ? (message.message || message.code || JSON.stringify(message)) : String(message));
              this.emitStream({ type: 'error', content: errStr });
            },
            onDone: () => {
               console.log(`[E2E_VERIFICATION] 8. Final stream completed.`);
               this.emitStream({ type: 'done', content: '' })
            },
          },
          signal,
          isComplex
        );
      };

      try {
        await executeRunLoop(gateway);
      } catch (loopErr: any) {
        const errCode = loopErr?.code || loopErr?.name || '';
        const errMsg = loopErr?.message || String(loopErr);
        const isNetworkFail = errCode === 'NETWORK_FAILURE' || errMsg.includes('fetch failed') || errMsg.includes('NETWORK_FAILURE');

        // Automatic fallback to local Gemini adapter in dev mode if remote gateway endpoint is not running locally
        if (isNetworkFail && gateway.constructor?.name === 'ProductionAIGateway') {
          const geminiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
          if (geminiKey) {
            console.warn(`[AgentService] ProductionAIGateway fetch failed at ${GATEWAY_BASE_URL}. Falling back to local GoogleGeminiAdapter.`);
            this.emitStream({ type: 'status', content: 'Remote AI Gateway unreachable. Switching to local LLM...' });
            await executeRunLoop(new GoogleGeminiAdapter(geminiKey));
            return;
          } else {
            console.warn(`[AgentService] ProductionAIGateway fetch failed and no local API key found.`);
          }
        }
        throw loopErr;
      }
    } catch (error: any) {
      if (signal.aborted) {
        this.emitStream({ type: 'error', content: 'Cancelled' });
        return;
      }
      const rawMessage = error instanceof Error 
        ? error.message 
        : (typeof error === 'object' && error !== null ? (error.message || error.code || JSON.stringify(error)) : String(error));
      
      console.error('[AgentService] Request failed:', error);
      
      const isAuthError = /UNAUTHORIZED|FORBIDDEN|401|403|session|expired|revoked/i.test(rawMessage);
      if (isAuthError) {
        void this.db.setSettings({ sessionToken: '', refreshToken: '' }).then(() => {
          this.mainWindow?.webContents.send(IPC_EVENTS.AUTH_SESSION_EXPIRED);
        });
        this.emitStream({ type: 'error', content: 'AUTH_REQUIRED: Your authentication session has expired or is invalid. Please sign in again.' });
      } else if (rawMessage.includes('fetch failed') || rawMessage.includes('NETWORK_FAILURE')) {
        this.emitStream({ 
          type: 'error', 
          content: `Unable to connect to AI Gateway. Please check your network connection or configure your Gateway URL in Settings.` 
        });
      } else {
        this.emitStream({ type: 'error', content: rawMessage });
      }
    } finally {
      this.abortController = null;
    }
  }
}
