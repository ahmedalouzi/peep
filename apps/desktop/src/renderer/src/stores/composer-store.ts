import { create } from 'zustand';
import type { ProposedEdit } from '@peep/shared';

interface ComposerState {
  isOpen: boolean;
  prompt: string;
  stagedFiles: string[];
  isStreaming: boolean;
  streamStatus: string;
  proposedEdits: ProposedEdit[];

  setOpen: (open: boolean) => void;
  setPrompt: (prompt: string) => void;
  stageFile: (filePath: string) => void;
  unstageFile: (filePath: string) => void;
  clearStagedFiles: () => void;
  setStreaming: (streaming: boolean) => void;
  setStreamStatus: (status: string) => void;
  setProposedEdits: (edits: ProposedEdit[]) => void;
  reset: () => void;
}

export const useComposerStore = create<ComposerState>((set, get) => ({
  isOpen: false,
  prompt: '',
  stagedFiles: [],
  isStreaming: false,
  streamStatus: '',
  proposedEdits: [],

  setOpen: (isOpen) => set({ isOpen }),
  setPrompt: (prompt) => set({ prompt }),
  stageFile: (filePath) => {
    const { stagedFiles } = get();
    if (stagedFiles.includes(filePath)) return;
    set({ stagedFiles: [...stagedFiles, filePath] });
  },
  unstageFile: (filePath) =>
    set((state) => ({
      stagedFiles: state.stagedFiles.filter((f) => f !== filePath),
    })),
  clearStagedFiles: () => set({ stagedFiles: [] }),
  setStreaming: (isStreaming) => set({ isStreaming }),
  setStreamStatus: (streamStatus) => set({ streamStatus }),
  setProposedEdits: (proposedEdits) => set({ proposedEdits }),
  reset: () =>
    set({
      prompt: '',
      stagedFiles: [],
      isStreaming: false,
      streamStatus: '',
      proposedEdits: [],
    }),
}));
