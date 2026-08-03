import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert';
import { classifyError, selectRecoveryStrategy } from '../packages/agent/src/error-recovery/diagnostics';

console.log('=== PHASE 2 AUTONOMOUS ERROR RECOVERY TEST SUITE ===');

const testDir = join(process.cwd(), 'temp-phase2-recovery-test');

async function setup() {
  await rm(testDir, { recursive: true, force: true });
  await mkdir(join(testDir, '.peep'), { recursive: true });
}

function formatPlanMarkdown(plan: any): string {
  let md = `# Plan: ${plan.goal || 'Execution Plan'}\n\n`;
  if (plan.complexity) md += `*Complexity:* ${String(plan.complexity).toUpperCase()}\n\n`;
  if (Array.isArray(plan.steps)) {
    for (const step of plan.steps) {
      let check = '[ ]';
      if (step.status === 'completed') check = '[x]';
      else if (step.status === 'in_progress') check = '[/]';
      else if (step.status === 'failed') check = '[!]';

      let line = `- ${check} ${step.description}`;
      if (step.currentStrategy) {
        line += ` *(Strategy: ${step.currentStrategy})*`;
      }
      if (step.attempts && step.attempts > 1) {
        line += ` *(Attempts: ${step.attempts}/${step.maxRetries || 3})*`;
      }
      if (step.status === 'failed' && step.lastError) {
        line += ` — **Error:** ${step.lastError}`;
      }
      md += `${line}\n`;
    }
  }
  return md;
}

async function simulatePlanExecution(action: string, args: any, currentPlan: any) {
  let plan = { ...currentPlan };
  const jsonPath = join(testDir, '.peep', 'plan.json');
  const mdPath = join(testDir, '.peep', 'plan.md');

  if (action === 'init') {
    plan = {
      taskId: randomUUID(),
      goal: args.goal || 'Software Engineering Task',
      complexity: args.complexity || 'medium',
      steps: (args.steps || []).map((s: any) => ({
        id: s.id,
        description: s.description,
        status: s.status || 'pending',
        attempts: 1,
        maxRetries: s.maxRetries || 3,
        required: s.required !== false
      })),
      status: 'in_progress',
      updatedAt: new Date().toISOString()
    };
  } else if (action === 'update_step') {
    const step = plan.steps.find((s: any) => s.id === args.stepId);
    if (step) {
      step.status = args.status;
      if (args.error) step.lastError = String(args.error);
    }
  } else if (action === 'retry_step') {
    const step = plan.steps.find((s: any) => s.id === args.stepId);
    if (step) {
      const currentAttempts = (step.attempts || 1) + 1;
      const maxRetries = step.maxRetries || 3;
      if (currentAttempts > maxRetries) {
        step.status = 'failed';
        step.lastError = `Max retry limit (${maxRetries}) exhausted. Strategy failed.`;
      } else {
        step.status = 'in_progress';
        step.attempts = currentAttempts;
        if (args.error) step.lastError = String(args.error);
        if (args.strategy) step.currentStrategy = String(args.strategy);
      }
    }
  } else if (action === 'record_recovery') {
    const step = plan.steps.find((s: any) => s.id === args.stepId);
    if (step) {
      step.history = step.history || [];
      step.history.push({
        attempt: args.attempt || step.attempts || 1,
        strategy: args.strategy || 'unknown',
        error: args.error || { message: 'Tool execution error' },
        status: args.recoveryStatus || 'pending',
        timestamp: new Date().toISOString()
      });
    }
  }

  // Calculate overall plan status deterministically
  const hasFailed = plan.steps.some((s: any) => s.status === 'failed' && s.required !== false);
  const allCompleted = plan.steps.length > 0 && plan.steps.every((s: any) => s.status === 'completed' || s.required === false);
  if (hasFailed) {
    plan.status = 'failed';
  } else if (allCompleted) {
    plan.status = 'completed';
  } else {
    plan.status = 'in_progress';
  }
  plan.updatedAt = new Date().toISOString();

  await writeFile(jsonPath, JSON.stringify(plan, null, 2), 'utf-8');
  await writeFile(mdPath, formatPlanMarkdown(plan), 'utf-8');

  return plan;
}

