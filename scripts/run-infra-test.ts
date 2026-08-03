import { AgentService } from '../apps/desktop/src/main/services/agent-service';
import { DatabaseService } from '../apps/desktop/src/main/services/db';
import { WorkspaceManager } from '../apps/desktop/src/main/services/workspace-manager';
import { PlatformRegistry } from '../apps/desktop/src/main/services/platform-registry';
import { MockAIGateway } from '../packages/agent/src/models/mock-gateway';
import * as path from 'path';
import * as fs from 'fs';

async function run() {
  console.log('=== SECTION A: INFRASTRUCTURE E2E ACCEPTANCE ===\n');

  const wsPath = 'c:\\Users\\Administrator\\Desktop\\peep\\test-e2e-workspace';
  if (fs.existsSync(wsPath)) {
    fs.rmSync(wsPath, { recursive: true, force: true });
  }
  fs.mkdirSync(wsPath, { recursive: true });

  const db = new DatabaseService();
  await db.init();
  await db.setSettings({ sessionToken: 'test-token', apiProvider: 'openai' });
  const workspace = new WorkspaceManager(db);
  (workspace as any).project = { path: wsPath };
  const registry = new PlatformRegistry();

  const mockGateway = new MockAIGateway();
  
  // Monkey-patch ProductionAIGateway to return mockGateway's responses
  const { ProductionAIGateway } = require('../packages/agent/src/models/production-gateway');
  ProductionAIGateway.prototype.stream = function(request: any, options: any) {
    return mockGateway.stream(request, options);
  };
  ProductionAIGateway.prototype.generate = function(request: any, options: any) {
    return mockGateway.generate(request, options);
  };

  const agent = new AgentService(db, workspace, registry);

  let streamResolve: (() => void) | null = null;
  agent.setMainWindow({
    webContents: {
      send: (channel: string, data: any) => {
        if (channel === 'agent:stream' && data.type === 'done') {
          if (streamResolve) {
            streamResolve();
            streamResolve = null;
          }
        } else if (channel === 'agent:proposed-edits') {
          const editIds = data.map((e: any) => e.id);
          if (editIds.length > 0) {
            agent.applyEdits(editIds).catch(console.error);
          }
        }
      }
    }
  } as any);

  async function sendSync(message: string) {
    const promise = new Promise<void>((r) => { streamResolve = r; });
    await agent.send({ message, projectPath: wsPath, history: [] });
    await promise;
  }
  // 1. Initial Plan via manage_plan
  console.log('[1] Simulating LLM calling manage_plan to init plan...');
  mockGateway.setCustomToolCall({
    id: 'call-plan-1',
    name: 'manage_plan',
    arguments: {
      action: 'init',
      goal: 'Create TestFlow App',
      complexity: 'medium',
      steps: [{ id: 'step1', description: 'Create Expo project', status: 'pending' }],
      acceptanceCriteria: [{ id: 'c1', description: 'App runs', status: 'pending', verificationMethod: 'ui_structural' }]
    }
  });
  await sendSync('Initialize plan');
  
  // Verify plan
  const planJson = JSON.parse(fs.readFileSync(path.join(wsPath, '.peep', 'plan.json'), 'utf8'));
  console.log('  -> Plan initialized. Acceptance criteria:', planJson.acceptanceCriteria.map((c:any) => c.description).join(', '));

  // 2. Simulated LLM creating the app
  console.log('\n[2] Simulating LLM calling propose_file_edit to create App.tsx...');
  mockGateway.setCustomToolCall({
    id: 'call-edit-1',
    name: 'propose_file_edit',
    arguments: {
      path: 'App.tsx',
      content: 'export default function App() { return <div data-testid="counter">0</div>; }',
      description: 'Create main counter app'
    }
  });
  await sendSync('Create App');
  console.log('  -> App.tsx created.');

  // 3. Phase 2 Controlled Injected Failure
  console.log('\n[3] Triggering Controlled Injected Failure via verify_criterion...');
  mockGateway.setCustomToolCall({
    id: 'call-verify-1',
    name: 'verify_criterion',
    arguments: {
      criterionId: 'c1',
      status: 'failed',
      verificationMethod: 'ui_structural',
      commandOrAction: 'check DOM',
      outputSummary: 'Test failed: missing reset button',
      evidence: '<div>0</div>'
    }
  });
  await sendSync('Verify UI');
  
  const failedPlanJson = JSON.parse(fs.readFileSync(path.join(wsPath, '.peep', 'plan.json'), 'utf8'));
  const crit = failedPlanJson.acceptanceCriteria.find((c: any) => c.id === 'c1');
  console.log('  -> Criterion status:', crit.status);

  // 4. Recovery Fix
  console.log('\n[4] LLM applies recovery fix via propose_file_edit...');
  mockGateway.setCustomToolCall({
    id: 'call-edit-2',
    name: 'propose_file_edit',
    arguments: {
      path: 'App.tsx',
      content: 'export default function App() { return <><div data-testid="counter">0</div><button data-testid="reset">Reset</button></>; }',
      description: 'Add reset button'
    }
  });
  await sendSync('Fix UI');

  // 5. Final Verification & Completion
  console.log('\n[5] LLM re-verifies successfully and completes plan...');
  mockGateway.setCustomToolCall({
    id: 'call-verify-2',
    name: 'verify_criterion',
    arguments: {
      criterionId: 'c1',
      status: 'verified',
      verificationMethod: 'ui_structural',
      commandOrAction: 'check DOM',
      outputSummary: 'Test passed',
      evidence: '<button data-testid="reset">Reset</button>'
    }
  });
  await sendSync('Re-verify');

  mockGateway.setCustomToolCall({
    id: 'call-plan-2',
    name: 'manage_plan',
    arguments: {
      action: 'update_step',
      stepId: 'step1',
      status: 'completed'
    }
  });
  await sendSync('Complete step');

  const finalPlanJson = JSON.parse(fs.readFileSync(path.join(wsPath, '.peep', 'plan.json'), 'utf8'));
  console.log('  -> Final Plan Status:', finalPlanJson.status);
  
  if (finalPlanJson.status === 'completed') {
    console.log('\n✅ SECTION A: Infrastructure E2E Acceptance PASSED.');
  } else {
    console.error('\n❌ SECTION A: Plan did not complete correctly.');
  }
}

run().catch(console.error);
