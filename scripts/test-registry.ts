import { PlatformRegistry } from '../apps/desktop/src/main/services/platform-registry';
import { ReactNativeManagedProvider } from '../apps/desktop/src/main/services/providers/react-native-managed';
import { ProcessManager } from '../apps/desktop/src/main/services/process-manager';

async function testDetect() {
  const registry = new PlatformRegistry();
  const processManager = new ProcessManager();
  registry.register(new ReactNativeManagedProvider(processManager));

  const result = await registry.detect('./mock-workspace');
  console.log('Result:', result.projectRoot);
  console.log('Provider:', result.provider?.id);
}

testDetect().catch(console.error);
