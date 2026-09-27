// packages/cloud-build/src/reconciler.ts
// Orphaned-job reconciliation.
//
// If the Worker PROCESS crashes after claiming a job (setting status='running'),
// the build_jobs row stays stuck at 'running' with no one to update it.
// The reaper sidecar handles the Docker container (kills + removes it), but it
// does not touch the database. The reconciler handles the database side.
//
// The reconciler runs on the API SERVER (not the worker — the worker is what crashes).
// It uses the workerPool (BYPASSRLS) because it is a system-level operation that
// must see ALL users' running jobs, not just one user's.
//
// The api_app role (RLS-enforced) cannot be used here because app.current_user_id
// is not set in the reconciler's context. This is the one place the API server
// process holds a workerPool connection — strictly for this system operation.

import type { Pool } from 'pg';
import { markOrphanedJobsFailed } from './job-store.js';

export const BUILD_TIMEOUT_MS    = 10 * 60 * 1000;  // 10 minutes — must match worker timeout
export const GRACE_PERIOD_MS     =  2 * 60 * 1000;  // 2 minutes grace after timeout
export const RECONCILER_INTERVAL = 2 * 60 * 1000;   // Run every 2 minutes

/**
 * Checks for jobs stuck in 'running' state beyond the expected timeout + grace
 * and marks them as 'failed' with a descriptive error message.
 *
 * Maximum orphan window:
 *   (BUILD_TIMEOUT_MS + GRACE_PERIOD_MS) + RECONCILER_INTERVAL
 *   = (10 + 2) + 2 = 14 minutes
 *
 * @param workerPool - MUST be the worker_app pool (BYPASSRLS). Never pass apiPool here.
 * @returns The number of orphaned jobs recovered.
 */
export async function reconcileOrphanedJobs(workerPool: Pool): Promise<number> {
  const cutoff = new Date(Date.now() - BUILD_TIMEOUT_MS - GRACE_PERIOD_MS);
  try {
    const count = await markOrphanedJobsFailed(workerPool, cutoff);
    if (count > 0) {
      console.warn(
        `[reconciler] Recovered ${count} orphaned build job(s). ` +
        `Cutoff: ${cutoff.toISOString()}`,
      );
    }
    return count;
  } catch (err) {
    // Log but do not throw — reconciler errors must not crash the API server
    console.error('[reconciler] Error during reconciliation:', err);
    return 0;
  }
}

/**
 * Starts the periodic reconciliation loop.
 * Should be called once during API server startup.
 *
 * @param workerPool - MUST be the worker_app pool (BYPASSRLS).
 * @returns A cleanup function that stops the interval.
 */
export function startReconciler(workerPool: Pool): () => void {
  // Run immediately on startup, then every RECONCILER_INTERVAL
  void reconcileOrphanedJobs(workerPool);
  const handle = setInterval(
    () => void reconcileOrphanedJobs(workerPool),
    RECONCILER_INTERVAL,
  );
  // Allow Node.js to exit even if the interval is still running
  if (handle.unref) handle.unref();
  return () => clearInterval(handle);
}
