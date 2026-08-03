import { AgentService } from '../apps/desktop/src/main/services/agent-service';
import { DatabaseService } from '../apps/desktop/src/main/services/db';

async function run() {
  console.log('--- SaaS Security Test ---');
  const db = new DatabaseService();
  await db.init();

  // Explicitly clear session token
  await db.setSettings({ sessionToken: undefined });

  let emittedAuthError = false;

  const agentService = new AgentService(db, {
    projectRoot: process.cwd(),
    platform: 'unknown'
  } as any);

  // Mock emitStream to catch the output
  (agentService as any).emitStream = (event: any) => {
    console.log(`[Event] ${event.type}: ${event.content}`);
    if (event.type === 'error' && event.content.includes('AUTH_REQUIRED')) {
      emittedAuthError = true;
    }
  };

  console.log('Sending message to agent without session token...');
  await agentService.send({ message: 'Hello agent' });

  if (emittedAuthError) {
    console.log('✅ PASS: Agent rejected request with AUTH_REQUIRED when no session token is present.');
  } else {
    console.error('❌ FAIL: Agent did not emit AUTH_REQUIRED error!');
    process.exit(1);
  }

  // Ensure no apiKey is processed or leaked
  const rawSettings = db.getSettingsRaw();
  if ('apiKey' in rawSettings) {
    console.error('❌ FAIL: Database still tracks apiKey in raw settings!');
    process.exit(1);
  } else {
    console.log('✅ PASS: apiKey field is successfully removed from raw settings.');
  }
}

run().catch(console.error);
