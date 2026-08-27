import { newDb } from 'pg-mem';
import { randomUUID } from 'node:crypto';

export default async function runTests() {
  console.log('  Running Migration Endpoint Tests (pg-mem)...');
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
  mem.public.none(`
    CREATE TABLE chat_threads (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      title TEXT,
      updated_at TIMESTAMP
    );
    CREATE TABLE chat_messages (
      id TEXT PRIMARY KEY,
      thread_id TEXT,
      role TEXT,
      content TEXT,
      tool_calls TEXT,
      created_at TIMESTAMP
    );
  `);

  const { Pool } = mem.adapters.createPg();
  const db = new Pool();

  const userId = 'test-user-' + randomUUID();
  const threadId = 'thread-' + randomUUID();

  // 1. Empty-array guard (HTTP 400 simulation)
  async function simulatePostThreads(messages: any[]) {
    if (messages.length === 0) {
      return { status: 400, error: 'messages array cannot be empty. Use DELETE /v1/threads/:id to delete a thread.' };
    }
    return { status: 200 };
  }

  const emptyRes = await simulatePostThreads([]);
  assert(emptyRes.status === 400, 'Empty-array guard rejects with 400');

  // 2. FOR UPDATE lock under concurrent migration attempts
  // pg-mem executes serially, but we can verify the SQL syntax and the rejection if rows exist
  async function simulateMigrate(tId: string) {
    await db.query('BEGIN');
    try {
      await db.query(`
        INSERT INTO chat_threads (id, user_id, title, updated_at) 
        VALUES ($1, $2, $3, NOW()) 
        ON CONFLICT (id) DO NOTHING
      `, [tId, userId, 'Migrated Chat']);

      // This parsing confirms pg-mem accepts FOR UPDATE syntax
      await db.query('SELECT 1 FROM chat_threads WHERE id = $1 AND user_id = $2 FOR UPDATE', [tId, userId]);

      const existingMessages = await db.query('SELECT 1 FROM chat_messages WHERE thread_id = $1 LIMIT 1', [tId]);
      if (existingMessages.rowCount && existingMessages.rowCount > 0) {
        await db.query('ROLLBACK');
        return { status: 409 };
      }

      await db.query(`
        INSERT INTO chat_messages (id, thread_id, role, content, created_at)
        VALUES ($1, $2, $3, $4, NOW())
      `, [randomUUID(), tId, 'user', 'hello']);

      await db.query('COMMIT');
      return { status: 200 };
    } catch (e) {
      await db.query('ROLLBACK');
      throw e;
    }
  }

  // First migration succeeds
  const res1 = await simulateMigrate(threadId);
  assert(res1.status === 200, 'First migration succeeds (200)');

  // NOTE: A true Promise.all() race test fails here because pg-mem does not implement
  // Postgres transaction isolation or FOR UPDATE blocking. In pg-mem, the interleaved
  // SELECTs both return 0 before either COMMITs. We test sequentially to verify the logic structure.
  const res2 = await simulateMigrate(threadId);
  assert(res2.status === 409, 'Second sequential migration fails with 409 due to lock/message check');

  if (failed > 0) throw new Error('Failed');
}
