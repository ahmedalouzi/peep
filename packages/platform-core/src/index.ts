import type { AgentMessage, Diagnostic, PlatformTarget, PreviewSession } from '@peep/shared';

export interface AgentContext {
  projectRoot: string;
  treeSummary: string;
  pubspec?: string;
  mainDart?: string;
  openFile?: string;
  recentErrors: Diagnostic[];
}

export interface PlatformAdapter {
  id: PlatformTarget;
  detectProject: (root: string) => Promise<boolean>;
  analyze: (root: string) => Promise<Diagnostic[]>;
  startPreview: (root: string) => Promise<PreviewSession>;
  stopPreview: (processId: number) => Promise<void>;
  getAgentContext: (root: string) => Promise<AgentContext>;
}

export class PlatformRegistry {
  private adapters = new Map<PlatformTarget, PlatformAdapter>();

  register(adapter: PlatformAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  get(id: PlatformTarget): PlatformAdapter | undefined {
    return this.adapters.get(id);
  }

  async detect(root: string): Promise<PlatformAdapter | null> {
    for (const adapter of this.adapters.values()) {
      if (await adapter.detectProject(root)) {
        return adapter;
      }
    }
    return null;
  }

  list(): PlatformAdapter[] {
    return [...this.adapters.values()];
  }
}

export const platformRegistry = new PlatformRegistry();

export type { AgentMessage };
