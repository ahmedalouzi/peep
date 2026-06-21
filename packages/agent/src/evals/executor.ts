import { promises as fs } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import type { AgentToolExecutor } from '../orchestrator';

export class EvalExecutor implements AgentToolExecutor {
  constructor(private readonly projectRoot: string) {}

  private resolvePath(p: string) {
    if (isAbsolute(p)) {
      if (!p.startsWith(this.projectRoot)) {
        throw new Error('Access outside project root denied');
      }
      return p;
    }
    return join(this.projectRoot, p);
  }

  async execute(name: string, args: Record<string, unknown>): Promise<string> {
    try {
      switch (name) {
        case 'read_file': {
          const p = this.resolvePath(args.path as string);
          return await fs.readFile(p, 'utf-8');
        }
        case 'list_dir': {
          const p = this.resolvePath(args.path as string);
          const entries = await fs.readdir(p, { withFileTypes: true });
          return entries.map((e) => `${e.isDirectory() ? 'DIR ' : 'FILE'} ${e.name}`).join('\n');
        }
        case 'search_files': {
          const query = (args.query as string).toLowerCase();
          const results: string[] = [];
          const walk = async (dir: string) => {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const e of entries) {
              if (e.name.startsWith('.')) continue; // skip hidden
              const full = join(dir, e.name);
              if (e.isDirectory()) await walk(full);
              else if (e.name.toLowerCase().includes(query)) results.push(full);
            }
          };
          await walk(this.projectRoot);
          return results.map((r) => r.replace(this.projectRoot, '')).join('\n') || 'No files found.';
        }
        case 'search_content': {
          return 'Content search is mocked in eval mode. Try reading specific files instead.';
        }
        case 'propose_file_edit': {
          const p = this.resolvePath(args.path as string);
          await fs.mkdir(join(p, '..'), { recursive: true });
          await fs.writeFile(p, args.content as string, 'utf-8');
          return 'Edit applied successfully.';
        }
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (err: any) {
      return `Error: ${err.message}`;
    }
  }
}
