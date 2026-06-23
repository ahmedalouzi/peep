import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { getTemplate, PROJECT_TEMPLATES } from '@peep/flutter-adapter';
import type { CreateProjectOptions, ProjectTemplateInfo } from '@peep/shared';
import type { FlutterService } from './flutter-service';
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
    private flutter: FlutterService,
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

    const projectPath = join(options.parentPath, name);

    try {
      await access(projectPath);
      throw new Error(`Folder already exists: ${projectPath}`);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Folder already exists')) {
        throw error;
      }
      /* does not exist — good */
    }

    await this.flutter.createProject(name, options.parentPath);

    const template = getTemplate(options.templateId);
    if (template && template.files.length > 0) {
      for (const file of template.files) {
        const fullPath = join(projectPath, file.relativePath);
        await mkdir(dirname(fullPath), { recursive: true });
        await writeFile(fullPath, file.content, 'utf-8');
      }
    }

    await this.flutter.pubGet(projectPath);
    return projectPath;
  }
}
