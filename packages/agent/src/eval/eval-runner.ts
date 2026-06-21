/**
 * Peep Agent Eval Runner
 *
 * Runs the eval task set against a live project and scores results.
 *
 * Usage:
 *   node scripts/run-eval.mjs \
 *     --platform flutter \
 *     --project /path/to/flutter_project \
 *     --api-key sk-... \
 *     [--ids fl-01,fl-02]   (optional: run specific tasks)
 *     [--output results.json]
 */

import { FLUTTER_EVAL_TASKS } from './flutter-eval-tasks.js';
import { REACT_NATIVE_EVAL_TASKS } from './react-native-eval-tasks.js';
import type { EvalTask } from './flutter-eval-tasks.js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface EvalResult {
  taskId: string;
  platform: string;
  passed: boolean;
  score: number;               // 0–1
  checksTotal: number;
  checksPassed: number;
  negativeChecksFailed: number;
  filesCreated: string[];
  errorMessage?: string;
  durationMs: number;
}

export interface EvalSummary {
  platform: string;
  totalTasks: number;
  passedTasks: number;
  passRate: number;            // 0–1
  avgScore: number;            // 0–1
  byCategory: Record<string, { total: number; passed: number }>;
  results: EvalResult[];
  runAt: string;
}

/**
 * Evaluates a single task's output files against its expected checks.
 * Call this AFTER the agent has run and written files.
 */
export async function evaluateTask(
  task: EvalTask,
  projectRoot: string,
  platform: string,
  durationMs: number,
): Promise<EvalResult> {
  let checksPassed = 0;
  let negativeChecksFailed = 0;
  const filesCreated: string[] = [];

  try {
    // Collect all relevant file contents
    const allContents: string[] = [];

    // Read expected files if specified
    for (const relPath of task.expectedFiles) {
      try {
        const content = await readFile(join(projectRoot, relPath), 'utf-8');
        allContents.push(content);
        filesCreated.push(relPath);
      } catch {
        // File not created — will reduce score
      }
    }

    // If no expected files, scan common directories
    if (task.expectedFiles.length === 0) {
      // Checks will run against what the agent touched (passed in via allContents externally)
      // For runner integration, inject changed file contents here.
    }

    const combined = allContents.join('\n');

    // Positive checks
    for (const check of task.checks) {
      if (combined.includes(check)) {
        checksPassed++;
      }
    }

    // Negative checks (things that should NOT be present)
    if (task.negativeChecks) {
      for (const neg of task.negativeChecks) {
        if (combined.includes(neg)) {
          negativeChecksFailed++;
        }
      }
    }

    const checksTotal = task.checks.length;
    const fileScore = task.expectedFiles.length > 0
      ? filesCreated.length / task.expectedFiles.length
      : 1;
    const checkScore = checksTotal > 0 ? checksPassed / checksTotal : 1;
    const negativePenalty = (task.negativeChecks?.length ?? 0) > 0
      ? negativeChecksFailed / task.negativeChecks!.length
      : 0;

    const score = Math.max(0, (fileScore * 0.4 + checkScore * 0.6) - negativePenalty * 0.3);
    const passed = score >= 0.7;

    return {
      taskId: task.id,
      platform,
      passed,
      score,
      checksTotal,
      checksPassed,
      negativeChecksFailed,
      filesCreated,
      durationMs,
    };
  } catch (error) {
    return {
      taskId: task.id,
      platform,
      passed: false,
      score: 0,
      checksTotal: task.checks.length,
      checksPassed: 0,
      negativeChecksFailed: 0,
      filesCreated,
      errorMessage: error instanceof Error ? error.message : String(error),
      durationMs,
    };
  }
}

/**
 * Aggregate results into a summary.
 */
export function summarize(results: EvalResult[], platform: string): EvalSummary {
  const allTasks = platform === 'flutter' ? FLUTTER_EVAL_TASKS : REACT_NATIVE_EVAL_TASKS;
  const passedTasks = results.filter((r) => r.passed).length;
  const avgScore = results.reduce((acc, r) => acc + r.score, 0) / (results.length || 1);

  const byCategory: Record<string, { total: number; passed: number }> = {};
  for (const result of results) {
    const task = allTasks.find((t) => t.id === result.taskId);
    if (!task) continue;
    if (!byCategory[task.category]) {
      byCategory[task.category] = { total: 0, passed: 0 };
    }
    byCategory[task.category]!.total++;
    if (result.passed) byCategory[task.category]!.passed++;
  }

  return {
    platform,
    totalTasks: results.length,
    passedTasks,
    passRate: passedTasks / (results.length || 1),
    avgScore,
    byCategory,
    results,
    runAt: new Date().toISOString(),
  };
}

/**
 * Print a human-readable summary to console.
 */
export function printSummary(summary: EvalSummary): void {
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const bar = (n: number, w = 20) => '█'.repeat(Math.round(n * w)).padEnd(w, '░');

  console.log(`\n${'═'.repeat(60)}`);
  console.log(` Peep Eval — ${summary.platform.toUpperCase()}`);
  console.log(`${'═'.repeat(60)}`);
  console.log(` Tasks:     ${summary.passedTasks}/${summary.totalTasks} passed (${pct(summary.passRate)})`);
  console.log(` Avg score: ${pct(summary.avgScore)}  ${bar(summary.avgScore)}`);
  console.log(`\n By category:`);

  for (const [cat, { total, passed }] of Object.entries(summary.byCategory)) {
    const rate = passed / total;
    console.log(`   ${cat.padEnd(12)} ${passed}/${total}  ${bar(rate, 12)} ${pct(rate)}`);
  }

  console.log(`\n Failed tasks:`);
  for (const r of summary.results.filter((r) => !r.passed)) {
    console.log(`   ✗ ${r.taskId}  score=${pct(r.score)}  checks=${r.checksPassed}/${r.checksTotal}`);
    if (r.errorMessage) console.log(`     error: ${r.errorMessage}`);
  }

  console.log(`${'═'.repeat(60)}\n`);
}

/** Get all tasks for a platform. */
export function getTasks(platform: 'flutter' | 'react-native'): EvalTask[] {
  return platform === 'flutter' ? FLUTTER_EVAL_TASKS : REACT_NATIVE_EVAL_TASKS;
}
