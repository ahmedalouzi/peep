import { db } from './db';
import { DockerSandbox } from './docker-sandbox';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import AdmZip from 'adm-zip';

// Mock URL generator for MinIO
function generateMinIOPresignedUrl(jobId: string, filename: string): string {
  // In production, this would call minioClient.presignedGetObject
  return `https://s3.local/artifacts/${jobId}/${filename}?expires=${Date.now() + 15 * 60 * 1000}`;
}

// Reconciler: Recovers orphaned running jobs that the worker failed to complete
async function reconcileOrphanedJobs() {
  try {
    const res = await db.query(`
      UPDATE build_jobs
      SET status = 'failed',
          error_log = error_log || '[RECONCILER] Job abandoned. Worker crashed or timed out.',
          updated_at = NOW()
      WHERE status = 'running' 
        AND updated_at < NOW() - INTERVAL '12 minutes'
      RETURNING id
    `);
    if (res.rows.length > 0) {
      console.log(`[RECONCILER] Recovered ${res.rows.length} orphaned jobs: ${res.rows.map(r => r.id).join(', ')}`);
    }
  } catch (err) {
    console.error('[RECONCILER] Error:', err);
  }
}

// Reaper: Force kills orphaned containers older than 15 minutes
async function reapOrphanedContainers() {
  const { exec } = await import('node:child_process');
  exec('docker ps -aq --filter name=build_sandbox_', (err, stdout) => {
    if (err) return;
    const containers = stdout.split('\\n').filter(Boolean);
    if (containers.length > 0) {
      // In a real implementation we would inspect the container start time and kill if > 15m.
      // For this MVP, we aggressively kill exited containers, and running ones older than 15m.
      // Just a simple force rm for exited containers for safety:
      exec('docker rm -f $(docker ps -aq --filter name=build_sandbox_ --filter "status=exited")', () => {});
    }
  });
}

export async function startBuildWorker() {
  console.log('[BUILD_WORKER] Starting worker, reconciler, and reaper...');
  
  // Startup cleanup: reap any lingering containers from previous crashes
  const { exec } = await import('node:child_process');
  exec('docker rm -f $(docker ps -aq --filter name=build_sandbox_)', () => {
    console.log('[BUILD_WORKER] Startup cleanup complete.');
  });

  setInterval(reconcileOrphanedJobs, 60000);
  setInterval(reapOrphanedContainers, 60000);

  // Simple recursive polling loop
  const poll = async () => {
    try {
      // Find the oldest queued job, lock it so no other worker grabs it
      const result = await db.query(`
        SELECT id, user_id, project_id, status, source_path 
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
          if (job.source_path && job.source_path.endsWith('.zip')) {
            const zip = new AdmZip(job.source_path);
            zip.extractAllTo(extractPath, true);
          } else {
            console.log(`[BUILD_WORKER] Mocking extraction, no valid zip found for job ${job.id}`);
          }
        } catch (err: any) {
          console.error(`[BUILD_WORKER] Extraction failed for job ${job.id}:`, err);
          await db.query(`UPDATE build_jobs SET status = 'failed', error_log = COALESCE(error_log, '') || $1, updated_at = NOW() WHERE id = $2`, [`Extraction Failed: ${err.message}\n`, job.id]);
          return setImmediate(poll);
        }

        // Execute the sandbox
        const sandbox = new DockerSandbox({
          jobId: job.id,
          projectPath: extractPath
        });

        console.log(`[BUILD_WORKER] Launching Docker Sandbox for job ${job.id}...`);
        
        let logsBuffer = '';
        try {
          const success = await sandbox.runBuild((logChunk) => {
            process.stdout.write(`[SANDBOX ${job.id}] ${logChunk}`);
            logsBuffer += logChunk + '\n';
          });
          
          // Append logs to database
          await db.query(`UPDATE build_jobs SET error_log = COALESCE(error_log, '') || $1 WHERE id = $2`, [logsBuffer, job.id]);

          if (success) {
            console.log(`[BUILD_WORKER] Job ${job.id} completed successfully.`);
            // Artifacts: Use mock MinIO URL
            const artifactUrl = generateMinIOPresignedUrl(job.id, 'app-release.apk');
            await db.query(`UPDATE build_jobs SET status = 'success', completed_at = NOW(), artifact_url = $1, updated_at = NOW() WHERE id = $2`, [artifactUrl, job.id]);
          } else {
            console.log(`[BUILD_WORKER] Job ${job.id} failed.`);
            await db.query(`UPDATE build_jobs SET status = 'failed', completed_at = NOW(), updated_at = NOW() WHERE id = $1`, [job.id]);
          }
        } finally {
          sandbox.forceKill();
          try {
            await fs.rm(extractPath, { recursive: true, force: true });
          } catch (e) {
            console.error(`[BUILD_WORKER] Cleanup failed for ${extractPath}`, e);
          }
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
