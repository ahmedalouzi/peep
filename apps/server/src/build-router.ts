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

// Middleware for Usage Cap (10 builds/day)
const buildRateLimiter = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized: Missing user ID' });
      return;
    }

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

buildRouter.post('/upload', buildRateLimiter, upload.single('project'), async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const projectId = req.body.projectId || 'unknown';

    if (!req.file) {
      res.status(400).json({ error: 'No project file uploaded' });
      return;
    }

    // In a real app, save req.file.buffer to S3 or local disk.
    // For this MVP, we mock saving it locally and generate a path.
    const artifactPath = `/tmp/builds/${Date.now()}_${userId}.zip`;
    
    const result = await client.query(`
      INSERT INTO build_jobs (user_id, project_id, status, artifact_path)
      VALUES ($1, $2, 'queued', $3)
      RETURNING id, status
    `, [userId, projectId, artifactPath]);

    const job = result.rows[0];

    console.log(`[BUILD_ROUTER] Uploaded project for user ${userId}, job ID ${job.id}`);
    res.status(202).json({ jobId: job.id, status: job.status });
  } catch (err) {
    console.error('[Build Upload Error]', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
