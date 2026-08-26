import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// Mock electron before importing anything from desktop
import Module from 'node:module';
const originalRequire = Module.prototype.require;
(Module.prototype as any).require = function(id: string) {
  if (id === 'electron') {
    return {
      ipcMain: { on: () => {}, once: () => {} },
      shell: { showItemInFolder: () => {}, trashItem: () => {} },
      BrowserWindow: class {},
    };
  }
  if (id === '@sentry/electron/main') {
    return {
      init: () => {},
      addBreadcrumb: () => {},
      captureException: () => {}
    };
  }
  if (id === 'electron-log/main') {
    return {
      info: () => {},
      warn: () => {},
      error: () => {},
      initialize: () => {},
      transports: { file: {}, console: {} }
    };
  }
  return originalRequire.apply(this, arguments as any);
};

// Now import from desktop
let AgentService: any;
let WorkspaceManager: any;

// Import from agent
import { MockAIGateway } from '../src/models/mock-gateway';
import { AgentConfig } from '../src/orchestrator';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function runTests() {
  const mod = await import('../../../apps/desktop/src/main/services/agent-service');
  AgentService = mod.AgentService;
  const modWm = await import('../../../apps/desktop/src/main/services/workspace-manager');
  WorkspaceManager = modWm.WorkspaceManager;
  
  console.log('  Running Patch File Integration tests...');

  const root = path.resolve(__dirname, 'patch_test_workspace');
  await fs.rm(root, { recursive: true, force: true });
  await fs.mkdir(root, { recursive: true });

  const targetFile = path.join(root, 'target.ts');
  const initialContent = `function hello() {\n  console.log('world');\n}\n`;
  await fs.writeFile(targetFile, initialContent, 'utf-8');

  // Setup actual WorkspaceManager
  const dbMock = {
    getSettingsRaw: () => ({ sessionToken: 'mock' })
  } as any;
  const workspaceManager = new WorkspaceManager(dbMock);
  
  const registryMock = {
    detect: async () => ({ provider: null, projectRoot: root })
  } as any;
  const agentService = new AgentService(dbMock, workspaceManager, registryMock);

  // We need to extract the toolExecution callback. Since it's inline in sendAgentMessage,
  // we will trigger it by making a dummy sendAgentMessage call and intercepting runAgentLoop, OR
  // we can use a simpler approach: the executor is technically inside AgentService.
  // Wait, sendAgentMessage takes (options). We can just call it with a MockAIGateway!
  // It uses ProductionAIGateway by default. Let's override it.
  
  const gateway = new MockAIGateway();
  // Configure gateway to return a patch_file tool call
  gateway.setCustomToolCall({
    id: 'call-patch',
    name: 'patch_file',
    arguments: {
      path: 'target.ts',
      oldText: "console.log('world');",
      newText: "console.log('patched');"
    }
  });

  try {
    let resultStream = '';
    (agentService as any).mainWindow = {
      webContents: {
        send: (channel: string, event: any) => {
          if (channel === 'peep:agent-stream') {
            if (event.type === 'delta') resultStream += event.text;
          }
        }
      }
    };
    
    (workspaceManager as any).project = { path: root };

    await agentService.send({
      message: 'patch it',
      history: [],
      projectPath: root,
      openFilePath: targetFile,
      openFileContent: initialContent,
      autoApplyEdits: true,
      _testGateway: gateway
    } as any);

    const finalContent = await fs.readFile(targetFile, 'utf-8');
    if (!finalContent.includes('console.log(\'patched\')')) {
      throw new Error('File was not patched correctly by AgentService');
    }

    // Now test failure (e.g. multiple matches)
    await fs.writeFile(targetFile, `function hello() {\n  console.log('world');\n}\n\nfunction duplicate() {\n  console.log('world');\n}\n`);
    const gateway2 = new MockAIGateway();
    gateway2.setCustomToolCall({
      id: 'call-patch-2',
      name: 'patch_file',
      arguments: {
        path: 'target.ts',
        oldText: "console.log('world');",
        newText: "console.log('patched');"
      }
    });
    
    await agentService.send({
      message: 'patch it again',
      history: [],
      projectPath: root,
      _testGateway: gateway2
    } as any);
    
    const unpatchedContent = await fs.readFile(targetFile, 'utf-8');
    if (unpatchedContent.includes('patched')) {
      throw new Error('File was incorrectly patched when multiple matches existed');
    }

    console.log('  🟢 Passed');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}
