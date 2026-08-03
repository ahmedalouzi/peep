import { PlatformRegistry } from '../apps/desktop/src/main/services/platform-registry';
import { ReactNativeManagedProvider } from '../apps/desktop/src/main/services/providers/react-native-managed';
import { ProcessManager } from '../apps/desktop/src/main/services/process-manager';
import { join } from 'node:path';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';

async function testResolution() {
  console.log('--- Testing Preview Root Resolution ---');
  const registry = new PlatformRegistry();
  const processManager = new ProcessManager();
  registry.register(new ReactNativeManagedProvider(processManager));

  const workspaceRoot = join(process.cwd(), 'temp-mock-workspace');
  
  // Cleanup old state
  if (existsSync(workspaceRoot)) {
    rmSync(workspaceRoot, { recursive: true, force: true });
  }

  // 1. Empty workspace
  mkdirSync(workspaceRoot);
  
  // Start detection concurrently with a simulated delay for project creation
  console.log('Starting detect (requireProject: true, timeoutMs: 3000)...');
  
  const detectPromise = registry.detect(workspaceRoot, { requireProject: true, timeoutMs: 3000 });

  // Simulate agent creating project at 1 second mark
  setTimeout(() => {
    console.log('Simulating Agent creating TestFlow/package.json...');
    const projectDir = join(workspaceRoot, 'TestFlow');
    mkdirSync(projectDir);
    writeFileSync(join(projectDir, 'package.json'), JSON.stringify({
      dependencies: { expo: '1.0.0' }
    }));
  }, 1000);

  const result = await detectPromise;
  
  if (result.projectRoot && result.projectRoot.endsWith('TestFlow') && result.provider?.id === 'react-native-managed') {
    console.log('✅ PASS: Successfully resolved delayed nested project root.');
  } else {
    console.error('❌ FAIL: Detection failed to resolve nested project root.', result);
    process.exit(1);
  }

  // 2. Timeout case
  console.log('Testing timeout case...');
  const timeoutWorkspace = join(process.cwd(), 'temp-mock-workspace-empty');
  if (existsSync(timeoutWorkspace)) rmSync(timeoutWorkspace, { recursive: true, force: true });
  mkdirSync(timeoutWorkspace);

  const resultEmpty = await registry.detect(timeoutWorkspace, { requireProject: true, timeoutMs: 1500 });
  
  if (resultEmpty.provider === null && resultEmpty.projectRoot === timeoutWorkspace) {
    console.log('✅ PASS: Successfully timed out and returned null provider.');
  } else {
    console.error('❌ FAIL: Fallback bypass failed.', resultEmpty);
    process.exit(1);
  }

  rmSync(workspaceRoot, { recursive: true, force: true });
  rmSync(timeoutWorkspace, { recursive: true, force: true });
  console.log('All tests passed!');
}

testResolution().catch(console.error);
