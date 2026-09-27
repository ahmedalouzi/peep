const { Pool } = require('pg');
const crypto = require('crypto');

async function run() {
  const adminPool = new Pool({ connectionString: 'postgresql://postgres@localhost:5432/peep' });
  const adminClient = await adminPool.connect();

  try {
    const userA = crypto.randomUUID();
    const userB = crypto.randomUUID();

    // 1. Insert two build_jobs rows directly with different user_id values
    console.log('\n--- 1. Test Setup (Superuser) ---');
    await adminClient.query(`
      INSERT INTO users (id, email, password_hash) VALUES 
      ('${userA}', 'a@test.com', 'x'),
      ('${userB}', 'b@test.com', 'x')
      ON CONFLICT DO NOTHING;
    `);
    await adminClient.query(`INSERT INTO build_jobs (user_id, project_id, status) VALUES ($1, 'project_A', 'queued')`, [userA]);
    await adminClient.query(`INSERT INTO build_jobs (user_id, project_id, status) VALUES ($1, 'project_B', 'queued')`, [userB]);
    console.log(`Inserted Job for User A (${userA})`);
    console.log(`Inserted Job for User B (${userB})`);

    // 2. As api_user with User A's session
    console.log('\n--- 2. Querying as api_user (Tenant A) ---');
    await adminClient.query('BEGIN');
    await adminClient.query('SET LOCAL ROLE api_user');
    await adminClient.query('SELECT set_config($1, $2, true)', ['app.current_user_id', userA]);
    let resA = await adminClient.query("SELECT user_id, project_id FROM build_jobs WHERE project_id IN ('project_A', 'project_B')");
    console.log('Result for User A:', resA.rows);
    await adminClient.query('COMMIT');

    // 3. As api_user with User B's session
    console.log('\n--- 3. Querying as api_user (Tenant B) ---');
    await adminClient.query('BEGIN');
    await adminClient.query('SET LOCAL ROLE api_user');
    await adminClient.query('SELECT set_config($1, $2, true)', ['app.current_user_id', userB]);
    let resB = await adminClient.query("SELECT user_id, project_id FROM build_jobs WHERE project_id IN ('project_A', 'project_B')");
    console.log('Result for User B:', resB.rows);
    await adminClient.query('COMMIT');

    // 4. As api_user with NO app.current_user_id set
    console.log('\n--- 4. Querying as api_user (No context set) ---');
    await adminClient.query('BEGIN');
    await adminClient.query('SET LOCAL ROLE api_user');
    let resNone = await adminClient.query("SELECT user_id, project_id FROM build_jobs WHERE project_id IN ('project_A', 'project_B')");
    console.log('Result with No Context:', resNone.rows);
    await adminClient.query('COMMIT');

    // 5. As worker_user (BYPASSRLS)
    console.log('\n--- 5. Querying as worker_user (BYPASSRLS) ---');
    await adminClient.query('BEGIN');
    await adminClient.query('SET LOCAL ROLE worker_user');
    let resWorker = await adminClient.query("SELECT user_id, project_id FROM build_jobs WHERE project_id IN ('project_A', 'project_B')");
    console.log('Result for worker_user:', resWorker.rows);
    await adminClient.query('COMMIT');

    // 6. Router Identity verification
    console.log('\n--- 6. Router INSERT Identity Check ---');
    await adminClient.query('BEGIN');
    await adminClient.query('SET LOCAL ROLE api_user');
    await adminClient.query('SELECT set_config($1, $2, true)', ['app.current_user_id', userA]);
    let identity = await adminClient.query(`SELECT current_user, session_user, current_setting('app.current_user_id', true) as active_tenant`);
    console.log('Connection Identity just before INSERT:', identity.rows[0]);
    await adminClient.query('COMMIT');

  } finally {
    adminClient.release();
    adminPool.end();
  }
}

run().catch(console.error);
