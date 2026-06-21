import { access } from 'node:fs/promises';
import { join } from 'node:path';
import simpleGit, { type SimpleGit, type StatusResult } from 'simple-git';
import type { GitDiffResult, GitFileChange, GitStatusResult } from '@peep/shared';

function mapStatus(file: StatusResult['files'][number]): GitFileChange {
  let status: GitFileChange['status'] = 'modified';
  if (file.index === '?' || file.working_dir === '?') status = 'untracked';
  else if (file.index === 'A' || file.working_dir === 'A') status = 'added';
  else if (file.index === 'D' || file.working_dir === 'D') status = 'deleted';
  else if (file.index === 'R' || file.working_dir === 'R') status = 'renamed';

  const staged = file.index !== ' ' && file.index !== '?';

  return { path: file.path, status, staged };
}

export class GitService {
  private getGit(projectPath: string): SimpleGit {
    return simpleGit(projectPath);
  }

  async isRepo(projectPath: string): Promise<boolean> {
    try {
      await access(join(projectPath, '.git'));
      return true;
    } catch {
      return false;
    }
  }

  async status(projectPath: string): Promise<GitStatusResult> {
    const isRepo = await this.isRepo(projectPath);
    if (!isRepo) {
      return { isRepo: false, branch: '', changes: [] };
    }

    const git = this.getGit(projectPath);
    const result = await git.status();
    const branch = result.current ?? 'HEAD';

    return {
      isRepo: true,
      branch,
      changes: result.files.map(mapStatus),
    };
  }

  async init(projectPath: string): Promise<void> {
    const git = this.getGit(projectPath);
    await git.init();
  }

  async stage(projectPath: string, files: string[]): Promise<void> {
    const git = this.getGit(projectPath);
    await git.add(files);
  }

  async unstage(projectPath: string, files: string[]): Promise<void> {
    const git = this.getGit(projectPath);
    await git.reset(['HEAD', '--', ...files]);
  }

  async commit(projectPath: string, message: string): Promise<void> {
    const git = this.getGit(projectPath);
    await git.commit(message);
  }

  async diff(projectPath: string, filePath: string): Promise<GitDiffResult> {
    const git = this.getGit(projectPath);
    const diff = await git.diff(['--', filePath]);
    return { path: filePath, diff: diff || 'No changes.' };
  }
}
