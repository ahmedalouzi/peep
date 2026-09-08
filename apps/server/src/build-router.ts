import express from 'express';
import multer from 'multer';
import { client } from '@peep/agent/server';

export const buildRouter = express.Router();

// Configure multer for zip uploads (max 50MB limit)
const upload = multer({
  storage: multer.memoryStorage(), // For MVP, keep in memory before writing to disk/db
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});

import { AuthenticationRouter } from '@peep/agent/server';

const authService = new AuthenticationRouter();

// Middleware for true authentication
const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const token = (req.headers['authorization'] || '').replace('Bearer ', '') || (req.headers['session'] as string);
    if (!token) {
      res.status(401).json({ error: 'Unauthorized: Missing session token' });
      return;
    }
    const session = await authService.validateSession(token);
    (req as any).user = session;
    next();
  } catch (err: any) {
    res.status(401).json({ error: 'Unauthorized: ' + (err.message || 'Invalid session') });
  }
};

// Middleware for Usage Cap (10 builds/day)
const buildRateLimiter = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const userId = (req as any).user.userId;

    // Check today's builds
    const result = await client.query(`
      SELECT COUNT(*) as count 
      FROM build_jobs 
      WHERE user_id = $1 
        AND created_at >= NOW() - INTERVAL '1 day'
    `, [userId]);

    const count = parseInt(result.rows[0].count, 10);
    if (count >= 10) {
      res.status(429).json({ error: 'Usage Limit Exceeded: You can only build 10 times per day.' });
      return;
    }

    next();
  } catch (err) {
    console.error('[Build Rate Limiter Error]', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

buildRouter.post('/upload', requireAuth, buildRateLimiter, upload.single('project'), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const projectId = req.body.projectId || 'unknown';

    if (!req.file) {
      res.status(400).json({ error: 'No project file uploaded' });
      return;
    }

    // In a real app, save req.file.buffer to S3 or local disk.
    // For this MVP, we mock saving it locally and generate a path.
    const artifactPath = `/tmp/builds/${Date.now()}_${userId}.zip`;
    const fs = await import('node:fs/promises');
    await fs.writeFile(artifactPath, req.file.buffer);
    
    const dbClient = await client.connect();
    let job;
    try {
      await dbClient.query('BEGIN');
      // SECURITY CRITICAL: The base connection authenticates as the postgres superuser.
      // RLS protection depends ENTIRELY on this line being present. If forgotten, 
      // the endpoint silently loses all tenant isolation and fails open.
      await dbClient.query('SET LOCAL ROLE api_user');
      await dbClient.query('SELECT set_config($1, $2, true)', ['app.current_user_id', userId]);
      const result = await dbClient.query(`
        INSERT INTO build_jobs (user_id, project_id, status, source_path)
        VALUES ($1, $2, 'queued', $3)
        RETURNING id, status
      `, [userId, projectId, artifactPath]);
      job = result.rows[0];
      await dbClient.query('COMMIT');
    } catch (e) {
      await dbClient.query('ROLLBACK');
      throw e;
    } finally {
      dbClient.release();
    }

    console.log(`[BUILD_ROUTER] Uploaded project for user ${userId}, job ID ${job.id}`);
    res.status(202).json({ jobId: job.id, status: job.status });
  } catch (err) {
    console.error('[Build Upload Error]', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
