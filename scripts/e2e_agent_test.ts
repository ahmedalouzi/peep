import Module from 'node:module';
const originalRequire = Module.prototype.require;
(Module.prototype as any).require = function(id: string) {
  if (id === 'electron') {
    return {
      app: {
        getPath: () => __dirname
      },
      ipcMain: {
        handle: () => {},
        on: () => {},
        once: () => {}
      },
      shell: {
        openPath: () => {}
      }
    };
  }
  return originalRequire.apply(this, arguments as any);
};

import { AgentService } from '../apps/desktop/src/main/services/agent-service';
import { DatabaseService } from '../apps/desktop/src/main/services/db';
import { WorkspaceManager } from '../apps/desktop/src/main/services/workspace-manager';
import { PlatformRegistry } from '../apps/desktop/src/main/services/platform-registry';
import { ReactNativeManagedProvider } from '../apps/desktop/src/main/services/providers/react-native-managed';
import { ProcessManager } from '../apps/desktop/src/main/services/process-manager';
import { join } from 'node:path';
import { rm, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

async function runTest() {
  const testWorkspace = join(__dirname, '..', 'e2e_test_workspace');
  await rm(testWorkspace, { recursive: true, force: true });
  await mkdir(testWorkspace, { recursive: true });

  const db = new DatabaseService();
  await db.init();
  
  await db.setSettings({
    sessionToken: 'test-token',
    apiProvider: 'openai',
    apiModel: 'gpt-4o-mini'
  });

  const workspace = new WorkspaceManager(db);
  (workspace as any).project = { path: testWorkspace };

  const processManager = new ProcessManager();
  const registry = new PlatformRegistry();
  registry.register(new ReactNativeManagedProvider(processManager));

  const agent = new AgentService(db, workspace, registry);
  
  let currentLogs = '';

  agent.setMainWindow({
    webContents: {
      send: (channel: string, data: any) => {
        if (channel === 'agent:stream') {
          if (data.type === 'delta' || data.type === 'status') {
            currentLogs += data.content + '\n';
          }
          if (data.type === 'error') {
            console.error('AGENT ERROR:', data.content);
          }
        } else if (channel === 'agent:proposed-edits') {
          const editIds = data.map((e: any) => e.id);
          if (editIds.length > 0) {
            console.log('Applying edits:', editIds.length);
            agent.applyEdits(editIds).catch(console.error);
          }
        }
      }
    }
  } as any);

  console.log('--- TEST 1: Create TestFlow ---');
  await agent.send({
    message: 'Create a React Native Expo fitness app called TestFlow. Start the app using start_app when done.',
    projectPath: testWorkspace,
    history: []
  });
  console.log('Logs output:');
  console.log(currentLogs);
  currentLogs = '';

  console.log('--- TEST 2: Add Dark Mode ---');
  await agent.send({
    message: 'Add a dark mode toggle to the Profile screen.',
    projectPath: testWorkspace,
    history: []
  });
  console.log('Logs output:');
  console.log(currentLogs);
  currentLogs = '';

  console.log('--- TEST 3: Auto-Fix Compile Error ---');
  const appPath = join(testWorkspace, 'TestFlow', 'App.tsx');
  const appContent = await workspace.readFile(appPath).catch(() => '');
  if (appContent) {
    await workspace.writeFile(appPath, appContent.replace('export default function App', 'export default function App() { throw new Error("Compile Error!"); } //'));
  }
  
  await agent.send({
    message: 'The preview is failing. Please fix the compile error in App.tsx.',
    projectPath: testWorkspace,
    history: []
  });
  console.log('Logs output:');
  console.log(currentLogs);
  currentLogs = '';

  console.log('E2E TEST COMPLETE.');
}

runTest().catch(console.error);
