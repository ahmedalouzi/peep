import { create } from 'zustand';
import { CloudBuildJob } from '@peep/shared';

interface BuildState {
  currentBuild: CloudBuildJob | null;
  setCurrentBuild: (build: CloudBuildJob | null) => void;
  updateCurrentBuild: (updates: Partial<CloudBuildJob>) => void;
  isBuildPanelOpen: boolean;
  setBuildPanelOpen: (isOpen: boolean) => void;
}

export const useBuildStore = create<BuildState>((set) => ({
  currentBuild: null,
  setCurrentBuild: (build) => set({ currentBuild: build }),
  updateCurrentBuild: (updates) => set((state) => ({
    currentBuild: state.currentBuild ? { ...state.currentBuild, ...updates } : null
  })),
  isBuildPanelOpen: false,
  setBuildPanelOpen: (isOpen) => set({ isBuildPanelOpen: isOpen })
}));
