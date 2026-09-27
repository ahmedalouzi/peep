// packages/cloud-build/src/job-store.ts
// Postgres data access layer for build_jobs.
//
// TWO CONNECTION POOLS — callers must use the correct one:
//
//   apiPool    → DATABASE_URL_API    (api_app role, RLS enforced)
//              → Used by: API server request handlers (create, cancel, get status)
//
//   workerPool → DATABASE_URL_WORKER (worker_app role, BYPASSRLS)
//              → Used by: Worker claiming loop, reconciler
//              → NEVER used for user-facing queries
//
// The split is deliberate. The worker pool BYPASSRLS access cannot be accidentally
// used for a user-facing query because the two pools are never interchangeable here.

import type { Pool } from 'pg';
import type {
  BuildJobRow,
  ClaimResult,
  CompleteJobOptions,
  CreateJobOptions,
} from './types.js';

const LOG_MAX_BYTES = 50_000;  // 50 KB error log cap

// ── Helper ────────────────────────────────────────────────────────────────────

function truncateLog(log: string): string {
  if (Buffer.byteLength(log, 'utf8') <= LOG_MAX_BYTES) return log;
  // Truncate from the front (keep the most recent output)
  const buf = Buffer.from(log, 'utf8');
  return '... [truncated] ...\n' + buf.slice(buf.length - LOG_MAX_BYTES).toString('utf8');
}

// ── API-layer operations (use apiPool) ────────────────────────────────────────

/**
 * Creates a new build job in 'queued' state.
 * Called by the API server via api_app role (RLS enforced).
 * The caller must have SET LOCAL app.current_user_id before calling.
 *
 * Enforces per-user concurrency cap of 2 active (queued + running) jobs.
 * Returns null if cap is already reached.
 */
export async function createJob(
  pool: Pool,
  opts: CreateJobOptions,
): Promise<BuildJobRow | null> {
  const client = await pool.connect();
  try {
    // Set RLS context for this transaction
    await client.query(`SET LOCAL app.current_user_id = '${opts.userId}'`);

    // Concurrency cap check: reject if user has >= 2 active jobs
    const capCheck = await client.query<{ count: string }>(
      `SELECT COUNT(*)::TEXT AS count FROM build_jobs
       WHERE user_id = $1 AND status IN ('queued', 'running')`,
      [opts.userId],
    );
    if (parseInt(capCheck.rows[0]?.count ?? '0', 10) >= 2) {
      return null;  // Caller should return HTTP 429
    }

    const result = await client.query<BuildJobRow>(
      `INSERT INTO build_jobs
         (user_id, project_id, framework, target, version_name, version_code)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [opts.userId, opts.projectId, opts.framework, opts.target,
       opts.versionName, opts.versionCode],
    );
    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
}

/**
 * Cancels a job (queued → cancelled OR running → cancelled).
 * Called ONLY by the cancel endpoint via api_app role.
 * This is the ONLY code path that exercises the api_user UPDATE(status) grant.
 * It ONLY ever writes 'cancelled' — no other status value is passed here.
 *
 * The caller must have SET LOCAL app.current_user_id (RLS enforces ownership).
 */
export async function cancelJob(
  pool: Pool,
  jobId: string,
  userId: string,
): Promise<BuildJobRow | null> {
  const client = await pool.connect();
  try {
    await client.query(`SET LOCAL app.current_user_id = '${userId}'`);
    const result = await client.query<BuildJobRow>(
      `UPDATE build_jobs
       SET status = 'cancelled'           -- ONLY value ever written via this grant
       WHERE id = $1
         AND user_id = $2
         AND status IN ('queued', 'running')  -- Only cancel active jobs
       RETURNING *`,
      [jobId, userId],
    );
    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
}

/**
 * Returns a single job for a user. RLS enforces ownership.
 */
export async function getJob(
  pool: Pool,
  jobId: string,
  userId: string,
): Promise<BuildJobRow | null> {
  const client = await pool.connect();
  try {
    await client.query(`SET LOCAL app.current_user_id = '${userId}'`);
    const result = await client.query<BuildJobRow>(
      `SELECT * FROM build_jobs WHERE id = $1 AND user_id = $2`,
      [jobId, userId],
    );
    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
}

/**
 * Lists all jobs for a user, most recent first.
 */
export async function listJobs(
  pool: Pool,
  userId: string,
  limit = 20,
): Promise<BuildJobRow[]> {
  const client = await pool.connect();
  try {
    await client.query(`SET LOCAL app.current_user_id = '${userId}'`);
    const result = await client.query<BuildJobRow>(
      `SELECT * FROM build_jobs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [userId, limit],
    );
    return result.rows;
  } finally {
    client.release();
  }
}

// ── Worker operations (use workerPool — BYPASSRLS) ────────────────────────────

/**
 * Atomically claims the next queued job across ALL users.
 * MUST be called with the workerPool (worker_app role, BYPASSRLS).
 * Uses FOR UPDATE SKIP LOCKED to prevent double-claiming with multiple workers.
 */
