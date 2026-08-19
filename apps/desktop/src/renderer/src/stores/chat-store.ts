import { create } from 'zustand';
import type { AgentMessage, ProposedEdit, AgentTimelineActivity } from '@peep/shared';

interface ChatState {
  messages: AgentMessage[];
  input: string;
  isStreaming: boolean;
  streamStatus: string;
  streamingMessageId: string | null;
  proposedEdits: ProposedEdit[];
  agentTask: any | null;
  timelineActivities: AgentTimelineActivity[];
  currentRunId: string | null;

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
  loadHistory: (projectPath: string) => Promise<void>;
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
  
  flushPendingSave = () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = null;
    flushPendingSave = null;
    // Note: window.peep corresponds to the IpcApi exposed via preload
    (window as any).peep?.saveChatHistory?.(targetProject, payload).catch(console.error);
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
  input: '',
  isStreaming: false,
  streamStatus: '',
  streamingMessageId: null,
  proposedEdits: [],
  agentTask: null,
  timelineActivities: [],
  currentRunId: null,

  setInput: (input) => set({ input }),
  setAgentTask: (task) => set({ agentTask: task }),
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
  loadHistory: async (projectPath: string) => {
    if (flushPendingSave && currentProjectPath && currentProjectPath !== projectPath) {
      flushPendingSave();
    }
    currentProjectPath = projectPath;
    try {
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
          currentRunId: null, // explicitly drop runId from runtime state
        });
      } else {
        get().clearMessages();
        set({ 
          messages: [{
            id: 'welcome',
            role: 'assistant',
            content: 'Ask anything, @ to mention, / for actions.',
            createdAt: new Date().toISOString(),
          }],
          timelineActivities: [],
          currentRunId: null 
        });
      }
    } catch (err) {
      console.error('Failed to load chat history:', err);
      // Fallback to empty on malformed data
      set({ 
        messages: [{
          id: 'welcome',
          role: 'assistant',
          content: 'Ask anything, @ to mention, / for actions.',
          createdAt: new Date().toISOString(),
        }],
        timelineActivities: [],
        currentRunId: null 
      });
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
