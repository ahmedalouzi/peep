import Module from 'node:module';
const originalRequire = Module.prototype.require;
(Module.prototype as any).require = function(id: string) {
  if (id === 'electron') {
    return {
      BrowserWindow: {
        getAllWindows: () => []
      }
    };
  }
  return originalRequire.apply(this, arguments as any);
};

import { PlatformRegistry } from '../apps/desktop/src/main/services/platform-registry';
import { ReactNativeManagedProvider } from '../apps/desktop/src/main/services/providers/react-native-managed';
import { ProcessManager } from '../apps/desktop/src/main/services/process-manager';
import { PreviewManager } from '../apps/desktop/src/main/services/preview-manager';
import { join } from 'node:path';
import { rm, mkdir, access } from 'node:fs/promises';
import { EventEmitter } from 'node:events';

async function runVerification() {
  const workspaceRoot = join(__dirname, '..', 'e2e_preview_workspace');
  console.log(`\n--- Setup Workspace: ${workspaceRoot} ---`);
  await rm(workspaceRoot, { recursive: true, force: true });
  await mkdir(workspaceRoot, { recursive: true });

  const processManager = new ProcessManager();
  
  // Intercept ProcessManager.spawn to capture cwd
  const originalSpawn = processManager.spawn.bind(processManager);
  processManager.spawn = (command, args, cwd, env) => {
    console.log(`\n[ProcessManager Intercept] Spawned Command: ${command} ${args.join(' ')}`);
    console.log(`[ProcessManager Intercept] CWD Used: ${cwd}`);
    
    // Verify package.json exists in CWD
    access(join(cwd, 'package.json'))
      .then(() => console.log(`[ProcessManager Intercept] SUCCESS: package.json verified in ${cwd}`))
      .catch(() => console.error(`[ProcessManager Intercept] FATAL: package.json MISSING in ${cwd}`));

    return originalSpawn(command, args, cwd, env);
  };

  const registry = new PlatformRegistry();
  const provider = new ReactNativeManagedProvider(processManager);
  registry.register(provider);

  const previewManager = new PreviewManager();
  (previewManager as any).emit = function() {};

  console.log(`\n--- Step 1: Create Nested Project TestFlow ---`);
  const nestedRoot = join(workspaceRoot, 'TestFlow');
  await mkdir(nestedRoot, { recursive: true });
  await provider.bootstrapProject(nestedRoot);

  console.log(`\n--- Step 2: UI Triggers RN_START_PREVIEW ---`);
  console.log(`UI passes workspace projectPath: ${workspaceRoot}`);
  
  // Simulate the exact code inside ipc/index.ts IPC_CHANNELS.RN_START_PREVIEW
  const { provider: detectedProvider, projectRoot } = await registry.detect(workspaceRoot);
  console.log(`[IPC Handler] Detected projectRoot: ${projectRoot}`);
  console.log(`[IPC Handler] Expected nestedRoot: ${nestedRoot}`);

  if (projectRoot !== nestedRoot) {
    throw new Error(`Detection failed! projectRoot should be ${nestedRoot} but got ${projectRoot}`);
  }
  
  if (!detectedProvider) throw new Error('No provider detected');

  console.log(`\n--- Step 3: Call previewManager.start(projectRoot, provider) ---`);
  const previewResult = await previewManager.start(projectRoot, detectedProvider);
  
  console.log(`\n--- Step 4: Verification Result ---`);
  console.log(previewResult);
  
  console.log('\nPreview started successfully! Stopping preview...');
  previewManager.stop();
  processManager.killAll();
}

runVerification().catch(console.error);
