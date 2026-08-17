# CURSOR PARITY AUDIT: SYNKRO AGENT ARCHITECTURE & CAPABILITIES

> **Audit Type:** Read-Only Deep Technical Architecture & Feature Parity Audit  
> **Target Benchmark:** Cursor Agent (Composer & Chat) Experience  
> **Date:** August 2026  
> **Scope:** `packages/agent`, `apps/desktop`, `packages/shared`, `packages/platform-core`

---

## Executive Summary

Synkro has built a solid core foundation for an autonomous software engineering agent:
- High-level multi-framework detection (React Native/Expo, Flutter).
- Structured planning (`manage_plan`), acceptance criteria verification (`verify_criterion`), and automated recovery heuristics (`diagnostics.ts`).
- Robust cancellation mechanisms (killing child process trees on abort/timeout).
- Gateway abstraction with failover, auth token refresh, and local Gemini fallback.

However, when compared against the real-time, fluid experience of **Cursor Agent**, Synkro currently exhibits 10 key architectural gaps—most notably **block generation instead of token-by-token streaming in the orchestrator**, **a disconnected real-time activity timeline**, **lack of selected-code context**, **lack of partial/chunk file patching**, and **buffered command output**.

Below is the complete 35-point audit classification and technical breakdown.

---

## Capabilities Classification Matrix (35 Items)

| # | Capability | Status | Core File / Location |
|---|---|---|---|
| 1 | Agent lifecycle | ⚠️ PARTIAL | `agent-service.ts`, `orchestrator.ts`, `chat-store.ts` |
| 2 | Streaming | ⚠️ PARTIAL | `orchestrator.ts`, `production-gateway.ts` |
| 3 | Tool calling | ✅ COMPLETE | `definitions.ts`, `google-adapter.ts`, `backend-gateway.ts` |
| 4 | Tool execution | ✅ COMPLETE | `agent-service.ts` (16+ tools supported) |
| 5 | Real-time Activity Timeline | ⚠️ PARTIAL | `AgentTimeline.tsx`, `orchestrator.ts` |
| 6 | Stable activity IDs | ⚠️ PARTIAL | `orchestrator.ts`, `shared/src/index.ts` |
| 7 | runId / session handling | ⚠️ PARTIAL | `agent-service.ts`, `chat-store.ts` |
| 8 | Agent cancellation / Stop | ✅ COMPLETE | `agent-service.ts` (`AbortController`, `cancel()`) |
| 9 | Tool cancellation | ✅ COMPLETE | `agent-service.ts` (`activeToolProcesses`, `taskkill`) |
| 10 | Terminal process management | ⚠️ PARTIAL | `terminal-service.ts`, `agent-service.ts` |
| 11 | Tool timeout / retry | ✅ COMPLETE | `agent-service.ts` (120s timeout), `manage_plan` |
| 12 | Error recovery | ✅ COMPLETE | `error-recovery/diagnostics.ts` |
| 13 | Infinite-loop protection | ✅ COMPLETE | `orchestrator.ts` (`MAX_ITERATIONS = 50`), `maxRetries` |
| 14 | Workspace context | ✅ COMPLETE | `discovery.ts`, `builder.ts`, `indexer.ts` |
| 15 | Open-file context | ✅ COMPLETE | `builder.ts`, `agent-service.ts` |
| 16 | Selected-code context | ❌ MISSING | `EditorPane.tsx`, `ChatPane.tsx`, `builder.ts` |
| 17 | Conversation context | ⚠️ PARTIAL | `agent-service.ts`, `orchestrator.ts`, `chat-store.ts` |
| 18 | Context / token management | ⚠️ PARTIAL | `builder.ts`, `orchestrator.ts` |
| 19 | File search | ✅ COMPLETE | `file-search.ts`, `definitions.ts` |
| 20 | File reading | ✅ COMPLETE | `agent-service.ts`, `workspace-manager.ts` |
| 21 | Multi-file editing | ⚠️ PARTIAL | `definitions.ts`, `agent-service.ts` |
| 22 | Safe editing / conflict protection | ⚠️ PARTIAL | `agent-service.ts`, `workspace-manager.ts` |
| 23 | Diff / change tracking | ✅ COMPLETE | `diff` package, `GitDiffView.tsx`, `DiffViewer.tsx` |
| 24 | Undo / revert capabilities | ✅ COMPLETE | `agent-service.ts` (`rejectEdits`), `git-service.ts` |
| 25 | Planning | ✅ COMPLETE | `manage_plan`, `plan.json`, `plan.md` |
| 26 | Plan execution | ✅ COMPLETE | `manage_plan` (`update_step`, `retry_step`), IPC sync |
| 27 | Validation loop | ✅ COMPLETE | `validate_project`, `verify_criterion` |
| 28 | Test failure recovery | ✅ COMPLETE | `run_tests`, `diagnostics.ts` (`verification_failure`) |
| 29 | Terminal stdout/stderr streaming | ⚠️ PARTIAL | `agent-service.ts` (`run_command`) |
| 30 | Explorer real-time synchronization | ✅ COMPLETE | `workspace-manager.ts` (`chokidar`), `FileTree.tsx` |
| 31 | Editor synchronization | ⚠️ PARTIAL | `EditorPane.tsx`, `agent-service.ts` |
| 32 | Agent status UX | ⚠️ PARTIAL | `ChatPane.tsx`, `AgentTimeline.tsx`, `StatusBar.tsx` |
| 33 | Chat UX | ⚠️ PARTIAL | `ChatPane.tsx`, `ComposerOverlay.tsx` |
| 34 | Backend reliability | ✅ COMPLETE | `agent-service.ts`, `backend-gateway.ts`, auth refresh |
| 35 | Gemini / API error handling | ✅ COMPLETE | `google-adapter.ts`, `backend-gateway.ts` |

