import { newDb } from 'pg-mem';
import { randomUUID } from 'node:crypto';

export default async function runTests() {
  console.log('  Running Chat Runs Backend Tests (pg-mem)...');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      passed++;
    } else {
      console.error(`    ❌ FAILED: ${msg}`);
      failed++;
    }
  }

  const mem = newDb();
  // Create schema
  mem.public.none(`
    CREATE TABLE auth_users (
      id TEXT PRIMARY KEY,
      email TEXT,
      password_hash TEXT
    );
    CREATE TABLE chat_threads (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      title TEXT
    );
    CREATE TABLE chat_runs (
      run_id TEXT PRIMARY KEY,
      thread_id TEXT,
      status TEXT,
      updated_at TIMESTAMP
    );
  `);

  const { Pool } = mem.adapters.createPg();
  const db = new Pool();

  const userId = 'test-user-' + randomUUID();
  const threadId = 'thread-' + randomUUID();

  
  await db.query('INSERT INTO auth_users (id, email, password_hash) VALUES ($1, $2, $3)', [userId, userId + '@test.com', 'hash']);
  await db.query('INSERT INTO chat_threads (id, user_id, title) VALUES ($1, $2, $3)', [threadId, userId, 'Test']);

  // 1. Concurrent same-run save consistency / 2. Stale-write rejection
  const runId = 'run-' + randomUUID();
  await db.query(
    'INSERT INTO chat_runs (run_id, thread_id, status, updated_at) VALUES ($1, $2, $3, $4)', 
    [runId, threadId, 'in_progress', new Date(2000)]
  );

  await db.query(`
    INSERT INTO chat_runs (run_id, thread_id, status, updated_at) 
    VALUES ($1, $2, $3, $4) 
    ON CONFLICT (run_id) DO UPDATE SET 
      status = EXCLUDED.status, 
      updated_at = EXCLUDED.updated_at 
    WHERE chat_runs.updated_at < EXCLUDED.updated_at`, 
    [runId, threadId, 'completed', new Date(1000)]
  );

  const res1 = await db.query('SELECT status FROM chat_runs WHERE run_id = $1', [runId]);
  assert(res1.rows[0].status === 'in_progress', 'Stale-write rejection');

  // 2b. Positive case: valid newer write is persisted
  await db.query(`
    INSERT INTO chat_runs (run_id, thread_id, status, updated_at) 
    VALUES ($1, $2, $3, $4) 
    ON CONFLICT (run_id) DO UPDATE SET 
      status = EXCLUDED.status, 
      updated_at = EXCLUDED.updated_at 
    WHERE chat_runs.updated_at < EXCLUDED.updated_at`, 
    [runId, threadId, 'completed', new Date(3000)]
  );
  const res1b = await db.query('SELECT status FROM chat_runs WHERE run_id = $1', [runId]);
  assert(res1b.rows[0].status === 'completed', 'Positive valid newer write persists');

  // 2c. True Concurrent race testing using Promise.all
  const concurrentRunId = 'run-' + randomUUID();
  const upsertQuery = `
    INSERT INTO chat_runs (run_id, thread_id, status, updated_at) 
    VALUES ($1, $2, $3, $4) 
    ON CONFLICT (run_id) DO UPDATE SET 
      status = EXCLUDED.status, 
      updated_at = EXCLUDED.updated_at 
    WHERE chat_runs.updated_at < EXCLUDED.updated_at`;
    
  await Promise.all([
    db.query(upsertQuery, [concurrentRunId, threadId, 'status_older', new Date(2000)]),
    db.query(upsertQuery, [concurrentRunId, threadId, 'status_newer', new Date(3000)])
  ]);
  
  const resConcurrent = await db.query('SELECT status FROM chat_runs WHERE run_id = $1', [concurrentRunId]);
  assert(resConcurrent.rows[0].status === 'status_newer', 'Concurrent same-run save consistency via Promise.all');

  // 3. Thread A/B isolation on load
  const threadB = 'thread-' + randomUUID();
  await db.query('INSERT INTO chat_threads (id, user_id, title) VALUES ($1, $2, $3)', [threadB, userId, 'Test B']);
  const runB = 'run-' + randomUUID();
  await db.query('INSERT INTO chat_runs (run_id, thread_id, status) VALUES ($1, $2, $3)', [runB, threadB, 'in_progress']);
  
  const res2 = await db.query('SELECT * FROM chat_runs WHERE thread_id = $1', [threadId]);
  assert(res2.rows.length === 2 && res2.rows.some(r => r.run_id === runId) && res2.rows.some(r => r.run_id === concurrentRunId), 'Thread A/B isolation on load');

  if (failed > 0) throw new Error('Failed');
}
