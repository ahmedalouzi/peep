import { PlatformRegistry } from '../apps/desktop/src/main/services/platform-registry';
import { ReactNativeManagedProvider } from '../apps/desktop/src/main/services/providers/react-native-managed';
import { ProcessManager } from '../apps/desktop/src/main/services/process-manager';
import { PreviewManager } from '../apps/desktop/src/main/services/preview-manager';
import { join } from 'node:path';
import { existsSync, mkdirSync, rmSync } from 'node:fs';

async function runE2E() {
  console.log('--- Real E2E Verification ---');
  const registry = new PlatformRegistry();
  const processManager = new ProcessManager();
  const provider = new ReactNativeManagedProvider(processManager);
  registry.register(provider);
  const previewManager = new PreviewManager();

  const workspaceRoot = join(process.cwd(), 'e2e-fresh-workspace');
  if (existsSync(workspaceRoot)) {
    rmSync(workspaceRoot, { recursive: true, force: true });
  }
  mkdirSync(workspaceRoot);

  console.log('1. Agent creating nested Expo project "TestFlow"...');
  
  // Directly simulate agent's `npx create-expo-app` command
  await new Promise<void>((resolve, reject) => {
    const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const info = processManager.spawn(npx, ['create-expo-app', 'TestFlow', '--template', 'blank'], workspaceRoot);
    info.process.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error('create-expo-app failed'));
    });
  });

  console.log('2. TestFlow project created successfully.');
  
  // Simulate UI RN_START_PREVIEW IPC handler
  console.log('3. Simulating UI RN_START_PREVIEW with workspaceRoot:', workspaceRoot);
  
  const { provider: detectedProvider, projectRoot } = await registry.detect(workspaceRoot, {
    requireProject: true,
    timeoutMs: 15000
  });

  if (!detectedProvider) {
    throw new Error(`PROJECT_NOT_READY: No valid project detected in workspace: ${workspaceRoot}`);
  }

  console.log('Exact detected projectRoot:', projectRoot);
  console.log('Provider:', detectedProvider.id);

  console.log('4. Calling previewManager.start...');
  
  // Override emit to catch logs
  (previewManager as any).emit = (session: any) => {
    console.log('[PreviewManager emit]', session);
  };

  const session = await previewManager.start(projectRoot, detectedProvider);
  
  console.log('Final Preview Result:', session);

  // Stop process
  previewManager.stop();
  processManager.killAll();

  // Cleanup
  rmSync(workspaceRoot, { recursive: true, force: true });
  console.log('✅ E2E Verification Complete!');
}

runE2E().catch(console.error);