**Summary Counts:**
- **COMPLETE:** 18
- **PARTIAL:** 16
- **MISSING:** 1
- **UNKNOWN:** 0

---

## Detailed Gap Analysis (PARTIAL & MISSING Items)

### 1. Agent Lifecycle
- **Status:** ⚠️ PARTIAL
- **File / Path:** `apps/desktop/src/main/services/agent-service.ts`, `apps/desktop/src/renderer/src/stores/chat-store.ts`, `packages/agent/src/orchestrator.ts`
- **Current Implementation:** The lifecycle is handled via `isStreaming` (boolean) and `streamStatus` (string). Stream events emit `status`, `delta`, `error`, and `done`.
- **What's Missing:** An explicit, typed finite state machine (`uninitialized` → `idle` → `thinking` → `executing_tool` → `awaiting_confirmation` → `recovering` → `paused` → `cancelled` → `completed` → `failed`). State is currently inferred from informal string statuses.
- **Why It Matters:** Cursor drives distinct UI states, progress spinners, badge colors, and interactive buttons from a strict lifecycle state machine.
- **Recommended Implementation:** Introduce a `AgentLifecycleState` enum in `@peep/shared`, maintain active state in `AgentService`, and broadcast typed state transitions over IPC.

---

### 2. Streaming
- **Status:** ⚠️ PARTIAL
- **File / Path:** `packages/agent/src/orchestrator.ts` (lines 25-61, 158-167), `packages/agent/src/models/production-gateway.ts`, `packages/agent/src/models/google-adapter.ts`
- **Current Implementation:** Gateways implement `stream()`, but `runAgentLoop` calls `gateway.generate()` (a blocking request per turn). Text deltas and tool logs are only emitted in large chunks after generation finishes.
- **What's Missing:** True token-by-token streaming from the LLM during generation of conversational text and tool call arguments.
- **Why It Matters:** Cursor's instant visual responsiveness comes from streaming every token as it arrives. Waiting for full turn completion creates noticeable latency.
- **Recommended Implementation:** Update `callOpenAI` in `orchestrator.ts` to consume `gateway.stream()` via `AsyncIterable<AIStreamEvent>` and forward text deltas immediately to `callbacks.onDelta`.

---

