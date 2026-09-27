import { db } from '@peep/agent/server';

async function testRLS() {
  const client = await db.connect();
  try {
    // 1. Create two users as superuser
    await client.query('BEGIN');
    const userAResult = await client.query(`INSERT INTO users (id, email, password_hash) VALUES (gen_random_uuid(), 'usera@test.com', 'hash') RETURNING id`);
    const userBResult = await client.query(`INSERT INTO users (id, email, password_hash) VALUES (gen_random_uuid(), 'userb@test.com', 'hash') RETURNING id`);
    const userA = userAResult.rows[0].id;
    const userB = userBResult.rows[0].id;
    await client.query('COMMIT');

    const threadId = '00000000-0000-0000-0000-000000000001';

    // 2. Insert as User A
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE api_user');
    await client.query('SELECT set_config($1, $2, true)', ['app.current_user_id', userA]);
    await client.query(`
      INSERT INTO chat_threads (id, user_id, title)
      VALUES ($1, $2, 'Title A')
      ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, updated_at = NOW()
    `, [threadId, userA]);
    await client.query('COMMIT');

    console.log('Successfully inserted as User A');

    // 3. Try to overwrite as User B
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE api_user');
    await client.query('SELECT set_config($1, $2, true)', ['app.current_user_id', userB]);
    
    try {
      await client.query(`
        INSERT INTO chat_threads (id, user_id, title)
        VALUES ($1, $2, 'Title B')
        ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, updated_at = NOW()
      `, [threadId, userB]);
      console.log('Query succeeded! Did it overwrite?');
    } catch (e: any) {
      console.log('Query threw an error as expected:', e.message);
    }
    await client.query('COMMIT');

    // 4. Verify what happened as superuser
    const checkResult = await client.query('SELECT user_id, title FROM chat_threads WHERE id = $1', [threadId]);
    console.log('Final Database State:', checkResult.rows[0]);

  } finally {
    client.release();
    process.exit(0);
  }
}

testRLS().catch(console.error);
