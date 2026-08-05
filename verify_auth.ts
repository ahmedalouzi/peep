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
  console.log("=== STARTING AUTH VERIFICATION ===");
  
  // Set the environment variables just like the user does
  process.env.SYNKRO_DEV_AUTH_BYPASS = 'true';
  process.env.SYNKRO_GATEWAY_URL = 'http://localhost:3000';
  
  // We make sure google API key is NOT set (since the user is relying on bypass)
  delete process.env.GOOGLE_API_KEY;
  delete process.env.GOOGLE_GEMINI_API_KEY;
  
  const db = new MockDB();
  const workspace = {
    listDir: async () => [],
    readFile: async () => ''
  } as unknown as WorkspaceManager;
  const registry = {
    detect: async () => ({ provider: null })
  } as unknown as PlatformRegistry;
  
  const agentService = new AgentService(db, workspace, registry);
  
  // Intercept emitStream to capture AUTH_REQUIRED
  (agentService as any).emitStream = (event: any) => {
    console.log(`\n[STREAM EMITTED] type: ${event.type}`);
    console.log(`[STREAM EMITTED] content: ${event.content}`);
  };

  console.log("\n--- EXECUTING AgentService.send() ---");
  await agentService.send({
    projectPath: path.resolve('./'),
    message: 'Improve this project',
    isContinuation: false,
  });
  
  console.log("\n=== AUTH VERIFICATION COMPLETE ===");
}

run().catch(console.error);
