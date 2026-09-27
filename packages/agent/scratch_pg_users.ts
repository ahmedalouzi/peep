import { Pool } from 'pg';
const p = new Pool({ connectionString: 'postgres://postgres:postgres@localhost:5432/peep_test' });
p.query('SELECT current_user, version()')
  .then(r => { console.log(r.rows[0]); return p.end(); })
  .catch(e => { console.error('postgres/postgres failed:', e.message); return p.end(); });
