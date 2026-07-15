import { create } from 'zustand';
import type { Diagnostic, PreviewSession } from '@peep/shared';

interface PreviewState {
  session: PreviewSession | null;
  logs: string[];
  iframeKey: number;
  deviceId: string;

  setSession: (session: PreviewSession) => void;
  addLog: (line: string) => void;
  bumpIframe: () => void;
  clearLogs: () => void;
  setDeviceId: (id: string) => void;
}

export const usePreviewStore = create<PreviewState>((set) => ({
  session: null,
  logs: [],
  iframeKey: 0,
  deviceId: 'iphone-15',

  setSession: (session) => set({ session }),
  addLog: (line) =>
    set((state) => ({
      logs: [...state.logs.slice(-200), line],
    })),
  bumpIframe: () => set((state) => ({ iframeKey: state.iframeKey + 1 })),
  clearLogs: () => set({ logs: [] }),
  setDeviceId: (id) => set({ deviceId: id }),
}));

interface DiagnosticsState {
  items: Diagnostic[];
  setItems: (items: Diagnostic[]) => void;
}

export const useDiagnosticsStore = create<DiagnosticsState>((set) => ({
  items: [],
  setItems: (items) => set({ items }),
}));
