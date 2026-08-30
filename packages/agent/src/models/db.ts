import { Pool } from 'pg';

let poolInstance: Pool | null = null;

function getPool(): Pool {
  if (!poolInstance) {
    poolInstance = new Pool({
      connectionString: process.env.DATABASE_URL
    });
  }
  return poolInstance;
}

export function setDbPool(pool: Pool) {
  poolInstance = pool;
}

export const db = new Proxy({} as Pool, {
  get(_target, prop, _receiver) {
    const pool = getPool();
    const value = Reflect.get(pool, prop);
    if (typeof value === 'function') {
      return value.bind(pool);
    }
    return value;
  }
});

export async function initDbSchema() {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    
    // Auth tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL
      );
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_token VARCHAR(255) PRIMARY KEY,
        refresh_token VARCHAR(255) UNIQUE NOT NULL,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMP NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS rotated_refresh_tokens (
        refresh_token VARCHAR(255) PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_rotated_refresh_user ON rotated_refresh_tokens(user_id);
    `);
    
    // Rate limits (Authentication brute force protection)
    await client.query(`
      CREATE TABLE IF NOT EXISTS rate_limits (
        ip_or_email VARCHAR(255) PRIMARY KEY,
        attempts INT NOT NULL,
        window_start TIMESTAMP NOT NULL
      );
    `);
    
    // Usage accounting
    await client.query(`
      CREATE TABLE IF NOT EXISTS usage_records (
        id SERIAL PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        request_id VARCHAR(255) NOT NULL,
        model_tier VARCHAR(50) NOT NULL,
        resolved_model VARCHAR(255) NOT NULL,
        input_tokens INT NOT NULL,
        output_tokens INT NOT NULL,
        total_tokens INT NOT NULL,
        estimated_cost NUMERIC(10, 5) NOT NULL,
        status VARCHAR(50) NOT NULL,
        timestamp TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_usage_user_timestamp ON usage_records(user_id, timestamp);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_records_request_id ON usage_records(request_id);
    `);

    // Global config (e.g., kill switch)
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_config (
        key VARCHAR(255) PRIMARY KEY,
        value JSONB NOT NULL
      );
    `);
    
    // Insert default kill switch if not exists
    await client.query(`
      INSERT INTO system_config (key, value)
      VALUES ('global_kill_switch', '{"is_active": false}')
      ON CONFLICT (key) DO NOTHING;
    `);

    // Chat Threads
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_threads (
        id UUID PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_chat_threads_user ON chat_threads(user_id);
    `);

    // Chat Messages
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id UUID PRIMARY KEY,
        thread_id UUID REFERENCES chat_threads(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        tool_calls JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chat_messages(thread_id);
    `);

    // Chat Runs
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_runs (
        run_id VARCHAR(255) PRIMARY KEY,
        thread_id UUID REFERENCES chat_threads(id) ON DELETE CASCADE,
        started_at TIMESTAMP NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMP,
        status VARCHAR(50) NOT NULL,
        timeline_activities JSONB DEFAULT '[]'::jsonb,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_chat_runs_thread ON chat_runs(thread_id);
    `);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
