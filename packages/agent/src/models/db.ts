import { Pool } from 'pg';

// Using connection string from environment (e.g. from AWS Secrets Manager or local .env)
export const db = new Pool({
  connectionString: process.env.DATABASE_URL
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

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
