import * as http from 'node:http';
import { BackendAIGateway } from '../packages/agent/src/models/backend-gateway';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Parse .env from root manually
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        process.env[trimmed.substring(0, idx).trim()] = trimmed.substring(idx + 1).trim();
      }
    }
  }
}

if (process.env.DEV_ONLY_AUTH !== 'true') {
  console.error('ERROR: DEV_ONLY_AUTH=true is required to run the development gateway.');
  process.exit(1);
}

const PORT = 3000;
const backendGateway = new BackendAIGateway();

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-request-id');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Force local auth bypass to use dev-mode-token or dev_test_session
  const authHeader = req.headers.authorization;
  if (authHeader !== 'Bearer dev-mode-token' && authHeader !== 'Bearer dev_test_session') {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'UNAUTHORIZED', message: 'Invalid development token. This local gateway only accepts dev-mode-token or dev_test_session.' }));
    return;
  }

  if ((req.url === '/v1/ai/stream' || req.url === '/v1/ai/generate') && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const aiReq = JSON.parse(body);
        
        backendGateway.authService.validateSession = async (token: string) => {
          if (token === 'dev-mode-token' || token === 'dev_test_session') {
            return { userId: 'dev-user', email: 'dev@peep.dev' };
          }
          throw new Error('Invalid token');
        };

        // Fully mock DB dependencies for local dev
        backendGateway.usageStore.recordUsage = async () => {};
        backendGateway.budgetGuard.checkBudget = async () => {};
        backendGateway.budgetGuard.acquireLock = async () => {};
        backendGateway.budgetGuard.releaseLock = () => {};

        const headers = req.headers as Record<string, string>;
        const result = await backendGateway.handleRequest('POST', req.url!, headers, aiReq);

        res.writeHead(result.status, result.headers);
        
        if (result.status === 200 && result.body) {
          if (typeof result.body[Symbol.asyncIterator] === 'function') {
            for await (const chunk of result.body) {
              res.write('data: ' + JSON.stringify(chunk) + '\n\n');
            }
          } else {
            res.end(JSON.stringify(result.body));
          }
        } else {
          res.end(JSON.stringify(result.body));
        }
      } catch (err: any) {
        console.error(err);
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Bad Request', details: err.message }));
      }
    });
  } else {
    console.log(`[TEST-GATEWAY] 404 Not Found: ${req.method} ${req.url}`);
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[TEST-GATEWAY] Listening on http://127.0.0.1:${PORT}`);
  console.log(`[TEST-GATEWAY] DEV_ONLY_AUTH active`);
});
