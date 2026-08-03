import { PlatformRegistry } from '../apps/desktop/src/main/services/platform-registry';
import { ReactNativeManagedProvider } from '../apps/desktop/src/main/services/providers/react-native-managed';
import { ProcessManager } from '../apps/desktop/src/main/services/process-manager';
import { join } from 'node:path';
import { mkdir, writeFile, rm } from 'node:fs/promises';

async function test() {
  const workspaceRoot = join(__dirname, '..', 'test_workspace_detection');
  console.log(`Setting up workspace at ${workspaceRoot}`);
  await rm(workspaceRoot, { recursive: true, force: true }).catch(() => {});
  await mkdir(workspaceRoot, { recursive: true });

  const processManager = new ProcessManager();
  const registry = new PlatformRegistry();
  const provider = new ReactNativeManagedProvider(processManager);
  registry.register(provider);

  // Case 1: Empty workspace
  let res = await registry.detect(workspaceRoot);
  console.log('Case 1 (Empty):', res.provider?.id, res.projectRoot === workspaceRoot ? 'ROOT' : res.projectRoot);

  // Case 2: Nested TestFlow
  const nested = join(workspaceRoot, 'TestFlow');
  await mkdir(nested, { recursive: true });
  await writeFile(join(nested, 'package.json'), JSON.stringify({
    dependencies: { expo: '51.0.0' }
  }));
  res = await registry.detect(workspaceRoot);
  console.log('Case 2 (Nested TestFlow):', res.provider?.id, res.projectRoot === nested ? 'NESTED' : (res.projectRoot === workspaceRoot ? 'ROOT' : res.projectRoot));

  // Case 3: Workspace root has package.json (invalid Expo)
  await writeFile(join(workspaceRoot, 'package.json'), JSON.stringify({
    name: 'some-workspace'
  }));
  res = await registry.detect(workspaceRoot);
  console.log('Case 3 (Root invalid package.json + Nested TestFlow):', res.provider?.id, res.projectRoot === nested ? 'NESTED' : (res.projectRoot === workspaceRoot ? 'ROOT' : res.projectRoot));

  // Case 4: Workspace root has valid Expo
  await writeFile(join(workspaceRoot, 'package.json'), JSON.stringify({
    dependencies: { expo: '51.0.0' }
  }));
  res = await registry.detect(workspaceRoot);
  console.log('Case 4 (Root valid package.json + Nested TestFlow):', res.provider?.id, res.projectRoot === workspaceRoot ? 'ROOT' : res.projectRoot);
}

test().catch(console.error);
