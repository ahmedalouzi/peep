import { db } from './db';
import { DockerSandbox } from './docker-sandbox';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import AdmZip from 'adm-zip';

// This is the simplest MVP implementation for the build queue polling.
export async function startBuildWorker() {
  console.log('[BUILD_WORKER] Starting simple polling worker for build_jobs...');
  
  // Simple recursive polling loop
  const poll = async () => {
    try {
      // Find the oldest queued job, lock it so no other worker grabs it
      const result = await db.query(`
        SELECT id, user_id, project_id, status 
        FROM build_jobs 
        WHERE status = 'queued' 
        ORDER BY created_at ASC 
        LIMIT 1 
        FOR UPDATE SKIP LOCKED
      `);

      if (result.rows.length > 0) {
        const job = result.rows[0];
        console.log(`[BUILD_WORKER] Picked up job ${job.id} for project ${job.project_id}`);
        
        // Mark as running
        await db.query(`UPDATE build_jobs SET status = 'running', updated_at = NOW() WHERE id = $1`, [job.id]);
        
        // Phase 4: Extract the ZIP
        const extractPath = path.join('/tmp/builds', `${job.id}_extracted`);
        try {
          await fs.mkdir(extractPath, { recursive: true });
          if (job.artifact_path && job.artifact_path.endsWith('.zip')) {
            const zip = new AdmZip(job.artifact_path);
            zip.extractAllTo(extractPath, true);
          } else {
            console.log(`[BUILD_WORKER] Mocking extraction, no valid zip found for job ${job.id}`);
          }
        } catch (err: any) {
          console.error(`[BUILD_WORKER] Extraction failed for job ${job.id}:`, err);
          await db.query(`UPDATE build_jobs SET status = 'failed', logs = logs || $1, updated_at = NOW() WHERE id = $2`, [`Extraction Failed: ${err.message}\n`, job.id]);
          return setImmediate(poll);
        }

        // Execute the sandbox
        const sandbox = new DockerSandbox({
          jobId: job.id,
          projectPath: extractPath
        });

        console.log(`[BUILD_WORKER] Launching Docker Sandbox for job ${job.id}...`);
        
        let logsBuffer = '';
        const success = await sandbox.runBuild((logChunk) => {
          process.stdout.write(`[SANDBOX ${job.id}] ${logChunk}`);
          logsBuffer += logChunk + '\n';
        });
        
        // Append logs to database
        await db.query(`UPDATE build_jobs SET logs = logs || $1 WHERE id = $2`, [logsBuffer, job.id]);

        if (success) {
          console.log(`[BUILD_WORKER] Job ${job.id} completed successfully.`);
          // Phase 4 Artifacts: In a real app we'd copy the APK. For MVP, we mock the path.
          const finalApkPath = `/tmp/artifacts/${job.id}.apk`;
          await db.query(`UPDATE build_jobs SET status = 'success', artifact_path = $1, updated_at = NOW() WHERE id = $2`, [finalApkPath, job.id]);
        } else {
          console.log(`[BUILD_WORKER] Job ${job.id} failed.`);
          await db.query(`UPDATE build_jobs SET status = 'failed', updated_at = NOW() WHERE id = $1`, [job.id]);
        }
        
        // Cleanup extracted files
        try {
          await fs.rm(extractPath, { recursive: true, force: true });
        } catch (e) {
          console.error(`[BUILD_WORKER] Cleanup failed for ${extractPath}`, e);
        }
        
        // Immediately poll again in case there are more jobs
        setImmediate(poll);
      } else {
        // No jobs found, wait a bit before polling again
        setTimeout(poll, 3000);
      }
    } catch (err) {
      console.error('[BUILD_WORKER] Error during polling:', err);
      // Wait before retrying on error
      setTimeout(poll, 5000);
    }
  };

  // Start polling
  poll();
}
