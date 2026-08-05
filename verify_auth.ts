import { DatabaseService } from './apps/desktop/src/main/services/db';
import { WorkspaceManager } from './apps/desktop/src/main/services/workspace-manager';
import { PlatformRegistry } from './apps/desktop/src/main/services/platform-registry';
import { AgentService } from './apps/desktop/src/main/services/agent-service';
import type { Settings } from '@peep/shared';
import * as path from 'path';

// Mock DB
class MockDB extends DatabaseService {
  private mockSettings: Settings = {
    theme: 'dark',
    autoSave: true,
    sessionToken: 'dev_test_session', // Bootstrapped session
    developerMode: true
  };
  
  constructor() {
    super();
  }
  
  getSettingsRaw(): Settings {
    return this.mockSettings;
  }
  
  async setSettings(s: Partial<Settings>) {
    this.mockSettings = { ...this.mockSettings, ...s };
  }
}

async function run() {
  console.log("=== STARTING RUNTIME AUTH VERIFICATION ===");
  
  process.env.SYNKRO_DEV_AUTH_BYPASS = 'true';
  process.env.SYNKRO_GATEWAY_URL = 'http://localhost:3000';
  
  const db = new MockDB();
  const workspace = {
    listDir: async () => [],
    readFile: async () => ''
  } as unknown as WorkspaceManager;
  const registry = {
    detect: async () => ({ provider: null })
  } as unknown as PlatformRegistry;
  
  const agentService = new AgentService(db, workspace, registry);
  
  (agentService as any).emitStream = (event: any) => {
    console.log(`\n[STREAM EMITTED] type: ${event.type}`);
    console.log(`[STREAM EMITTED] content: ${event.content}`);
  };

  await agentService.send({
    projectPath: path.resolve('./'),
    message: 'Test message',
    isContinuation: false,
  });
  
  console.log("\n=== VERIFICATION COMPLETE ===");
}

run().catch(console.error);
