import express from 'express';
import { BackendAIGateway } from '@peep/agent';
import { fetchProductionSecrets } from './secrets';
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

async function bootstrap() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN || '',
    integrations: [
      nodeProfilingIntegration(),
    ],
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
    beforeSend(event) {
      // Redaction rules: remove prompts, files, and chain-of-thought
      if (event.request && event.request.data) {
        delete event.request.data;
      }
      return event;
    }
  });

  const secrets = await fetchProductionSecrets();
  
  // Set secrets into the environment so GoogleGeminiAdapter picks them up
  if (secrets.GOOGLE_API_KEY) process.env.GOOGLE_API_KEY = secrets.GOOGLE_API_KEY;
  if (secrets.OPENAI_API_KEY) process.env.OPENAI_API_KEY = secrets.OPENAI_API_KEY;
  if (secrets.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = secrets.ANTHROPIC_API_KEY;

  // Initialize the backend gateway
  const gateway = new BackendAIGateway();

  const app = express();
  app.use(express.json());

  // Healthcheck endpoint for AWS ECS Load Balancer
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // AI Generate Endpoint
  app.post('/v1/ai/generate', async (req, res) => {
    try {
      const headers = req.headers as Record<string, string>;
      const response = await gateway.handleRequest('POST', '/v1/ai/generate', headers, req.body);
      res.status(response.status).json(response.body);
    } catch (error: any) {
      console.error('[Generate Error]', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // AI Stream Endpoint
  app.post('/v1/ai/stream', async (req, res) => {
    try {
      const headers = req.headers as Record<string, string>;
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
        for await (const chunk of stream) {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }
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