### 5. Real-Time Activity Timeline
- **Status:** ⚠️ PARTIAL
- **File / Path:** `packages/agent/src/orchestrator.ts` (lines 145-220, 250-285), `apps/desktop/src/renderer/src/layout/AgentTimeline.tsx`
- **Current Implementation:** `AgentTimeline.tsx` exists in the renderer and listens to `AGENT_TIMELINE` IPC events. However, `orchestrator.ts` accumulates string HTML into `toolLogs` and dumps a static `<details>` block at the end of the run.
- **What's Missing:** Live dispatch of structured `AgentTimelineActivity` items (`type`, `status: 'in_progress' | 'completed' | 'failed'`, `file`, `command`, `timestamp`) as each tool starts and finishes.
- **Why It Matters:** In Cursor, users watch the agent sequentially read files, execute commands, and verify changes with live checkmarks and timers.
- **Recommended Implementation:** Add `onTimelineActivity: (activity: AgentTimelineActivity) => void` to `AgentCallbacks` in `orchestrator.ts`. Emit `in_progress` immediately before tool execution, and `completed`/`failed` upon return.

---

### 6. Stable Activity IDs
- **Status:** ⚠️ PARTIAL
- **File / Path:** `packages/agent/src/orchestrator.ts`, `packages/shared/src/index.ts`
- **Current Implementation:** `AgentTimelineActivity` defines `id: string`, and `chat-store.ts` contains `upsertTimelineActivity()`. But `orchestrator.ts` does not generate stable activity IDs.
- **What's Missing:** Generation of unique activity IDs per tool call or reasoning step that persist from start to finish.
- **Why It Matters:** Without stable IDs, the UI cannot update an in-progress step to completed or show execution duration for individual sub-tasks.
- **Recommended Implementation:** Assign `activityId = randomUUID()` for each tool call, emit with status `in_progress`, and update the same `activityId` with status `completed` / `failed` upon resolution.

---

### 7. runId / Session Handling
- **Status:** ⚠️ PARTIAL
- **File / Path:** `apps/desktop/src/main/services/agent-service.ts`, `apps/desktop/src/renderer/src/stores/chat-store.ts`
- **Current Implementation:** `chat-store.ts` checks `currentRunId` to clear stale timeline items, but `AgentService.send()` does not generate or pass a unique `runId` with IPC stream events. Chat sessions are stored only in volatile React/Zustand memory.
- **What's Missing:** Generation of `runId = randomUUID()` per prompt submission, tagging of all activities and logs with `runId`, and persistent multi-thread session storage in SQLite.
- **Why It Matters:** Cursor allows users to switch between chat tabs/sessions, view run history, and resume prior conversations across app restarts.
- **Recommended Implementation:** Add `runId` to `AgentSendOptions` and `AgentStreamEvent`. Store chat sessions and messages in `DatabaseService` (SQLite).

---

### 10. Terminal Process Management
- **Status:** ⚠️ PARTIAL
- **File / Path:** `apps/desktop/src/main/services/terminal-service.ts`, `apps/desktop/src/main/services/agent-service.ts`
- **Current Implementation:** `TerminalService` runs user-facing PTY shell sessions. `AgentService.execute('run_command')` uses an isolated `child_process.spawn()` instance that terminates after execution.
- **What's Missing:** Unified process visibility. Commands executed by the agent (such as starting a dev server or running tests) are not mirrored or interactive inside the terminal UI pane.
- **Why It Matters:** In Cursor, agent-executed commands appear in dedicated terminal tabs, allowing developers to view ANSI color logs, inspect server output, or send manual input.
- **Recommended Implementation:** Route agent commands through a designated "Agent Terminal" session managed by `TerminalService` so output streams directly to the terminal UI.

---

### 16. Selected-Code Context
- **Status:** ❌ MISSING
- **File / Path:** `apps/desktop/src/renderer/src/layout/EditorPane.tsx`, `apps/desktop/src/renderer/src/layout/ChatPane.tsx`, `packages/shared/src/index.ts`, `packages/agent/src/context/builder.ts`
- **Current Implementation:** `AgentSendOptions` only captures `openFilePath` and `openFileContent`. Editor selections are ignored.
- **What's Missing:** Capturing Monaco Editor cursor selections (`editor.getSelection()`, `editor.getModel()?.getValueInRange()`), passing `selection: { startLine, endLine, text }` in `AgentSendOptions`, and formatting `[SELECTED CODE (lines X-Y)]` into `buildAgentContext()`.
- **Why It Matters:** In Cursor, highlighting code and pressing `Cmd+L` or asking a question immediately targets the agent on the selected snippet, providing pinpoint context without parsing the entire file.
- **Recommended Implementation:** Hook into Monaco's `onDidChangeCursorSelection`, store active selection in `workspaceStore`, include it in `AgentSendOptions`, and render in `builder.ts`.

