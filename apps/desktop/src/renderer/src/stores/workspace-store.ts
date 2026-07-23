import { create } from 'zustand';
import type { FileEntry, ProjectInfo } from '@peep/shared';

export interface OpenFile {
  path: string;
  name: string;
  content: string;
  dirty: boolean;
}

interface WorkspaceState {
  project: ProjectInfo | null;
  recentProjects: ProjectInfo[];
  fileTree: FileEntry[];
  openFiles: OpenFile[];
  activeFilePath: string | null;

  bottomPanelOpen: boolean;
  sidebarOpen: boolean;
  agentPaneOpen: boolean;
  previewPaneOpen: boolean;
  sidebarView: 'explorer' | 'extensions' | 'search' | 'git';
  bottomPanelTab: 'problems' | 'logs' | 'terminal' | 'git';
  isLoading: boolean;
  creatingItem: { type: 'file' | 'folder', baseDir: string } | null;
  renamingItem: FileEntry | null;
  selectedExplorerPath: { path: string, type: 'file' | 'directory' } | null;

  setProject: (project: ProjectInfo | null) => void;
  setRecentProjects: (projects: ProjectInfo[]) => void;
  setFileTree: (tree: FileEntry[]) => void;
  openFile: (file: OpenFile) => void;
  updateFileContent: (path: string, content: string) => void;
  setActiveFile: (path: string | null) => void;
  closeFile: (path: string) => void;
  toggleBottomPanel: () => void;
  toggleSidebar: () => void;
  setSidebarView: (view: 'explorer' | 'extensions' | 'search' | 'git') => void;
  toggleAgentPane: () => void;
  setPreviewPaneOpen: (open: boolean) => void;
  setBottomPanelTab: (tab: 'problems' | 'logs' | 'terminal' | 'git') => void;
  setLoading: (loading: boolean) => void;
  setCreatingItem: (item: { type: 'file' | 'folder', baseDir: string } | null) => void;
  setRenamingItem: (item: FileEntry | null) => void;
  setSelectedExplorerPath: (item: { path: string, type: 'file' | 'directory' } | null) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  project: null,
  recentProjects: [],
  fileTree: [],
  openFiles: [],
  activeFilePath: null,
  bottomPanelOpen: true,
  sidebarOpen: true,
  sidebarView: 'explorer',
  agentPaneOpen: true,
  previewPaneOpen: true,
  bottomPanelTab: 'problems',
  isLoading: false,
  creatingItem: null,
  renamingItem: null,
  selectedExplorerPath: null,

  setProject: (project) => set({ project, selectedExplorerPath: null }),
  setRecentProjects: (recentProjects) => set({ recentProjects }),
  setFileTree: (fileTree) => set({ fileTree }),

  openFile: (file) => {
    const { openFiles } = get();
    const exists = openFiles.find((f) => f.path === file.path);
    if (exists) {
      set({ activeFilePath: file.path });
      return;
    }
    set({
      openFiles: [...openFiles, file],
      activeFilePath: file.path,
    });
  },

  updateFileContent: (path, content) => {
    set({
      openFiles: get().openFiles.map((f) =>
        f.path === path ? { ...f, content, dirty: true } : f,
      ),
    });
  },

  setActiveFile: (activeFilePath) => set({ activeFilePath }),

  closeFile: (path) => {
    const { openFiles, activeFilePath } = get();
    const next = openFiles.filter((f) => f.path !== path);
    let nextActive = activeFilePath;
    if (activeFilePath === path) {
      nextActive = next.length > 0 ? next[next.length - 1].path : null;
    }
    set({ openFiles: next, activeFilePath: nextActive });
  },

  toggleBottomPanel: () => set({ bottomPanelOpen: !get().bottomPanelOpen }),
  toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),
  setSidebarView: (view) => set({ sidebarView: view, sidebarOpen: true }),
  toggleAgentPane: () => set({ agentPaneOpen: !get().agentPaneOpen }),
  setPreviewPaneOpen: (previewPaneOpen) => set({ previewPaneOpen }),
  setBottomPanelTab: (tab) => set({ bottomPanelTab: tab }),
  setLoading: (loading) => set({ isLoading: loading }),
  setCreatingItem: (item) => set({ creatingItem: item }),
  setRenamingItem: (item) => set({ renamingItem: item }),
  setSelectedExplorerPath: (item) => set({ selectedExplorerPath: item }),
}));
