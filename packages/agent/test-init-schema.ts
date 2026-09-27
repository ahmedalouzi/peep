import { initDbSchema } from './src/models/db.js';
import { Pool } from 'pg';

process.env.DATABASE_URL = 'postgres://testuser:testpass@localhost:5432/peep_test';

async function main() {
  try {
    console.log('Running initDbSchema() as testuser...');
    await initDbSchema();
    console.log('✅ initDbSchema() ran successfully without SUPERUSER privileges.');
  } catch (err) {
    console.error('❌ Failed to run initDbSchema() as testuser:', err);
    process.exit(1);
  }
}

main();
