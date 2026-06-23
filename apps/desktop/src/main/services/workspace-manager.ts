import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { basename, join, relative, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { FileEntry, ProjectInfo } from '@peep/shared';
import type { DatabaseService } from './db';

const IGNORED = new Set(['.git', 'node_modules', '.dart_tool', 'build', '.peep']);

export class WorkspaceManager {
  private project: ProjectInfo | null = null;

  constructor(private db: DatabaseService) {}

  getProject(): ProjectInfo | null {
    return this.project;
  }

  async openFolder(folderPath: string): Promise<ProjectInfo> {
    let platform: 'flutter' | 'react-native' = 'react-native'; // default to RN for empty folders
    try {
      await stat(join(folderPath, 'pubspec.yaml'));
      // If pubspec exists, it's definitely Flutter
      platform = 'flutter';
    } catch {
      // Keep as react-native by default
    }

    const project: ProjectInfo = {
      id: randomUUID(),
      path: folderPath,
      name: basename(folderPath),
      lastOpened: new Date().toISOString(),
      platform,
    };

    await this.db.upsertProject(project);
    this.project = project;
    return project;
  }

  getRecentProjects(): ProjectInfo[] {
    return this.db.getRecentProjects();
  }

  async listDir(dirPath: string, depth = 0, maxDepth = 3): Promise<FileEntry[]> {
    if (depth > maxDepth) return [];

    try {
      const entries = await readdir(dirPath, { withFileTypes: true });
      const result: FileEntry[] = [];

      for (const entry of entries) {
        if (IGNORED.has(entry.name)) continue;

        const fullPath = join(dirPath, entry.name);
        const fileEntry: FileEntry = {
          name: entry.name,
          path: fullPath,
          type: entry.isDirectory() ? 'directory' : 'file',
        };

        if (entry.isDirectory()) {
          try {
            fileEntry.children = await this.listDir(fullPath, depth + 1, maxDepth);
          } catch {
            fileEntry.children = [];
          }
        }

        result.push(fileEntry);
      }

      return result.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    } catch (err) {
      if (depth === 0) {
        throw err;
      }
      return [];
    }
  }

  async readFile(filePath: string): Promise<string> {
    return readFile(filePath, 'utf-8');
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, content, 'utf-8');
  }

  async ensurePeepDir(): Promise<string | null> {
    if (!this.project) return null;
    const peepDir = join(this.project.path, '.peep');
    await mkdir(peepDir, { recursive: true });
    return peepDir;
  }

  relativePath(filePath: string): string {
    if (!this.project) return filePath;
    return relative(this.project.path, filePath);
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      await stat(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
