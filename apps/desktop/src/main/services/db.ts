import { app } from 'electron';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { ProjectInfo, Settings } from '@peep/shared';

const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  autoSave: true,
};

interface StoreData {
  projects: ProjectInfo[];
  settings: Settings;
}

export class DatabaseService {
  private storePath: string;
  private data: StoreData = {
    projects: [],
    settings: { ...DEFAULT_SETTINGS },
  };

  constructor() {
    this.storePath = join(app.getPath('userData'), 'peep-store.json');
  }

  async init(): Promise<void> {
    try {
      const raw = await readFile(this.storePath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<StoreData>;
      this.data = {
        projects: parsed.projects ?? [],
        settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
      };
    } catch {
      await this.persist();
    }
  }

  private async persist(): Promise<void> {
    await mkdir(app.getPath('userData'), { recursive: true });
    await writeFile(this.storePath, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  getSettings(): Settings {
    const settings = { ...this.data.settings };
    return {
      ...settings,
      apiKey: undefined,
      apiKeyConfigured: Boolean(this.data.settings.apiKey),
    };
  }

  getSettingsRaw(): Settings {
    return { ...this.data.settings };
  }

  async setSettings(partial: Partial<Settings>): Promise<Settings> {
    const next = { ...this.data.settings, ...partial };
    if (partial.apiKey === '') {
      delete next.apiKey;
    }
    this.data.settings = next;
    await this.persist();
    return this.getSettings();
  }

  async upsertProject(project: ProjectInfo): Promise<void> {
    const index = this.data.projects.findIndex((p) => p.path === project.path);
    if (index >= 0) {
      this.data.projects[index] = project;
    } else {
      this.data.projects.push(project);
    }
    await this.persist();
  }

  getRecentProjects(limit = 10): ProjectInfo[] {
    return [...this.data.projects]
      .sort((a, b) => b.lastOpened.localeCompare(a.lastOpened))
      .slice(0, limit);
  }
}
