import { readdir, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

export interface PerformanceSnapshot {
  heapUsedMB: number;
  heapTotalMB: number;
  rssMemMB: number;
  uptimeSeconds: number;
  timestamp: string;
}

export interface ProjectSizeAudit {
  totalFiles: number;
  dartFiles: number;
  tsxFiles: number;
  tsFiles: number;
  totalKB: number;
  largeFiles: Array<{ path: string; sizeKB: number }>;
  estimatedComplexity: 'small' | 'medium' | 'large' | 'xlarge';
}

export interface AuditReport {
  performance: PerformanceSnapshot;
  project?: ProjectSizeAudit;
  warnings: string[];
  recommendations: string[];
}

const MB = 1024 * 1024;

/**
 * Capture current Node.js / Electron process memory snapshot.
 */
export function capturePerformanceSnapshot(): PerformanceSnapshot {
  const mem = process.memoryUsage();
  return {
    heapUsedMB:   Math.round(mem.heapUsed  / MB * 10) / 10,
    heapTotalMB:  Math.round(mem.heapTotal / MB * 10) / 10,
    rssMemMB:     Math.round(mem.rss       / MB * 10) / 10,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Walk project directory and build a file size audit.
 * Stops at depth 8 to avoid infinite loops.
 */
export async function auditProjectSize(
  root: string,
  maxDepth = 8,
): Promise<ProjectSizeAudit> {
  const result: ProjectSizeAudit = {
    totalFiles: 0,
    dartFiles: 0,
    tsxFiles: 0,
    tsFiles: 0,
    totalKB: 0,
    largeFiles: [],
    estimatedComplexity: 'small',
  };

  const IGNORED = new Set([
    'node_modules', '.git', '.dart_tool', 'build', '.gradle', 'ios/Pods',
    '__pycache__', '.idea', '.vscode', 'out', 'dist', '.expo',
  ]);

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;
    let entries: string[] = [];
    try {
      entries = await readdir(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (IGNORED.has(entry)) continue;
      const fullPath = join(dir, entry);
      let info;
      try {
        info = await stat(fullPath);
      } catch {
        continue;
      }

      if (info.isDirectory()) {
        await walk(fullPath, depth + 1);
      } else {
        result.totalFiles++;
        const sizeKB = info.size / 1024;
        result.totalKB += sizeKB;

        const ext = extname(entry).toLowerCase();
        if (ext === '.dart') result.dartFiles++;
        else if (ext === '.tsx') result.tsxFiles++;
        else if (ext === '.ts' && !entry.endsWith('.d.ts')) result.tsFiles++;

        if (sizeKB > 80) {
          result.largeFiles.push({
            path: fullPath.replace(root, '').replace(/\\/g, '/'),
            sizeKB: Math.round(sizeKB),
          });
        }
      }
    }
  }

  await walk(root, 0);

  // Sort large files by size
  result.largeFiles.sort((a, b) => b.sizeKB - a.sizeKB);
  result.largeFiles = result.largeFiles.slice(0, 10);

  // Estimate complexity
  const sourceFiles = result.dartFiles + result.tsxFiles + result.tsFiles;
  if (sourceFiles < 20)       result.estimatedComplexity = 'small';
  else if (sourceFiles < 80)  result.estimatedComplexity = 'medium';
  else if (sourceFiles < 250) result.estimatedComplexity = 'large';
  else                        result.estimatedComplexity = 'xlarge';

  return result;
}

/**
 * Build a full audit report with warnings and recommendations.
 */
export async function buildAuditReport(projectRoot?: string): Promise<AuditReport> {
  const performance = capturePerformanceSnapshot();
  const warnings: string[] = [];
  const recommendations: string[] = [];

  // Memory warnings
  if (performance.heapUsedMB > 350) {
    warnings.push(`High heap usage: ${performance.heapUsedMB} MB`);
    recommendations.push('Consider lazy-loading Monaco or killing idle preview process.');
  }
  if (performance.rssMemMB > 600) {
    warnings.push(`High RSS memory: ${performance.rssMemMB} MB`);
    recommendations.push('Check for memory leaks in file watchers or terminal sessions.');
  }

  let project: ProjectSizeAudit | undefined;
  if (projectRoot) {
    project = await auditProjectSize(projectRoot);

    if (project.estimatedComplexity === 'xlarge') {
      warnings.push(`Very large project: ${project.totalFiles} files`);
      recommendations.push('Enable lazy file-tree loading and limit search depth for better performance.');
    }

    if (project.largeFiles.length > 0) {
      warnings.push(`${project.largeFiles.length} large files (>80 KB) detected`);
      recommendations.push(
        `Split large files: ${project.largeFiles.slice(0, 3).map((f) => f.path).join(', ')}`,
      );
    }

    if (project.estimatedComplexity === 'large' || project.estimatedComplexity === 'xlarge') {
      recommendations.push('Use Ctrl+P file picker instead of file tree scroll for navigation in large projects.');
    }
  }

  return { performance, project, warnings, recommendations };
}
