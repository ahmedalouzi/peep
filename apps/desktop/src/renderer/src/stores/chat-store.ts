import * as Sentry from '@sentry/electron/renderer';
import { create } from 'zustand';
import type { AgentMessage, ProposedEdit, AgentTimelineActivity, AgentPhase } from '@peep/shared';

interface ThreadInfo {
  id: string;
  title: string;
  updated_at: string;
}

interface ChatState {
  threads: ThreadInfo[];
  activeThreadId: string | null;

  messages: AgentMessage[];
  input: string;
  isStreaming: boolean;
  streamStatus: string;
  streamingMessageId: string | null;
  proposedEdits: ProposedEdit[];
  agentTask: any | null;
  timelineActivities: AgentTimelineActivity[];
  currentRunId: string | null;
  agentPhase: AgentPhase;

  ipcError: string | null;

  setInput: (input: string) => void;
  addMessage: (message: AgentMessage) => void;
  appendToStreamingMessage: (delta: string) => void;
  startStreaming: (messageId: string) => void;
  setStreamStatus: (status: string) => void;
  finishStreaming: () => void;
  setStreaming: (streaming: boolean) => void;
  setProposedEdits: (edits: ProposedEdit[]) => void;
  setAgentTask: (task: any | null) => void;
  clearMessages: () => void;
  upsertTimelineActivity: (activity: AgentTimelineActivity) => void;
  clearTimelineActivities: () => void;
  setAgentPhase: (phase: AgentPhase) => void;
  setIpcError: (error: string | null) => void;
  loadHistory: (projectPath: string) => Promise<void>;
  
  loadThreads: () => Promise<void>;
  switchThread: (threadId: string) => Promise<void>;
  newThread: () => Promise<void>;
  deleteActiveThread: () => Promise<void>;
}

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let currentProjectPath: string | null = null;
let flushPendingSave: (() => void) | null = null;

function triggerSave(state: ChatState) {
  if (!currentProjectPath) return;
  if (saveTimeout) clearTimeout(saveTimeout);
  
  const payload = {
    messages: state.messages,
    timelineActivities: state.timelineActivities,
    updatedAt: new Date().toISOString()
  };
  
  const targetProject = currentProjectPath; // capture for closure
  const threadId = state.activeThreadId;
  
  flushPendingSave = () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = null;
    flushPendingSave = null;
    
    if (threadId) {
      const runsMap = new Map<string, any>();
      for (const act of state.timelineActivities) {
        if (!runsMap.has(act.runId)) {
          runsMap.set(act.runId, {
            run_id: act.runId,
            thread_id: threadId,
            started_at: act.timestamp,
            status: act.status || 'in_progress',
            timeline_activities: []
          });
        }
        const run = runsMap.get(act.runId);
        run.timeline_activities.push(act);
        if (act.type === 'completed' || act.type === 'error') {
          run.completed_at = act.timestamp;
          run.status = act.status;
        }
      }
      const runs = Array.from(runsMap.values());
      (window as any).peep?.saveChatThread?.(threadId, payload.messages, undefined, runs).catch((err: any) => {
        console.error('Save failed:', err);
        Sentry.captureException(err);
        useChatStore.getState().setIpcError('Failed to save to backend');
      });
    } else {
      (window as any).peep?.saveChatHistory?.(targetProject, payload).catch((err: any) => {
        console.error('Save history failed:', err);
        Sentry.captureException(err);
        useChatStore.getState().setIpcError('Failed to save history to backend');
      });
    }
  };

  saveTimeout = setTimeout(flushPendingSave, 750);
}

