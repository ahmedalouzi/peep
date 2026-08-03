import type { DependencyGraph } from '@peep/shared';

export interface FileReference {
  file: string;
  line?: number;
}

export interface EntityReference extends FileReference {
  name: string;
  type?: string; // screen, component, service, model, etc.
}

export interface StateManagementMeta {
  type: 'riverpod' | 'provider' | 'redux' | 'context' | 'zustand' | 'bloc' | 'getx' | 'unknown';
  files: string[];
}

export interface ThemeMeta {
  files: string[];
  tokens?: string[];
}

export interface ProjectIndex {
  version: number;
  framework: 'flutter' | 'react-native' | 'unknown';
  entryPoints: string[];
  routes: EntityReference[];
  screens: EntityReference[];
  components: EntityReference[];
  services: EntityReference[];
  models: EntityReference[];
  stateManagement: StateManagementMeta;
  theme: ThemeMeta;
  dependencies: string[];
  files: string[];
  relationships: Record<string, string[]>; // filePath -> related filePaths
  graph?: DependencyGraph;
  fileHashes?: Record<string, string>;
}

export interface ProjectAnalyzer {
  analyzeFile(filePath: string, content: string): Partial<ProjectIndex>;
}
