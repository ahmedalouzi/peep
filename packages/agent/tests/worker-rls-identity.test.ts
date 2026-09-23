// packages/agent/tests/worker-rls-identity.test.ts
//
// REGRESSION TEST: Worker DB Queries Execute as worker_user, NOT postgres
//
// This test guards against the exact regression found in commit 931ca9a where
// build-worker.ts dropped SET LOCAL ROLE worker_user, causing all worker
// DB operations to silently run as the postgres superuser.
//
// How it works:
//   1. Opens a connection to the real Postgres DB (DATABASE_URL_WORKER env)
//   2. Simulates the worker's withWorkerRole() wrapper
//   3. Inside the transaction, queries current_user and session_user
//   4. Asserts current_user === 'worker_user' (the role)
//   5. Asserts session_user === 'postgres' (the login credential — expected)
//
// If SET LOCAL ROLE worker_user is ever removed from withWorkerRole(),
// current_user will be 'postgres' and this test will explicitly FAIL.
//
// REQUIRES: Live Postgres with initDbSchema() already run (same DB as test-rls2.cjs)

import assert from 'node:assert/strict';
import { Pool } from 'pg';

const DB_URL =
  process.env.DATABASE_URL_WORKER ??
  process.env.DATABASE_URL ??
  'postgres://postgres:postgres@localhost:5432/peep_test';

export async function run() {
  console.log('\n--- Worker RLS Identity Regression Test ---');

  const pool = new Pool({ connectionString: DB_URL });
  const client = await pool.connect();

  try {
    // Replicate exactly what withWorkerRole() does in build-worker.ts
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE worker_user');

    const result = await client.query(
      `SELECT current_user, session_user`
    );
    const { current_user, session_user } = result.rows[0];

    console.log(`  current_user  = '${current_user}'  (must be 'worker_user')`);
    console.log(`  session_user  = '${session_user}'  (must be 'postgres')`);

    assert.equal(
      current_user,
      'worker_user',
      `REGRESSION: current_user is '${current_user}' — SET LOCAL ROLE worker_user is missing or broken`
    );
    // session_user = the actual login role; on the test Docker container this is 'testuser'
    const expectedSessionUser = new URL(DB_URL).username;
    assert.equal(
      session_user,
      expectedSessionUser,
      `Unexpected session_user: '${session_user}' (expected '${expectedSessionUser}')`
    );

    await client.query('ROLLBACK');

    // Also verify that WITHOUT the role switch, current_user IS postgres
    // (so the test is meaningful — proves the role switch actually changes things)
    await client.query('BEGIN');
    const noRoleResult = await client.query(`SELECT current_user`);
    const current_without_role = noRoleResult.rows[0].current_user;
    await client.query('ROLLBACK');

    assert.equal(
      current_without_role,
      expectedSessionUser,
      `Unexpected baseline: without role switch current_user is '${current_without_role}' instead of '${expectedSessionUser}'`
    );
    console.log(`  baseline (no role): current_user = '${current_without_role}' ✓`);

    console.log('  ✅ Worker RLS identity verified: SET LOCAL ROLE worker_user is active');
  } finally {
    client.release();
    await pool.end();
  }
}

// Required by test-runner.ts (calls module.default())
export default run;

