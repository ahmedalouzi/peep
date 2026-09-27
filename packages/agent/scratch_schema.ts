import { initDbSchema } from './src/models/db.ts';
console.log('Re-applying schema as postgres superuser...');
initDbSchema()
  .then(() => console.log('✅ Schema applied OK'))
  .catch(e => { console.error('❌ Failed:', e.message); process.exit(1); });