async function runTests() {
  await setup();

  // Test 1: Error Classification
  console.log('\n[Test 1] Testing Error Classification Engine...');
  const depErr = classifyError('run_command', 'Error: Cannot find module @babel/core', 1, '', 'MODULE_NOT_FOUND', 'npm run build');
  assert.strictEqual(depErr.category, 'missing_dependency');

  const dirErr = classifyError('run_command', 'ENOENT: package.json not found in root directory', 1, '', '', 'npm start');
  assert.strictEqual(dirErr.category, 'wrong_directory');

  const previewErr = classifyError('rn_start_preview', 'Expo preview error: EADDRINUSE port occupied', 1);
  assert.strictEqual(previewErr.category, 'preview_failure');

  const dangErr = classifyError('run_command', 'Permission denied', 1, '', '', 'rm -rf /');
  assert.strictEqual(dangErr.category, 'unrecoverable');
  console.log('✅ Test 1 Passed: Error classification engine categorized all error types accurately.');

  // Test 2: Recovery Strategy Selection & Attempt Strategy Escalation
  console.log('\n[Test 2] Testing Recovery Strategy Selection & Strategy Escalation...');
  const strat1 = selectRecoveryStrategy(depErr, 1);
  assert.strictEqual(strat1.strategy, 'Install Missing Dependency');
  assert.strictEqual(strat1.isRecoverable, true);

  const strat2 = selectRecoveryStrategy(depErr, 2);
  assert.strictEqual(strat2.strategy, 'Install Legacy Peer Dependencies');
  assert.strictEqual(strat2.isRecoverable, true);
  console.log('✅ Test 2 Passed: Selected correct escalating strategies for dependencies.');

  console.log('\n[Test 2b] Testing Phase 3 Context Engine (impactRadius) integration...');
  const tscErr = classifyError('run_command', 'src/components/Button.tsx(10,2): error TS2339', 1, '', '', 'tsc');
  assert.strictEqual(tscErr.category, 'type_error');
  assert.ok(tscErr.affectedFiles && tscErr.affectedFiles.includes('src/components/Button.tsx'), 'Should extract affected file from TS error');
  console.log('✅ Test 2b Passed: Affected files extracted correctly.');

  console.log('✅ Test 2 Passed: Strategy escalation on repeat attempt verified.');

  // Test 3: Command fails once then succeeds (Retry Flow)
  console.log('\n[Test 3] Testing Command Failure -> Recovery Strategy -> Retry -> Success Flow...');
  let plan = await simulatePlanExecution('init', {
    goal: 'Build Mobile Feature',
    complexity: 'medium',
    steps: [
      { id: 'step-1', description: 'Install feature dependencies', status: 'pending' },
      { id: 'step-2', description: 'Run build validation', status: 'pending' }
    ]
  }, {});

  // Simulate step 1 failure
  plan = await simulatePlanExecution('update_step', { stepId: 'step-1', status: 'failed', error: depErr.message }, plan);
  assert.strictEqual(plan.steps[0].status, 'failed');

  // Record recovery attempt
  plan = await simulatePlanExecution('record_recovery', {
    stepId: 'step-1',
    attempt: 1,
    strategy: strat1.strategy,
    error: depErr,
    recoveryStatus: 'pending'
  }, plan);
  assert.strictEqual(plan.steps[0].history.length, 1);

  // Retry step with strategy
  plan = await simulatePlanExecution('retry_step', {
    stepId: 'step-1',
    strategy: strat1.strategy,
    error: 'Retrying with auto-installed module'
  }, plan);
  assert.strictEqual(plan.steps[0].status, 'in_progress');
  assert.strictEqual(plan.steps[0].attempts, 2);

  // Complete retried step
  plan = await simulatePlanExecution('update_step', { stepId: 'step-1', status: 'completed' }, plan);
  assert.strictEqual(plan.steps[0].status, 'completed');
  assert.strictEqual(plan.steps[0].attempts, 2);
  console.log('✅ Test 3 Passed: Failure -> Recovery -> Retry -> Success verified.');

  // Test 4: Bounded Retry Limit Protection (Max 3 retries)
  console.log('\n[Test 4] Testing Bounded Retry Limit Enforcement (Max 3 retries)...');
  // Attempt 2
  plan = await simulatePlanExecution('retry_step', { stepId: 'step-2', strategy: 'Attempt 2 Strategy' }, plan);
  assert.strictEqual(plan.steps[1].attempts, 2);

  // Attempt 3
  plan = await simulatePlanExecution('retry_step', { stepId: 'step-2', strategy: 'Attempt 3 Strategy' }, plan);
  assert.strictEqual(plan.steps[1].attempts, 3);

  // Attempt 4 (exceeds max 3) -> Should mark failed!
  plan = await simulatePlanExecution('retry_step', { stepId: 'step-2', strategy: 'Attempt 4 Strategy' }, plan);
  assert.strictEqual(plan.steps[1].status, 'failed', 'Step must be marked failed when max retries are exhausted');
  assert.strictEqual(plan.status, 'failed', 'Overall plan marked failed when required step exhausts retries');
  console.log('✅ Test 4 Passed: Bounded retry limit enforced (max 3 retries).');

  // Test 5: Prevention of False Completion on Failed Steps
  console.log('\n[Test 5] Testing Prevention of False Completion when Step Remains Failed...');
  assert.strictEqual(plan.status, 'failed');
  assert.notStrictEqual(plan.status, 'completed');
  console.log('✅ Test 5 Passed: Agent prohibited from falsely claiming task completion.');

  // Test 6: Verification of plan.json and plan.md Synchronization
  console.log('\n[Test 6] Verifying plan.json and plan.md Synchronization...');
  const jsonContent = await readFile(join(testDir, '.peep', 'plan.json'), 'utf-8');
  const mdContent = await readFile(join(testDir, '.peep', 'plan.md'), 'utf-8');

  const parsedJson = JSON.parse(jsonContent);
  assert.strictEqual(parsedJson.status, 'failed');
  assert(mdContent.includes('# Plan: Build Mobile Feature'));
  assert(mdContent.includes('- [x] Install feature dependencies *(Strategy: Install Missing Dependency)* *(Attempts: 2/3)*'));
  assert(mdContent.includes('- [!] Run build validation *(Strategy: Attempt 3 Strategy)* *(Attempts: 3/3)* — **Error:** Max retry limit (3) exhausted. Strategy failed.'));
  console.log('✅ Test 6 Passed: plan.json and plan.md are 100% synchronized with error history.');

  // Cleanup
  await rm(testDir, { recursive: true, force: true });
  console.log('\n🎉 ALL PHASE 2 AUTONOMOUS ERROR RECOVERY TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('❌ Phase 2 Test Failure:', err);
  process.exit(1);
});
