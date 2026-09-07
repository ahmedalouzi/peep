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

  // 4. Inject into the database (simulating the POST /upload endpoint)
  console.log('[TEST] Injecting job into build_jobs table...');
  // We need a dummy user_id
  const userId = crypto.randomUUID();
  await db.query(`
    INSERT INTO users (id, email, password_hash)
    VALUES ($1, $2, 'dummyhash')
    ON CONFLICT DO NOTHING
  `, [userId, `e2e_${Date.now()}@test.com`]);

  const result = await db.query(`
    INSERT INTO build_jobs (user_id, project_id, status, artifact_path)
    VALUES ($1, 'e2e_test_project', 'queued', $2)
    RETURNING id
  `, [userId, tmpPath]);

  const jobId = result.rows[0].id;
  console.log(`[TEST] Job injected with ID: ${jobId}`);

  // 5. Poll the database to monitor state transitions
  console.log('[TEST] Polling database for state changes...');
  let currentStatus = 'queued';
  
  const pollInterval = setInterval(async () => {
    const jobRes = await db.query(`SELECT status, logs, artifact_path FROM build_jobs WHERE id = $1`, [jobId]);
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
      console.log(`Artifact Path: ${job.artifact_path}`);
      console.log(`\n--- Docker Logs ---\n${job.logs}`);
      
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
