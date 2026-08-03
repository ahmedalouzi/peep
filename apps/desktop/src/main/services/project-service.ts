import { PROJECT_TEMPLATES } from '@peep/flutter-adapter';
import type { CreateProjectOptions, ProjectTemplateInfo } from '@peep/shared';
import type { PlatformRegistry } from './platform-registry';
import type { WorkspaceManager } from './workspace-manager';

export function sanitizeProjectName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

export function isValidProjectName(name: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(name);
}

export class ProjectService {
  constructor(
    private registry: PlatformRegistry,
    _workspace: WorkspaceManager,
  ) {}

  listTemplates(): ProjectTemplateInfo[] {
    return PROJECT_TEMPLATES.map(({ id, name, description }) => ({ id, name, description }));
  }

  async createFromTemplate(options: CreateProjectOptions): Promise<string> {
    const name = sanitizeProjectName(options.name);
    if (!isValidProjectName(name)) {
      throw new Error('Project name must start with a letter and contain only lowercase letters, numbers, and underscores.');
    }

    // Determine provider based on options. For now, default to react-native-managed if beginner or not specified.
    const mode = (options as any).mode || 'beginner';
    const framework = (options as any).framework || 'react-native';
    
    let providerId = 'react-native-managed';
    if (mode === 'advanced') {
      providerId = framework === 'flutter' ? 'flutter-local' : 'react-native-local';
    }

    const provider = this.registry.getProvider(providerId);
    return await provider.createProject(name, options.parentPath, options.templateId);
  }
}
