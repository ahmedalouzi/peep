const { Pool } = require('pg');
const p = new Pool({connectionString: 'postgres://postgres:postgres@localhost:5432/peep_test'});
p.query("SELECT timestamp, estimated_cost FROM usage_records WHERE request_id = 'req-large-1'")
 .then(r => { console.table(r.rows); p.end(); });
