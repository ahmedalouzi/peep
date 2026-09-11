import { db } from './db';
import { DockerSandbox, BuildFramework } from './docker-sandbox';
import { uploadArtifact, ensureBucket } from './artifact-store';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import AdmZip from 'adm-zip';

// Reconciler: Recovers orphaned running jobs that the worker failed to complete
async function reconcileOrphanedJobs() {
  try {
    const res = await db.query(`
      UPDATE build_jobs
      SET status = 'failed',
          error_log = COALESCE(error_log, '') || '[RECONCILER] Job abandoned. Worker crashed or timed out.',
          updated_at = NOW()
      WHERE status = 'running' 
        AND updated_at < NOW() - INTERVAL '12 minutes'
      RETURNING id
    `);
    if (res.rows.length > 0) {
      console.log(`[RECONCILER] Recovered ${res.rows.length} orphaned jobs: ${res.rows.map((r: any) => r.id).join(', ')}`);
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
      exec('docker rm -f $(docker ps -aq --filter name=build_sandbox_ --filter "status=exited")', () => {});
    }
  });
}

export async function startBuildWorker() {
  console.log('[BUILD_WORKER] Starting worker, reconciler, and reaper...');
  
  // Ensure MinIO bucket exists on startup
  try {
    await ensureBucket();
    console.log('[BUILD_WORKER] MinIO bucket verified.');
  } catch (err) {
    console.warn('[BUILD_WORKER] MinIO not available, will retry on artifact upload:', err);
  }

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
      const result = await db.query(`
        SELECT id, user_id, project_id, status, source_path, framework, keystore_secret_id
        FROM build_jobs 
        WHERE status = 'queued' 
        ORDER BY created_at ASC 
        LIMIT 1 
        FOR UPDATE SKIP LOCKED
      `);

      if (result.rows.length > 0) {
        const job = result.rows[0];
        const framework: BuildFramework = job.framework || 'flutter';
        console.log(`[BUILD_WORKER] Picked up ${framework} job ${job.id} for project ${job.project_id}`);
        
        // Mark as running
        await db.query(`UPDATE build_jobs SET status = 'running', started_at = NOW(), updated_at = NOW() WHERE id = $1`, [job.id]);
        
        // Extract the ZIP
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

        // Resolve keystore if present
        let keystorePath: string | undefined;
        let keystorePassword: string | undefined;
        let keyAlias: string | undefined;
        let keyPassword: string | undefined;

        if (job.keystore_secret_id) {
          // In production, fetch from a secrets manager (e.g., AWS Secrets Manager, Vault).
          // For now, we look for a local keystore file dropped by the upload endpoint.
          const localKeystorePath = path.join('/tmp/keystores', `${job.keystore_secret_id}.jks`);
          try {
            await fs.access(localKeystorePath);
            keystorePath = localKeystorePath;
            // Passwords would come from the secrets manager in production
            keystorePassword = process.env.DEFAULT_KEYSTORE_PASSWORD || 'changeit';
            keyAlias = process.env.DEFAULT_KEY_ALIAS || 'release';
            keyPassword = process.env.DEFAULT_KEY_PASSWORD || keystorePassword;
          } catch {
            console.warn(`[BUILD_WORKER] Keystore ${job.keystore_secret_id} not found, building without signing`);
          }
        }

        // Execute the sandbox
        const sandbox = new DockerSandbox({
          jobId: job.id,
          projectPath: extractPath,
          framework,
          keystorePath,
          keystorePassword,
          keyAlias,
          keyPassword,
        });

        console.log(`[BUILD_WORKER] Launching ${framework} Docker Sandbox for job ${job.id}...`);
        
        const buildStartTime = Date.now();
        let logsBuffer = '';
        try {
          const success = await sandbox.runBuild((logChunk) => {
            process.stdout.write(`[SANDBOX ${job.id}] ${logChunk}`);
            logsBuffer += logChunk + '\n';
          });
          
          const buildDuration = Date.now() - buildStartTime;

          // Append logs to database
          await db.query(`UPDATE build_jobs SET error_log = COALESCE(error_log, '') || $1, build_duration_ms = $2 WHERE id = $3`, [logsBuffer, buildDuration, job.id]);

          if (success) {
            console.log(`[BUILD_WORKER] Job ${job.id} completed successfully in ${buildDuration}ms.`);
            
            // Extract artifact from container and upload to MinIO
            const localApkPath = path.join('/tmp/artifacts', `${job.id}.apk`);
            await fs.mkdir(path.dirname(localApkPath), { recursive: true });
            
            const extracted = await sandbox.extractArtifact(localApkPath);
            if (extracted) {
              try {
                const { url, sizeBytes } = await uploadArtifact(job.id, localApkPath, 'app-release.apk');
                await db.query(
                  `UPDATE build_jobs SET status = 'success', completed_at = NOW(), artifact_url = $1, artifact_size_bytes = $2, updated_at = NOW() WHERE id = $3`,
                  [url, sizeBytes, job.id]
                );
              } catch (uploadErr: any) {
                console.error(`[BUILD_WORKER] MinIO upload failed for job ${job.id}:`, uploadErr);
                // Fallback: store local path if MinIO is unavailable
                await db.query(
                  `UPDATE build_jobs SET status = 'success', completed_at = NOW(), artifact_url = $1, updated_at = NOW() WHERE id = $2`,
                  [localApkPath, job.id]
                );
              }
            } else {
              await db.query(`UPDATE build_jobs SET status = 'failed', completed_at = NOW(), error_log = COALESCE(error_log, '') || '[SYSTEM] Artifact extraction failed.\n', updated_at = NOW() WHERE id = $1`, [job.id]);
            }
          } else {
            console.log(`[BUILD_WORKER] Job ${job.id} failed after ${buildDuration}ms.`);
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
        
        setImmediate(poll);
      } else {
        setTimeout(poll, 3000);
      }
    } catch (err) {
      console.error('[BUILD_WORKER] Error during polling:', err);
      setTimeout(poll, 5000);
    }
  };

  poll();
}
