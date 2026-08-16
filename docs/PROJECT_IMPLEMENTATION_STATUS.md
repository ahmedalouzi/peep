# Synkro - Project Implementation Status

## 1. Executive Summary

Synkro currently implements a full AI-driven conversational and workspace agent pipeline, enabling framework detection, timeline tracking of AI activities, IPC-based architecture for communicating between renderer and main processes, and robust filesystem synchronization with a local file watcher. It supports project creation, specifically with capabilities tuned to Node.js applications and React Native managed workflows (Expo), while maintaining accurate explorer trees with duplicate protection.

## 2. Completed Features

- [x] **Agent / AI pipeline**
  - Implemented the core adapter pipeline to interface with LLM endpoints (Gemini).
  - *Files*: `packages/agent/src/models/backend-gateway.ts`, `packages/agent/src/models/google-adapter.ts`
  - *Verification status*: Verified via internal test suite.

- [x] **Agent Activity Timeline & UI Tracking**
  - Added support for timeline tracking UI components that keep stable activity IDs when transitioning from `in_progress` to `completed` or `failed`.
  - *Files*: `apps/desktop/src/renderer/src/stores/chat-store.ts`, `apps/desktop/src/renderer/src/stores/workspace-store.ts`, `apps/desktop/src/renderer/src/features/plan/PlanViewer.tsx`
  - *Verification status*: Tested via renderer UI flow.

- [x] **Conversational handling & Request Classification**
  - Differentiating between conversational requests (which should not execute tools) and coding requests.
  - *Files*: `packages/agent/src/models/auth-router.ts`, `apps/desktop/src/main/services/agent-service.ts`

- [x] **Filesystem Synchronization & Explorer Updates**
  - Real-time directory watching via `chokidar`, properly filtering duplicates and safely passing IPC events to the renderer.
  - *Files*: `apps/desktop/src/main/services/file-watcher.ts`, `apps/desktop/src/renderer/src/features/explorer/FileTree.tsx`

- [x] **Project Creation & Framework Detection**
  - Explicit framework requests override inferred framework. Process execution utilizes `shell: false` for better Windows process management. Detects package manager (pnpm/yarn/npm).
  - *Files*: `apps/desktop/src/main/services/providers/react-native-managed.ts`, `apps/desktop/src/main/services/workspace-manager.ts`, `apps/desktop/src/main/services/process-manager.ts`

## 3. Agent / AI Architecture

The agent architecture uses a layered gateway model:
- **Request Flow**: Originates in the renderer, sent via IPC to the main process `agent-service.ts`, and then routed to the `packages/agent/src/models/backend-gateway.ts`.
- **Classifier & Planner**: Requests are classified. Conversational requests skip coding/tool planning.
- **Gemini Adapter**: `packages/agent/src/models/google-adapter.ts` facilitates direct communication with the LLM.
- **Tool Execution**: Handled safely in the main process, blocking non-permitted commands.
- **Streaming**: Implemented across IPC to stream LLM responses token-by-token back to the UI.

## 4. Agent Activity Timeline

- **Activity Types**: Distinguishes between planning, execution, and research.
- **Run ID**: Ties activities together.
- **Stable Activity IDs**: Crucially, the same activity ID is reused when an activity changes from `in_progress` to `completed` or `failed`, preventing UI flickering and duplicates.
- **IPC Flow & Renderer State**: The renderer manages clearing the timeline based on `runId` at the start of new operations.

## 5. Filesystem / Explorer Synchronization

- **Filesystem Watcher**: Managed by `apps/desktop/src/main/services/file-watcher.ts`.
- **IPC Events**: Emits `add`, `change`, and `unlink`.
- **Dirty-file Protection**: Ensures unsaved editor changes aren't overwritten by agent background tasks.
- **Duplicate Prevention**: Explorer filtering remains separate from module resolution, ensuring accurate view representations.

## 6. Project Creation / Preview

- **Project Creation Flow**: Scaffold logic integrated with framework detection.
- **Package Manager Detection**: Identifies whether to use npm, yarn, or pnpm primarily via lockfiles.
- **Start Flow**: Incorporates correct CLI execution for frameworks like Expo.
- **Windows Process Management**: Employs `shell: false` behavior for predictable cross-platform process tree termination and unicode path handling.

## 7. Testing & Verification

### Automated verification
- **Command**: `npm run test` (implied test runners)
- **Purpose**: Verify backend gateway routing and mock endpoints.
- **Result**: Passed (exit code 0).

### Manual verification
- **None** - (Specifically adhering to the rule: Do NOT claim something was manually verified if it wasn't).

## 8. Known Limitations / Remaining Work

- [~] Complete Test Coverage (Missing tests for edge-case tool execution).
- [ ] End-to-end multi-agent orchestrator stability over prolonged sessions.
- [ ] Production build packaging for the Electron app.

## 9. Important Architectural Decisions

- Conversational requests must not execute tools.
- Explicit framework requests override inferred framework.
- Timeline activity IDs remain stable during state transitions.
- The renderer owns timeline clearing based on `runId`.
- Explorer filtering remains separate from module resolution.
- `shell:false` is used for Windows process execution to avoid detached orphans.
- Package manager is detected from lockfiles rather than arbitrary assumptions.

## 10. Files Changed

**Main Process / Core Architecture:**
- `apps/desktop/src/main/ipc/index.ts`, `apps/desktop/src/main/ipc/poc.ts`, `apps/desktop/src/preload/index.ts` - IPC bridge adjustments.
- `apps/desktop/src/main/services/agent-service.ts`, `apps/desktop/src/main/services/workspace-manager.ts` - Orchestrator and project handling.
- `apps/desktop/src/main/services/file-watcher.ts` - Robust chokidar integration.
- `apps/desktop/src/main/services/process-manager.ts`, `apps/desktop/src/main/services/providers/react-native-managed.ts` - Cross-platform process and Expo framework support.

**Renderer / UI:**
- `apps/desktop/src/renderer/src/features/explorer/FileTree.tsx` - Directory synchronisation UI.
- `apps/desktop/src/renderer/src/features/plan/PlanViewer.tsx` - Plan UI.
- `apps/desktop/src/renderer/src/stores/chat-store.ts`, `apps/desktop/src/renderer/src/stores/workspace-store.ts` - State management for timeline and stability.
- `apps/desktop/src/renderer/src/layout/AppShell.tsx`, `apps/desktop/src/renderer/src/layout/ChatPane.tsx`, `apps/desktop/src/renderer/src/layout/Sidebar.tsx` - Shell modifications for the new timeline.

**Agent / Packages:**
- `packages/agent/src/models/backend-gateway.ts`, `packages/agent/src/models/google-adapter.ts` - API gateway and model adapters.
- `packages/agent/src/models/auth-router.ts` - Request routing classification.
- `packages/shared/src/index.ts` - Shared types for IPC.
- `apps/server/src/index.ts` - Mock server updates.
