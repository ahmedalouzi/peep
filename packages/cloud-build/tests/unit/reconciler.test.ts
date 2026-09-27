// packages/cloud-build/tests/unit/reconciler.test.ts
// Unit tests for the reconciler module.
// Tests against real Postgres. No Docker required.

import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { initBuildSchema, dropBuildSchema } from '../../src/job-store.js';
import {
  reconcileOrphanedJobs,
  BUILD_TIMEOUT_MS,
  GRACE_PERIOD_MS,
} from '../../src/reconciler.js';

const DB_URL = process.env.DATABASE_URL_WORKER
  ?? 'postgres://testuser:testpass@localhost:5432/peep_test';

const USER_A = '00000000-0000-0000-0000-000000000001';

export default async function run() {
  const pool = new Pool({ connectionString: DB_URL });

  try {
    await dropBuildSchema(pool);
    await initBuildSchema(pool);

    // ── Test 1: Orphaned job (older than timeout + grace) must be recovered ───

    await pool.query(`
      INSERT INTO build_jobs (user_id, project_id, framework, status, started_at, worker_id)
      VALUES ($1, 'stuck-proj', 'flutter', 'running',
              now() - interval '13 minutes',
              'crashed-worker-host')
    `, [USER_A]);

    const count1 = await reconcileOrphanedJobs(pool);
    assert.equal(count1, 1, 'Recovered 1 orphaned job');

    const { rows: stuckRows } = await pool.query(`
      SELECT status, error_log, completed_at
      FROM build_jobs WHERE project_id = 'stuck-proj' AND user_id = $1
    `, [USER_A]);

    assert.equal(stuckRows[0]?.status, 'failed', 'Orphaned job status is now failed');
    assert.ok(stuckRows[0]?.completed_at, 'completed_at is set by reconciler');
    assert.ok(stuckRows[0]?.error_log?.includes('orphaned'), 'Error log contains "orphaned"');
    assert.ok(stuckRows[0]?.error_log?.includes('crashed-worker-host'), 'Error log includes worker_id');
    assert.ok(stuckRows[0]?.error_log?.includes('Auto-recovered'), 'Error log mentions auto-recovery');
    console.log('  ✓ Orphaned job (13 min old) recovered with correct error log');

    // ── Test 2: Active job within timeout must NOT be touched ─────────────────

    await pool.query(`
      INSERT INTO build_jobs (user_id, project_id, framework, status, started_at, worker_id)
      VALUES ($1, 'active-proj', 'react-native', 'running',
              now() - interval '9 minutes',
              'live-worker-host')
    `, [USER_A]);

    const count2 = await reconcileOrphanedJobs(pool);
    assert.equal(count2, 0, 'Active job (9 min old) is NOT recovered');

    const { rows: activeRows } = await pool.query(`
      SELECT status FROM build_jobs WHERE project_id = 'active-proj' AND user_id = $1
    `, [USER_A]);
    assert.equal(activeRows[0]?.status, 'running', 'Active job still running');
    console.log('  ✓ Active job (9 min old) not touched by reconciler');

    // ── Test 3: Job exactly at the cutoff boundary ────────────────────────────

    // (BUILD_TIMEOUT_MS + GRACE_PERIOD_MS) / 60000 = 12 minutes
    // A job that started exactly 12 minutes ago is on the boundary:
    //   cutoff = now() - 12min, job started_at = now() - 12min
    //   WHERE started_at < cutoff → boundary job is NOT included (strict <)
    const graceMins = (BUILD_TIMEOUT_MS + GRACE_PERIOD_MS) / 60000;
    await pool.query(`
      INSERT INTO build_jobs (user_id, project_id, framework, status, started_at, worker_id)
      VALUES ($1, 'boundary-proj', 'flutter', 'running',
              now() - ($2 || ' minutes')::interval,
              'boundary-worker')
    `, [USER_A, graceMins]);

    const count3 = await reconcileOrphanedJobs(pool);
    // Boundary job may or may not be caught depending on ms-level timing
    // Just assert it doesn't crash and active/terminal jobs are untouched
    assert.ok(count3 === 0 || count3 === 1, 'Boundary job handled gracefully (0 or 1)');
    console.log(`  ✓ Boundary job handled gracefully (recovered: ${count3})`);

    // ── Test 4: Terminal-state jobs are never touched ─────────────────────────

    await pool.query(`
      INSERT INTO build_jobs (user_id, project_id, framework, status, started_at, completed_at)
      VALUES
        ($1, 'success-old', 'flutter', 'success',  now() - interval '2 hours', now() - interval '1 hour 50 minutes'),
        ($1, 'failed-old',  'flutter', 'failed',   now() - interval '2 hours', now() - interval '1 hour 50 minutes'),
        ($1, 'cancel-old',  'flutter', 'cancelled', now() - interval '2 hours', now() - interval '1 hour 50 minutes')
    `, [USER_A]);

    const count4 = await reconcileOrphanedJobs(pool);
    assert.equal(count4, 0, 'Terminal-state jobs are never recovered');

    for (const projectId of ['success-old', 'failed-old', 'cancel-old']) {
      const { rows } = await pool.query(`
        SELECT status FROM build_jobs WHERE project_id = $1 AND user_id = $2
      `, [projectId, USER_A]);
      assert.ok(rows[0]?.status !== 'running', `${projectId} status unchanged`);
    }
    console.log('  ✓ Terminal-state jobs untouched by reconciler');

    // ── Test 5: Reconciler errors are swallowed (does not crash caller) ───────

    // Pass a pool with a bad connection string to simulate DB error
    const badPool = new Pool({ connectionString: 'postgres://bad:bad@localhost:9999/bad', connectionTimeoutMillis: 500 });
    const countBad = await reconcileOrphanedJobs(badPool);  // Must not throw
    assert.equal(countBad, 0, 'Reconciler swallows DB errors and returns 0');
    await badPool.end().catch(() => {});
    console.log('  ✓ Reconciler swallows errors (does not crash API server)');

    console.log('\n  All reconciler tests passed.');

  } finally {
    await dropBuildSchema(pool).catch(() => {});
    await pool.end();
  }
}
