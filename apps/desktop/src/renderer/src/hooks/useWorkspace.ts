import { useCallback } from 'react';
import type { ProjectInfo } from '@peep/shared';
import { useWorkspaceStore } from '../stores/workspace-store';

export function useWorkspace() {
  const store = useWorkspaceStore();

  const loadProject = useCallback(
    async (project: ProjectInfo) => {
      store.setProject(project);
      const [tree, recent] = await Promise.all([
        window.peep.listDir(project.path),
        window.peep.getRecentProjects(),
      ]);
      store.setFileTree(tree);
      store.setRecentProjects(recent);
      return project;
    },
    [store],
  );

  const openProjectFolder = useCallback(async () => {
    store.setLoading(true);
    try {
      const project = await window.peep.openFolder();
      if (!project) return null;
      return loadProject(project);
    } finally {
      store.setLoading(false);
    }
  }, [store, loadProject]);

  const openProjectByPath = useCallback(
    async (path: string) => {
      store.setLoading(true);
      try {
        const project = await window.peep.openProjectByPath(path);
        return loadProject(project);
      } finally {
        store.setLoading(false);
      }
    },
    [store, loadProject],
  );

  const loadFile = useCallback(
    async (filePath: string, name: string) => {
      const content = await window.peep.readFile(filePath);
      store.openFile({ path: filePath, name, content, dirty: false });
    },
    [store],
  );

  const saveActiveFile = useCallback(async () => {
    const { activeFilePath, openFiles } = store;
    if (!activeFilePath) return;

    const file = openFiles.find((f) => f.path === activeFilePath);
    if (!file) return;

    await window.peep.writeFile(file.path, file.content);
    store.openFile({ ...file, dirty: false });
  }, [store]);

  return {
    ...store,
    openProjectFolder,
    openProjectByPath,
    syncProject: loadProject,
    loadFile,
    saveActiveFile,
    toggleSidebar: store.toggleSidebar,
    toggleAgentPane: store.toggleAgentPane,
  };
}
