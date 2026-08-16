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
}));