export async function claimNextJob(
  workerPool: Pool,
  workerId: string,
  containerId: string,
): Promise<ClaimResult> {
  const result = await workerPool.query<BuildJobRow>(
    `WITH next_job AS (
       SELECT id FROM build_jobs
       WHERE status = 'queued'
       ORDER BY created_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED
     )
     UPDATE build_jobs
     SET status       = 'running',
         started_at   = now(),
         worker_id    = $1,
         container_id = $2
     WHERE id = (SELECT id FROM next_job)
     RETURNING *`,
    [workerId, containerId],
  );
  return result.rows[0] ?? null;
}

/**
 * Marks a job as successfully completed.
 * MUST be called with the workerPool.
 */
export async function completeJob(
  workerPool: Pool,
  jobId: string,
  opts: CompleteJobOptions,
): Promise<void> {
  await workerPool.query(
    `UPDATE build_jobs
     SET status              = 'success',
         completed_at        = now(),
         build_duration_ms   = EXTRACT(EPOCH FROM (now() - started_at)) * 1000,
         artifact_url        = $2,
         artifact_size_bytes = $3
     WHERE id = $1`,
    [jobId, opts.artifactUrl, opts.artifactSizeBytes],
  );
}

/**
 * Marks a job as failed with an error log.
 * MUST be called with the workerPool.
 */
export async function failJob(
  workerPool: Pool,
  jobId: string,
  errorLog: string,
): Promise<void> {
  await workerPool.query(
    `UPDATE build_jobs
     SET status            = 'failed',
         completed_at      = now(),
         build_duration_ms = EXTRACT(EPOCH FROM (now() - started_at)) * 1000,
         error_log         = $2
     WHERE id = $1`,
    [jobId, truncateLog(errorLog)],
  );
}

/**
 * Checks if a job has been cancelled by the user (polled by the worker mid-build).
 * MUST be called with the workerPool.
 */
export async function isJobCancelled(
  workerPool: Pool,
  jobId: string,
): Promise<boolean> {
  const result = await workerPool.query<{ status: string }>(
    `SELECT status FROM build_jobs WHERE id = $1`,
    [jobId],
  );
  return result.rows[0]?.status === 'cancelled';
}

/**
 * Returns jobs stuck in 'running' for longer than the given cutoff date.
 * Used by the reconciler. MUST be called with the workerPool.
 */
export async function findOrphanedJobs(
  workerPool: Pool,
  cutoff: Date,
): Promise<BuildJobRow[]> {
  const result = await workerPool.query<BuildJobRow>(
    `SELECT * FROM build_jobs
     WHERE status = 'running'
       AND started_at < $1`,
    [cutoff.toISOString()],
  );
  return result.rows;
}

/**
 * Bulk-marks orphaned jobs as failed.
 * Used by the reconciler. MUST be called with the workerPool.
 * Returns the number of rows updated.
 */
export async function markOrphanedJobsFailed(
  workerPool: Pool,
  cutoff: Date,
): Promise<number> {
  const result = await workerPool.query(
    `UPDATE build_jobs
     SET status            = 'failed',
         completed_at      = now(),
         error_log         = 'Build orphaned: worker process crashed or was killed. ' ||
                             'Job was running on worker ' || COALESCE(worker_id, 'unknown') ||
                             ' since ' || started_at::TEXT || '. ' ||
                             'Auto-recovered by reconciliation job.'
     WHERE status = 'running'
       AND started_at < $1`,
    [cutoff.toISOString()],
  );
  return result.rowCount ?? 0;
}

// ── Schema helpers (test/init use only) ──────────────────────────────────────

/**
 * Applies the build_jobs schema to the given pool.
 * Used by tests and initial setup. Not called in production (use proper migrations).
 */
export async function initBuildSchema(pool: Pool): Promise<void> {
  await pool.query(`
    DO $$ BEGIN
      CREATE TYPE build_framework AS ENUM ('flutter', 'react-native');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      CREATE TYPE build_status AS ENUM ('queued', 'running', 'success', 'failed', 'cancelled');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    CREATE TABLE IF NOT EXISTS build_jobs (
      id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id             UUID        NOT NULL,
      project_id          TEXT        NOT NULL,
      framework           build_framework NOT NULL,
      target              TEXT        NOT NULL DEFAULT 'apk',
      status              build_status NOT NULL DEFAULT 'queued',
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      started_at          TIMESTAMPTZ,
      completed_at        TIMESTAMPTZ,
      build_duration_ms   INTEGER,
      artifact_url        TEXT,
      artifact_size_bytes BIGINT,
      error_log           TEXT,
      worker_id           TEXT,
      container_id        TEXT,
      version_name        TEXT        NOT NULL DEFAULT '1.0.0',
      version_code        INTEGER     NOT NULL DEFAULT 1,
      keystore_secret_id  TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_build_jobs_user_id
      ON build_jobs(user_id);
    CREATE INDEX IF NOT EXISTS idx_build_jobs_status
      ON build_jobs(status) WHERE status IN ('queued', 'running');
    CREATE INDEX IF NOT EXISTS idx_build_jobs_created_at
      ON build_jobs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_build_jobs_stuck
      ON build_jobs(started_at) WHERE status = 'running';
  `);
}

/**
 * Drops the build_jobs table and types. Used for test teardown.
 */
export async function dropBuildSchema(pool: Pool): Promise<void> {
  await pool.query(`
    DROP TABLE IF EXISTS build_jobs CASCADE;
    DROP TYPE  IF EXISTS build_status CASCADE;
    DROP TYPE  IF EXISTS build_framework CASCADE;
  `);
}
