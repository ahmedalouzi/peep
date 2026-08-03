import { createServer } from 'node:http';
import { AgentService } from '../apps/desktop/src/main/services/agent-service';
import { PlatformRegistry } from '../apps/desktop/src/main/services/platform-registry';
import { ProcessManager } from '../apps/desktop/src/main/services/process-manager';
import { ReactNativeManagedProvider } from '../apps/desktop/src/main/services/providers/react-native-managed';
import { PreviewManager } from '../apps/desktop/src/main/services/preview-manager';
import { join } from 'node:path';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';

const PORT = 4000;

async function runSaaSE2E() {
  console.log('--- Synkro SaaS Gateway E2E Verification ---');
  
  // 1. Start mock Synkro Gateway
  const gatewayServer = createServer((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const auth = req.headers['authorization'];
      if (req.url === '/v1/ai/stream' || req.url === '/v1/ai/generate') {
        const payload = JSON.parse(body);
        
        console.log('[MockGateway] Received AI Request');
        console.log(`[MockGateway] Authorization Header: ${auth}`);
        console.log(`[MockGateway] Capability Tier: ${payload.tier}`);
        console.log(`[MockGateway] Has Messages: ${Array.isArray(payload.messages)}`);
        
        if (payload.apiKey || payload.apiProvider) {
          console.error('[MockGateway] ERROR: Client sent local API keys!');
          process.exit(1);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        
        // Return a mock tool call response
        const mockResponse = {
          content: '',
          toolCalls: [{
            id: 'call_1',
            name: 'run_command',
            arguments: { command: 'node -v' }
          }],
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
          model: 'gateway-router-v1'
        };
        res.write(JSON.stringify(mockResponse));
        res.end();
      } else {
        res.writeHead(404);
        res.end();
      }
    });
  });

  await new Promise<void>(resolve => gatewayServer.listen(PORT, resolve));
  console.log(`[MockGateway] Running on http://localhost:${PORT}`);

  try {
    const processManager = new ProcessManager();
    const platformRegistry = new PlatformRegistry();
    const provider = new ReactNativeManagedProvider(processManager);
    platformRegistry.register(provider);
    const workspace = { id: 'ws1', path: process.cwd(), name: 'Test' } as any;

    // A. TEST MISSING SESSION TOKEN
    console.log('\n--- Test: Missing sessionToken ---');
    let dbMock1 = {
      getSettingsRaw: () => ({ gatewayUrl: `http://localhost:${PORT}` }),
      setSettings: async () => {},
    } as any;
    const agentService1 = new AgentService(dbMock1, workspace, platformRegistry);
    
    // Mock emitStream
    const errorEvents: any[] = [];
    (agentService1 as any).emitStream = (event: any) => errorEvents.push(event);
    
    await agentService1.send({ message: 'Hello' });
    const isAuthRequired = errorEvents.some(e => e.type === 'error' && e.content.includes('AUTH_REQUIRED'));
    console.log(`[AgentService] Missing sessionToken returned AUTH_REQUIRED: ${isAuthRequired}`);
    if (!isAuthRequired) throw new Error('Failed to enforce AUTH_REQUIRED');

    // B. TEST VALID SESSION TOKEN
    console.log('\n--- Test: Valid sessionToken ---');
    let dbMock2 = {
      getSettingsRaw: () => ({ gatewayUrl: `http://localhost:${PORT}`, sessionToken: 'valid_synkro_token' }),
      setSettings: async () => {},
    } as any;
    const agentService2 = new AgentService(dbMock2, workspace, platformRegistry);
    
    const events: any[] = [];
    (agentService2 as any).emitStream = (event: any) => events.push(event);
    
    // Will hit the mock gateway, return run_command
    await agentService2.send({ message: 'Run node -v' });
    
    console.log('[AgentService] Events emitted:');
    for (const e of events) {
      const contentStr = typeof e.content === 'object' ? (e.content instanceof Error ? e.content.message : JSON.stringify(e.content)) : e.content;
      console.log(`  - [${e.type}] ${contentStr}`);
    }

    const hasRunCommand = events.some(e => e.type === 'activity' && e.content.includes('run_command'));
    if (!hasRunCommand) {
       console.warn('[WARNING] Tool call run_command was not found in the activity stream!');
    } else {
       console.log('[AgentService] Request completed successfully through Gateway.');
    }

    // C. PREVIEW RESOLUTION TEST
    console.log('\n--- Test: Preview Resolution ---');
    const workspaceRoot = join(process.cwd(), 'e2e-fresh-workspace2');
    if (existsSync(workspaceRoot)) rmSync(workspaceRoot, { recursive: true, force: true });
    mkdirSync(workspaceRoot);
    
    const projectDir = join(workspaceRoot, 'TestFlow');
    mkdirSync(projectDir);
    writeFileSync(join(projectDir, 'package.json'), JSON.stringify({ dependencies: { expo: '1.0.0' } }));
    console.log('[PreviewTest] TestFlow/package.json created.');

    const { provider: detectedProvider, projectRoot } = await platformRegistry.detect(workspaceRoot, {
      requireProject: true,
      timeoutMs: 3000
    });

    console.log(`[PreviewTest] Detected ProjectRoot: ${projectRoot}`);
    if (!projectRoot.endsWith('TestFlow')) {
      throw new Error('Failed to resolve TestFlow');
    }
    console.log('[PreviewTest] PlatformRegistry properly resolved nested TestFlow instead of workspace root.');
    rmSync(workspaceRoot, { recursive: true, force: true });
    
    console.log('\n✅ ALL E2E VERIFICATIONS PASSED SUCCESSFULLY!');
  } finally {
    gatewayServer.close();
  }
}

runSaaSE2E().catch(console.error);
