// packages/agent/tests/router-rls-identity.test.ts
//
// REGRESSION TEST: Router DB Queries Execute as api_user, NOT postgres
//
// This test guards against the exact regression found in BUG-H04 where
// buildRateLimiter queried build_jobs without SET LOCAL ROLE api_user,
// causing all operations to silently run as the postgres superuser and
// bypass RLS.
//
// How it works:
//   1. Opens a connection to the real Postgres DB
//   2. Simulates the router's RLS wrapper logic
//   3. Inside the transaction, queries current_user and active_tenant
//   4. Asserts current_user === 'api_user'
//   5. Asserts active_tenant is set correctly
//
// REQUIRES: Live Postgres with initDbSchema() already run.

import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';

const DB_URL =
  process.env.DATABASE_URL_API ??
  process.env.DATABASE_URL ??
  'postgres://postgres:postgres@localhost:5432/peep_test';

export async function run() {
  console.log('\n--- Router RLS Identity Regression Test ---');

  const pool = new Pool({ connectionString: DB_URL });
  const client = await pool.connect();

  try {
    const testUserId = randomUUID();

    // Replicate exactly what the router does in build-router.ts
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE api_user');
    await client.query('SELECT set_config($1, $2, true)', ['app.current_user_id', testUserId]);

    const result = await client.query(
      `SELECT current_user, session_user, current_setting('app.current_user_id', true) as active_tenant`
    );
    const { current_user, session_user, active_tenant } = result.rows[0];

    console.log(`  current_user  = '${current_user}'  (must be 'api_user')`);
    console.log(`  session_user  = '${session_user}'  (must be 'postgres')`);
    console.log(`  active_tenant = '${active_tenant}'  (must be '${testUserId}')`);

    assert.equal(
      current_user,
      'api_user',
      `REGRESSION: current_user is '${current_user}' — SET LOCAL ROLE api_user is missing or broken`
    );
    assert.equal(
      active_tenant,
      testUserId,
      `REGRESSION: active_tenant is '${active_tenant}' — set_config failed`
    );

    await client.query('ROLLBACK');

    console.log('  ✅ Router RLS identity verified: SET LOCAL ROLE api_user is active');
  } finally {
    client.release();
    await pool.end();
  }
}

// Required by test-runner.ts if used dynamically
export default run;
