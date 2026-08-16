import * as path from 'node:path';
import { config } from 'dotenv';

// Load env from root workspace
config({ path: path.resolve(process.cwd(), '.env') });
// Fallbacks for direct runner execution
config({ path: path.join(__dirname, '../../.env') });
config({ path: path.join(__dirname, '../../../.env') });

import express from 'express';
import { BackendAIGateway } from '@peep/agent/src/models/backend-gateway';
import { fetchProductionSecrets } from './secrets';
import { execSync } from 'node:child_process';

async function bootstrap() {
  let commitHash = '168e73a';
  try {
    commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch (e) {
    // fallback
  }
  const startedAt = new Date().toISOString();
  console.log(`[SERVER_BUILD] commit=${commitHash}`);
  console.log(`[SERVER_BUILD] started at ${startedAt}`);

  const secrets = await fetchProductionSecrets();
  
  // Set secrets into the environment so GoogleGeminiAdapter picks them up
  if (secrets.GOOGLE_API_KEY) process.env.GOOGLE_API_KEY = secrets.GOOGLE_API_KEY;
  if (secrets.OPENAI_API_KEY) process.env.OPENAI_API_KEY = secrets.OPENAI_API_KEY;
  if (secrets.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = secrets.ANTHROPIC_API_KEY;

  // Initialize the backend gateway
  const gateway = new BackendAIGateway();

  const app = express();
  app.use((req, _res, next) => {
    console.log("[REQUEST ARRIVED]", req.method, req.url);
    _res.setHeader('X-Synkro-Server-Version', commitHash);
    next();
  });
  app.use(express.json({ limit: '50mb' }));

  // Healthcheck endpoint for AWS ECS Load Balancer
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // AI Generate Endpoint
  app.post('/v1/ai/generate', async (req, res) => {
    const requestId = Math.random().toString(36).slice(2, 10);
    console.log(`\n[BACKEND_RECEIVED] [${requestId}] POST /v1/ai/generate`);
    console.log(`[BACKEND_RECEIVED] [${requestId}] Authorization: Bearer ***  Session: ${req.headers['session'] ?? '(none)'}`);
    console.log(`[BACKEND_RECEIVED] [${requestId}] Tier: ${req.body?.capabilityTier ?? 'unset'}  Messages: ${req.body?.messages?.length ?? 0}`);
    try {
      const headers = req.headers as Record<string, string>;
      headers['x-request-id'] = requestId;
      console.log(`[BACKEND_PROCESSING] [${requestId}] Dispatching to BackendAIGateway...`);
      const response = await gateway.handleRequest('POST', '/v1/ai/generate', headers, req.body);
      console.log(`[BACKEND_RESPONDING] [${requestId}] Status: ${response.status}  HasToolCalls: ${!!response.body?.toolCalls?.length}`);
      res.status(response.status).json(response.body);
    } catch (error: any) {
      console.error('[Generate Error]', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // AI Stream Endpoint
  app.post('/v1/ai/stream', async (req, res) => {
    const requestId = Math.random().toString(36).slice(2, 10);
    console.log(`\n[BACKEND_RECEIVED] [${requestId}] POST /v1/ai/stream`);
    console.log(`[BACKEND_RECEIVED] [${requestId}] Authorization: Bearer ***  Session: ${req.headers['session'] ?? '(none)'}`);
    try {
      const headers = req.headers as Record<string, string>;
      headers['x-request-id'] = requestId;
      console.log(`[BACKEND_PROCESSING] [${requestId}] Dispatching to BackendAIGateway (stream)...`);
      const response = await gateway.handleRequest('POST', '/v1/ai/stream', headers, req.body);
      
      res.status(response.status);
      if (response.headers) {
        for (const [key, value] of Object.entries(response.headers)) {
          res.setHeader(key, value as string);
        }
      }
      
      // For streams, handleRequest returns an AsyncIterable in the body if status is 200
      if (response.status === 200 && response.body && typeof response.body[Symbol.asyncIterator] === 'function') {
        const stream = response.body as AsyncIterable<any>;
        let chunkIndex = 0;
        for await (const chunk of stream) {
          if (chunkIndex === 0) {
            console.log(`[BACKEND_STREAMING] [${requestId}] First SSE chunk emitted: ${JSON.stringify(chunk).slice(0, 120)}`);
          }
          chunkIndex++;
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }
        console.log(`[BACKEND_STREAMING] [${requestId}] Stream complete. Total chunks: ${chunkIndex}`);
        res.end();
      } else {
        res.json(response.body);
      }
    } catch (error: any) {
      console.error('[Stream Error]', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  const PORT = process.env.PORT || 8080;
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

bootstrap().catch(console.error);
