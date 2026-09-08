import { config } from 'dotenv';
import * as url from 'node:url';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
config({ path: path.resolve(__dirname, '../../../.env') });
import AdmZip from 'adm-zip';
import { db, initDbSchema } from '../src/models/db';
import { startBuildWorker } from '../src/models/build-worker';
import crypto from 'node:crypto';

async function runE2E() {
  console.log('--- Starting Cloud Build E2E Test ---');
  
  // 1. Ensure DB is connected
  console.log('[TEST] Checking and initializing database schema...');
  await initDbSchema();

  // 2. Start the worker
  console.log('[TEST] Starting Build Worker...');
  startBuildWorker();

  // 3. Create a dummy project zip
  console.log('[TEST] Creating dummy zip payload...');
  const zip = new AdmZip();
  zip.addFile('dummy.txt', Buffer.from('This is a dummy file to test the cloud build pipeline.'));
  const zipBuffer = zip.toBuffer();
  
  // Ensure /tmp exists (especially on Windows where it might be C:/tmp, but since we are in WSL/node it usually works, or we use os.tmpdir)
  const os = await import('node:os');
  const tmpPath = path.join(os.tmpdir(), `dummy_project_${Date.now()}.zip`);
  await fs.writeFile(tmpPath, zipBuffer);

  // We must execute queries as the api_user or worker_user. For simplicity in tests, we can just use the db pool but set the context.
  // 4. Inject into the database (simulating the POST /upload endpoint)
  console.log('[TEST] Injecting job into build_jobs table...');
  const userId = crypto.randomUUID();
  await db.query(`
    INSERT INTO users (id, email, password_hash)
    VALUES ($1, $2, 'dummyhash')
    ON CONFLICT DO NOTHING
  `, [userId, `e2e_${Date.now()}@test.com`]);

  const dbClient = await db.connect();
  let jobId: string;
  try {
    await dbClient.query('BEGIN');
    // SECURITY CRITICAL: The base connection authenticates as the postgres superuser.
    // RLS protection depends ENTIRELY on this line being present. If forgotten, 
    // the endpoint silently loses all tenant isolation and fails open.
    await dbClient.query('SET LOCAL ROLE api_user');
    await dbClient.query('SELECT set_config($1, $2, true)', ['app.current_user_id', userId]);
    const result = await dbClient.query(`
      INSERT INTO build_jobs (user_id, project_id, status, source_path)
      VALUES ($1, 'e2e_test_project', 'queued', $2)
      RETURNING id
    `, [userId, tmpPath]);
    jobId = result.rows[0].id;
    await dbClient.query('COMMIT');
  } catch (e) {
    await dbClient.query('ROLLBACK');
    throw e;
  } finally {
    dbClient.release();
  }

  console.log(`[TEST] Job injected with ID: ${jobId}`);

  // 5. Poll the database to monitor state transitions
  console.log('[TEST] Polling database for state changes...');
  let currentStatus = 'queued';
  
  const pollInterval = setInterval(async () => {
    // Poll as worker (BYPASSRLS) or user (requires SET LOCAL)
    // Here we query as admin/worker so we just bypass
    const jobRes = await db.query(`SELECT status, error_log, artifact_url FROM build_jobs WHERE id = $1`, [jobId]);
    if (jobRes.rows.length === 0) return;
    
    const job = jobRes.rows[0];
    if (job.status !== currentStatus) {
      console.log(`[TEST] Job state changed: ${currentStatus} -> ${job.status}`);
      currentStatus = job.status;
    }

    if (currentStatus === 'success' || currentStatus === 'failed') {
      clearInterval(pollInterval);
      console.log('--- E2E Test Finished ---');
      console.log(`Final Status: ${currentStatus}`);
      console.log(`Artifact URL: ${job.artifact_url}`);
      console.log(`\n--- Error Logs ---\n${job.error_log}`);
      
      console.log('\n[TEST] Cleaning up test data...');
      await db.query(`DELETE FROM build_jobs WHERE id = $1`, [jobId]);
      await db.query(`DELETE FROM users WHERE id = $1`, [userId]);
      await fs.rm(tmpPath, { force: true });
      process.exit(currentStatus === 'success' || currentStatus === 'failed' ? 0 : 1);
    }
  }, 1000);
}

runE2E().catch(err => {
  console.error('[TEST ERROR]', err);
  process.exit(1);
});
