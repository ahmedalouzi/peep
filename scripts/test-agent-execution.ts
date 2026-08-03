import { runAgentLoop } from '../packages/agent/src/orchestrator';
import { readFileSync } from 'node:fs';

async function runTest() {
  console.log('--- Starting Agent Execution Test ---');

  // Load actual user config to use real API key
  const storePath = 'C:\\Users\\Administrator\\AppData\\Roaming\\@peep\\desktop\\peep-store.json';
  let apiKey = process.env.GEMINI_API_KEY || '';
  let provider = 'google';
  let model = 'gemini-3.5-flash';

  try {
    const raw = readFileSync(storePath, 'utf8');
    const data = JSON.parse(raw);
    if (data.settings) {
      if (data.settings.apiKey) {
        // The DB decrypts it in memory, but we read the raw JSON here.
        // For testing, hopefully it's unencrypted or we can parse it.
        // The user says "real Gemini API request using my local API key", so let's hope it's not encrypted in a way we can't use.
        // If it is encrypted, we might need to use safeStorage, but that's Electron only.
        // Let's just try to read it. If it fails, the user needs to provide GEMINI_API_KEY env.
        apiKey = data.settings.apiKey;
      }
      if (data.settings.apiProvider) provider = data.settings.apiProvider;
      if (data.settings.apiModel) model = data.settings.apiModel;
    }
  } catch (err) {
    console.log('Could not load peep-store.json', err);
  }

  if (!apiKey) {
    console.error('No API key found in peep-store.json. Please ensure it is set.');
    return;
  }

  console.log(`Using provider: ${provider}, model: ${model}`);

  const executor = {
    execute: async (name: string, args: Record<string, unknown>) => {
      console.log(`[TEST_EXECUTOR] Executing tool: ${name} with args:`, args);
      if (name === 'run_command') {
        const { execSync } = require('child_process');
        try {
          const out = execSync(args.command as string, { cwd: args.cwd as string || process.cwd() });
          return out.toString();
        } catch (e: any) {
          return e.message;
        }
      }
      return 'Mock success';
    }
  };

  const callbacks = {
    onStatus: (msg: string) => console.log(`[STATUS] ${msg}`),
    onDelta: (msg: string) => process.stdout.write(msg),
    onError: (msg: string) => console.log(`\n[ERROR] ${msg}`),
    onDone: () => console.log('\n[DONE] Agent finished.'),
    onActivity: (activity: any) => console.log('\n[ACTIVITY]', activity)
  };

  const config: any = {
    provider,
    apiKey,
    model,
    // explicitly NO gateway, testing direct local key mode
  };

  const messages: any[] = [
    { role: 'user', content: 'Run node -v using the command execution tool.' }
  ];

  try {
    const result = await runAgentLoop(
      config,
      'You are a testing agent. You must execute commands using run_command.',
      messages,
      executor,
      callbacks,
      new AbortController().signal,
      false,
      process.cwd()
    );
    console.log('\n--- Final Agent Response ---');
    console.log(result);
  } catch (err) {
    console.error('Test failed:', err);
  }
}

runTest();
