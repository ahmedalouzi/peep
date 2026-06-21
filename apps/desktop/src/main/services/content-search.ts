import { readFile, readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';

const IGNORED = new Set(['.git', 'node_modules', '.dart_tool', 'build', '.peep']);
const TEXT_EXTENSIONS = new Set(['.dart', '.yaml', '.yml', '.json', '.md', '.txt', '.html', '.css', '.xml']);

export interface ContentMatch {
  file: string;
  line: number;
  text: string;
}

export async function searchContent(
  rootPath: string,
  query: string,
  maxResults = 20,
): Promise<ContentMatch[]> {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  const results: ContentMatch[] = [];

  async function walk(dirPath: string): Promise<void> {
    if (results.length >= maxResults) return;

    let entries;
    try {
      entries = await readdir(dirPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= maxResults) break;
      if (IGNORED.has(entry.name)) continue;

      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      const ext = extname(entry.name).toLowerCase();
      if (!TEXT_EXTENSIONS.has(ext)) continue;

      let content: string;
      try {
        content = await readFile(fullPath, 'utf-8');
      } catch {
        continue;
      }

      const lines = content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        if (results.length >= maxResults) break;
        if (lines[i].toLowerCase().includes(normalized)) {
          results.push({
            file: fullPath,
            line: i + 1,
            text: lines[i].trim(),
          });
        }
      }
    }
  }

  await walk(rootPath);
  return results;
}
