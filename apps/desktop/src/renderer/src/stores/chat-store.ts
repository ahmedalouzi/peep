import { create } from 'zustand';
import type { AgentMessage, ProposedEdit } from '@peep/shared';

interface ChatState {
  messages: AgentMessage[];
  input: string;
  isStreaming: boolean;
  streamStatus: string;
  streamingMessageId: string | null;
  proposedEdits: ProposedEdit[];

  setInput: (input: string) => void;
  addMessage: (message: AgentMessage) => void;
  appendToStreamingMessage: (delta: string) => void;
  startStreaming: (messageId: string) => void;
  setStreamStatus: (status: string) => void;
  finishStreaming: () => void;
  setStreaming: (streaming: boolean) => void;
  setProposedEdits: (edits: ProposedEdit[]) => void;
  clearMessages: () => void;
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

  setInput: (input) => set({ input }),
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
}));