---

### 17. Conversation Context
- **Status:** ⚠️ PARTIAL
- **File / Path:** `apps/desktop/src/main/services/agent-service.ts`, `apps/desktop/src/renderer/src/stores/chat-store.ts`, `packages/agent/src/orchestrator.ts`
- **Current Implementation:** Previous user and assistant text messages are passed via `options.history`.
- **What's Missing:** Multi-turn tool call context. Intermediate tool calls (`tool_calls`) and tool execution outputs (`role: 'tool'`) from earlier conversational turns are dropped between user turns. Chat history is stored in memory and lost on restart.
- **Why It Matters:** If the user asks a follow-up question ("Why did that command fail earlier?"), the agent cannot inspect previous tool outputs unless they were preserved in the message history.
- **Recommended Implementation:** Store complete message history (including `tool_calls` and `tool` responses) in SQLite and inject full conversational turns into `runAgentLoop`.

---

### 18. Context / Token Management
- **Status:** ⚠️ PARTIAL
- **File / Path:** `packages/agent/src/context/builder.ts`, `packages/agent/src/orchestrator.ts`
- **Current Implementation:** Context is trimmed using hardcoded character slicing (`truncate(..., 3000)`, `content.slice(0, 12000)`).
- **What's Missing:** Tokenizer integration (e.g. tiktoken or model-specific BPE estimation), context budgeting per section (system prompt, project index, memory, open files, history), and dynamic history pruning or summarization when approaching context limits.
- **Why It Matters:** Large files or multi-turn conversations can exceed model context windows or cause severe reasoning degradation.
- **Recommended Implementation:** Implement token budgeting per component and a sliding-window message compressor that summarizes older conversation turns.

---

### 21. Multi-File Editing (Fast Patching vs Full Rewrite)
- **Status:** ⚠️ PARTIAL
- **File / Path:** `packages/agent/src/tools/definitions.ts`, `apps/desktop/src/main/services/agent-service.ts`
- **Current Implementation:** The agent can edit multiple files sequentially in one turn, but only via `propose_file_edit` which requires the full file content to be regenerated.
- **What's Missing:** Chunk / block / unified diff editing tools (`edit_file_block`, `patch_file`).
- **Why It Matters:** Full-file rewrites on 400+ line files are slow, consume excessive output tokens, and often lead to accidental omissions of existing methods. Cursor uses fast targeted chunk replacements.
- **Recommended Implementation:** Add a `patch_file` tool supporting `targetContent` / `replacementContent` or unified diff format for localized edits.

---

### 22. Safe Editing / Conflict Protection
- **Status:** ⚠️ PARTIAL
- **File / Path:** `apps/desktop/src/main/services/agent-service.ts`, `apps/desktop/src/main/services/workspace-manager.ts`
- **Current Implementation:** `propose_file_edit` writes directly to disk to enable hot-reloading in the simulator and stores `originalContent` for rollback.
- **What's Missing:** Conflict detection if the file was modified externally or in Monaco Editor while the agent was running.
- **Why It Matters:** If a user is typing in the editor while the agent runs, the agent's full-file write can overwrite the user's uncommitted work without warning.
- **Recommended Implementation:** Verify file hash / `mtime` before writing; if the file has changed since it was read, prompt the user or generate a 3-way merge conflict.

---

### 29. Terminal stdout/stderr Streaming
- **Status:** ⚠️ PARTIAL
- **File / Path:** `apps/desktop/src/main/services/agent-service.ts` (lines 365-401)
- **Current Implementation:** `run_command` buffers all stdout and stderr in memory until the child process exits or times out (120s).
- **What's Missing:** Real-time streaming of stdout/stderr chunks over IPC to the activity timeline or terminal panel while the command is executing.
- **Why It Matters:** During long commands (`npm install`, `flutter build`), the interface appears frozen with no live log feedback.
- **Recommended Implementation:** Emit `AGENT_COMMAND_OUTPUT` events on every `stdout.on('data')` chunk so the UI can render live logs inside the activity item.

---

