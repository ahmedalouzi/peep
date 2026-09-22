import { describe, it, vi } from 'vitest';
import { cloudBuildService } from '../src/main/services/cloud-build-service';
import { db } from '../src/main/services/db';
import * as http from 'http';
import * as path from 'path';

vi.mock('../src/main/services/db', () => ({
  db: {
    getSettingsRaw: () => ({ gatewayUrl: 'http://localhost:8081', sessionToken: 'fake-token' }),
    getSettings: async () => ({ gatewayUrl: 'http://localhost:8081', sessionToken: 'fake-token' }),
  }
}));


describe('smoke test', () => {
  it('runs end-to-end', async () => {
    const server = http.createServer((req, res) => {
      if (req.url === '/api/build/upload' && req.method === 'POST') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ jobId: 'test-job-123' }));
      } else if (req.url === '/api/build/test-job-123' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: 'test-job-123', status: 'queued' }));
      } else if (req.url === '/api/build/test-job-123/stream' && req.method === 'GET') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        });
        res.write('data: {"chunk":"[BUILD] Booting environment..."}\n\n');
        setTimeout(() => {
          res.write('data: {"chunk":"[BUILD] Downloading dependencies..."}\n\n');
        }, 100);
        setTimeout(() => {
          res.write('data: {"chunk":"[Stream Terminated]"}\n\n');
          res.end();
        }, 200);
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise(r => server.listen(8081, () => r(null)));
    console.log("Mock backend listening on 8081");

    const mainWindow = {
      webContents: {
        send: (channel: string, ...args: any[]) => {
          console.log(`[IPC EVENT FIRED] Channel: ${channel} | Args:`, JSON.stringify(args));
        }
      }
    };

    try {
      console.log("--> Triggering startBuild IPC handler equivalent...");
      const build = await cloudBuildService.startBuild(__dirname, 'flutter', 'both');
      console.log("    Build response:", build);

      console.log("--> Triggering startLogStream IPC handler equivalent...");
      cloudBuildService.startLogStream(build.id, mainWindow as any);

      // Wait for stream to finish
      await new Promise(r => setTimeout(r, 500));
      console.log("--> Stream finished, smoke test passed!");
    } finally {
      server.close();
    }
  });
});