function stripCodeBlocks(text: string): string {
  // Strip introductory lines pointing to code files
  let cleaned = text.replace(
    /(?:Here's the updated content for|Here are the proposed contents|Proposed Code for|### Updated|### Proposed Code)[^:\n]*:?/gi,
    ''
  );
  // Replace complete code blocks with empty string
  cleaned = cleaned.replace(/```[a-zA-Z]*[\s\S]*?```/g, '');
  // Handle streaming state: if there is an open code block, truncate it
  const openBlockIndex = cleaned.indexOf('```');
  if (openBlockIndex >= 0) {
    cleaned = cleaned.slice(0, openBlockIndex);
  }
  return cleaned.trim();
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Ask anything, @ to mention, / for actions.',
      createdAt: new Date().toISOString(),
    },
  ],
  threads: [],
  activeThreadId: null,
  input: '',
  isStreaming: false,
  streamStatus: '',
  streamingMessageId: null,
  proposedEdits: [],
  agentTask: null,
  timelineActivities: [],
  currentRunId: null,
  agentPhase: 'idle',
  ipcError: null,

  setInput: (input) => set({ input }),
  setAgentTask: (task) => set({ agentTask: task }),
  setIpcError: (ipcError) => set({ ipcError }),
  addMessage: (message) =>
    set((state) => ({
      messages: [
        ...state.messages,
        message.role === 'assistant'
          ? { ...message, content: stripCodeBlocks(message.content) }
          : message,
      ],
    })),

  startStreaming: (messageId) =>
    set({
      isStreaming: true,
      streamingMessageId: messageId,
      streamStatus: 'Thinking…',
      messages: [...get().messages, { id: messageId, role: 'assistant', content: '', createdAt: new Date().toISOString() }],
    }),

  appendToStreamingMessage: (delta) => {
    const { streamingMessageId, messages } = get();
    if (!streamingMessageId) return;
    set({
      messages: messages.map((m) =>
        m.id === streamingMessageId
          ? { ...m, content: stripCodeBlocks(m.content + delta) }
          : m
      ),
    });
  },

  setStreamStatus: (streamStatus) => set({ streamStatus }),
  finishStreaming: () => set({ isStreaming: false, streamStatus: '', streamingMessageId: null }),
  setStreaming: (isStreaming) => set({ isStreaming }),
  setProposedEdits: (proposedEdits) => set({ proposedEdits }),
  clearMessages: () => set({ messages: [] }),
  upsertTimelineActivity: (activity) => set((state) => {
    // Auto-clear if we receive a new runId
    if (state.currentRunId !== activity.runId) {
      return {
        currentRunId: activity.runId,
        timelineActivities: [activity]
      };
    }
    const index = state.timelineActivities.findIndex(a => a.id === activity.id);
    if (index >= 0) {
      const newActivities = [...state.timelineActivities];
      newActivities[index] = activity;
      return { timelineActivities: newActivities };
    }
    return { timelineActivities: [...state.timelineActivities, activity] };
  }),
  clearTimelineActivities: () => set({ timelineActivities: [], currentRunId: null }),
  setAgentPhase: (agentPhase) => set({ agentPhase }),
  loadHistory: async (projectPath: string) => {
    if (flushPendingSave && currentProjectPath && currentProjectPath !== projectPath) {
      flushPendingSave();
    }
    currentProjectPath = projectPath;
    try {
      get().setIpcError(null);
      const threads = await (window as any).peep?.listChatThreads?.(projectPath);
      if (threads && threads.length > 0) {
        set({ threads });
        await get().switchThread(threads[0].id);
        return;
      }
      
      const history = await (window as any).peep?.loadChatHistory?.(projectPath);
      if (history) {
        set({
          messages: history.messages || [
            {
              id: 'welcome',
              role: 'assistant',
              content: 'Ask anything, @ to mention, / for actions.',
              createdAt: new Date().toISOString(),
            },
          ],
          timelineActivities: history.timelineActivities || [],
          currentRunId: null,
          threads: [],
          activeThreadId: null,
        });
      } else {
        await get().newThread();
      }
    } catch (err) {
      console.error('Failed to load chat history:', err);
        Sentry.captureException(err);
      get().setIpcError('Failed to load chat history');
      await get().newThread();
    }
  },

  loadThreads: async () => {
    if (!currentProjectPath) return;
    try {
      get().setIpcError(null);
      const threads = await (window as any).peep?.listChatThreads?.(currentProjectPath);
      set({ threads: threads || [] });
    } catch (e) {
      console.error('Failed to load threads via IPC:', e);
        Sentry.captureException(e);
      get().setIpcError('Failed to load threads');
    }
  },

  switchThread: async (threadId: string) => {
    const { agentPhase } = get();
    if (agentPhase !== 'idle' && agentPhase !== 'done' && agentPhase !== 'cancelled' && agentPhase !== 'error') {
      console.warn('Cannot switch thread while agent is active');
      return;
    }
    if (flushPendingSave) flushPendingSave();
    try {
      get().setIpcError(null);
      const data = await (window as any).peep?.loadChatThread?.(threadId);
      if (!data) throw new Error('Received empty data from backend');
      
      const messages = data?.messages || [];
      const runs = data?.runs || [];
      const timelineActivities = [];
      for (const run of runs) {
        if (run.timeline_activities && Array.isArray(run.timeline_activities)) {
          timelineActivities.push(...run.timeline_activities);
        }
      }
      set({ 
        activeThreadId: threadId, 
        messages,
        timelineActivities,
        currentRunId: null,
        agentPhase: 'idle'
      });
    } catch (e) {
      console.error(`Failed to load thread ${threadId} via IPC:`, e);
        Sentry.captureException(e);
      get().setIpcError('Failed to load thread');
    }
  },

  newThread: async () => {
    const { agentPhase } = get();
    if (agentPhase !== 'idle' && agentPhase !== 'done' && agentPhase !== 'cancelled' && agentPhase !== 'error') {
      console.warn('Cannot create thread while agent is active');
      return;
    }
    if (flushPendingSave) flushPendingSave();
    
    // Create local thread placeholder, will be saved on first message
    const threadId = crypto.randomUUID();
    const newThread = { id: threadId, title: 'New Chat', updated_at: new Date().toISOString() };
    set({
      activeThreadId: threadId,
      threads: [newThread, ...get().threads],
      messages: [{
        id: 'welcome',
        role: 'assistant',
        content: 'Ask anything, @ to mention, / for actions.',
        createdAt: new Date().toISOString(),
      }],
      timelineActivities: [],
      currentRunId: null,
      agentPhase: 'idle'
    });
  },

  deleteActiveThread: async () => {
    const { activeThreadId, agentPhase } = get();
    if (!activeThreadId) return;
    if (agentPhase !== 'idle' && agentPhase !== 'done' && agentPhase !== 'cancelled' && agentPhase !== 'error') {
      console.warn('Cannot delete active thread while agent is executing');
      return;
    }
    try {
      await (window as any).peep?.deleteChatThread?.(activeThreadId);
      const remaining = get().threads.filter(t => t.id !== activeThreadId);
      set({ threads: remaining });
      if (remaining.length > 0) {
        await get().switchThread(remaining[0].id);
      } else {
        await get().newThread();
      }
    } catch (e) {
      console.error('Failed to delete thread', e);
        Sentry.captureException(e);
    }
  },
}));

// Subscribe to state changes to trigger debounced saves
useChatStore.subscribe((state, prevState) => {
  if (!currentProjectPath) return;
  // Only save if durable state changed
  if (
    state.messages !== prevState.messages ||
    state.timelineActivities !== prevState.timelineActivities
  ) {
    triggerSave(state);
  }
});