### 31. Editor Synchronization
- **Status:** ⚠️ PARTIAL
- **File / Path:** `apps/desktop/src/renderer/src/layout/EditorPane.tsx`, `apps/desktop/src/main/services/agent-service.ts`
- **Current Implementation:** Specialized files (`.peep/plan.md`, `.peep/walkthrough.md`) trigger `workspace:open-file`. General code edits write to disk.
- **What's Missing:** Live synchronization with open Monaco Editor models. If a file is currently open in a tab, its Monaco buffer does not consistently update live with animated diff decorations without manual tab switching.
- **Why It Matters:** In Cursor, code changes stream directly into the active editor buffer with red/green inline diff decorations.
- **Recommended Implementation:** Dispatch a file update event to `workspaceStore` that calls `monaco.editor.getModel()?.setValue()` or applies edits via `applyEdits()` with Monaco diff markers.

---

### 32. Agent Status UX
- **Status:** ⚠️ PARTIAL
- **File / Path:** `apps/desktop/src/renderer/src/layout/ChatPane.tsx`, `apps/desktop/src/renderer/src/layout/AgentTimeline.tsx`, `apps/desktop/src/renderer/src/layout/StatusBar.tsx`
- **Current Implementation:** Basic text string `streamStatus` and an expandable `<details>` activity block at the end.
- **What's Missing:** A sticky live status bar / pill showing the active operation (e.g. `Reading lib/main.dart...`, `Running tests (4s)...`, `Applying 3 edits...`), step count, and elapsed time counter.
- **Why It Matters:** Provides immediate visual feedback and reassurance that the agent is actively making progress.
- **Recommended Implementation:** Implement a persistent agent status pill in `ChatPane` and `StatusBar` that reflects the active `AgentTimelineActivity`.

---

### 33. Chat UX
- **Status:** ⚠️ PARTIAL
- **File / Path:** `apps/desktop/src/renderer/src/layout/ChatPane.tsx`, `apps/desktop/src/renderer/src/features/chat/`
- **Current Implementation:** Markdown rendering via `ReactMarkdown`, model selection dropdown, changes review bar, and file mention support.
- **What's Missing:** Inline code block copy/apply buttons, per-hunk diff review cards inside chat messages, message edit/retry buttons, and persistent conversation thread tabs.
- **Why It Matters:** Cursor's chat is an interactive workbench where code blocks can be applied with one click and individual diff hunks can be accepted or rejected.
- **Recommended Implementation:** Add code action toolbars to code blocks, render interactive `ProposedEditCard` components inline within messages, and support message editing with branch forks.

---

## Top 10 Gaps to Achieve Cursor Parity

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                             TOP 10 CURSOR PARITY GAPS IN SYNKRO                             │
├─────┬──────────────────────────────────────────┬────────────────────────────────────────────┤
│  #  │ Gap Name                                 │ Impact on User Experience                  │
├─────┼──────────────────────────────────────────┼────────────────────────────────────────────┤
│  1  │ Real-Time Token Streaming in Orchestrator│ High latency; responses arrive in blocks. │
│  2  │ Disconnected Real-Time Activity Timeline │ Timeline does not animate steps live.      │
│  3  │ Selected-Code Context (@selection)       │ Cannot prompt on highlighted code snippets.│
│  4  │ Fast Chunk/Patch Editing (`patch_file`)  │ Slow rewrites & truncation on large files. │
│  5  │ Real-Time Command Output Streaming       │ UI feels frozen during lengthy commands.   │
│  6  │ Live Editor Model & Inline Diff Sync     │ Open editor tabs don't show live diffs.    │
│  7  │ Multi-Turn Tool Call & History Retention │ Agent forgets previous turn tool outputs.  │
│  8  │ Token Budgeting & Dynamic Pruning        │ Risk of context overflows on large tasks.  │
│  9  │ Concurrent File Modification Protection  │ Risk of overwriting unsaved user edits.    │
│ 10  │ Interactive In-Chat Diff & Hunk Actions  │ Cannot accept/reject edits per hunk/file.  │
└─────┴──────────────────────────────────────────┴────────────────────────────────────────────┘
```

---

## Conclusion & Architecture Roadmap

Synkro has successfully implemented the hardest backend capabilities: multi-framework project discovery, platform runtime management, safety classification, plan-based self-healing, and multi-provider failover. 

By closing the **Top 10 Gaps**—primarily connecting the existing `AgentTimeline` UI to real-time orchestrator events, enabling token streaming in `runAgentLoop`, introducing partial file patching, and capturing editor selections—Synkro will achieve full feature and UX parity with Cursor Agent.
