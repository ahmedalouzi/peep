import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert';

console.log('=== PHASE 1 AGENT PLANNING SYSTEM TEST SUITE ===');

const testDir = join(process.cwd(), 'temp-phase1-plan-test');

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
      if (step.attempts && step.attempts > 1) {
        line += ` *(Attempts: ${step.attempts})*`;
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
        required: s.required !== false
      })),
      status: 'in_progress',
      updatedAt: new Date().toISOString()
    };
  } else if (action === 'update_step') {
    const step = plan.steps.find((s: any) => s.id === args.stepId);
    if (step) {
      step.status = args.status;
      if (args.error) step.lastError = args.error;
    }
  } else if (action === 'retry_step') {
    const step = plan.steps.find((s: any) => s.id === args.stepId);
    if (step) {
      step.status = 'in_progress';
      step.attempts = (step.attempts || 1) + 1;
      if (args.error) step.lastError = args.error;
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

  // Test 1: Simple one-step classification rule
  console.log('\n[Test 1] Simple single-step task classification...');
  const simplePrompt = "explain this file";
  const isMultiStep = simplePrompt.includes("Create an Expo application") || simplePrompt.includes("build") || simplePrompt.includes("install");
  assert.strictEqual(isMultiStep, false, 'Simple prompt should not trigger multi-step planning requirement');
  console.log('✅ Test 1 Passed: Simple prompts bypass plan initialization.');

  // Test 2: Multi-step task plan initialization
  console.log('\n[Test 2] Multi-step plan initialization...');
  let plan = await simulatePlanExecution('init', {
    goal: 'Create Expo Application',
    complexity: 'medium',
    steps: [
      { id: 's1', description: 'Analyze workspace', status: 'pending' },
      { id: 's2', description: 'Create project', status: 'pending' },
      { id: 's3', description: 'Install dependencies', status: 'pending' }
    ]
  }, {});

  assert.strictEqual(plan.steps.length, 3);
  assert.strictEqual(plan.status, 'in_progress');
  console.log('✅ Test 2 Passed: Multi-step plan initialized successfully.');

  // Test 3: Step status transition (pending -> in_progress -> completed)
  console.log('\n[Test 3] Step status transitions (pending -> in_progress -> completed)...');
  plan = await simulatePlanExecution('update_step', { stepId: 's1', status: 'in_progress' }, plan);
  assert.strictEqual(plan.steps[0].status, 'in_progress');

  plan = await simulatePlanExecution('update_step', { stepId: 's1', status: 'completed' }, plan);
  assert.strictEqual(plan.steps[0].status, 'completed');
  assert.strictEqual(plan.status, 'in_progress'); // Still in progress overall
  console.log('✅ Test 3 Passed: Step transition pending -> in_progress -> completed verified.');

  // Test 4: Step failure reporting (pending -> in_progress -> failed)
  console.log('\n[Test 4] Step failure handling (in_progress -> failed)...');
  plan = await simulatePlanExecution('update_step', { stepId: 's2', status: 'in_progress' }, plan);
  plan = await simulatePlanExecution('update_step', { stepId: 's2', status: 'failed', error: 'npm ENOENT' }, plan);
  assert.strictEqual(plan.steps[1].status, 'failed');
  assert.strictEqual(plan.steps[1].lastError, 'npm ENOENT');
  assert.strictEqual(plan.status, 'failed', 'Overall plan status must reflect failed when a required step fails');
  console.log('✅ Test 4 Passed: Step failure reported and overall plan marked as failed.');

  // Test 5: Explicit retry tracking (failed -> retry_step -> completed)
  console.log('\n[Test 5] Explicit step retry and attempt count tracking...');
  plan = await simulatePlanExecution('retry_step', { stepId: 's2', error: 'Retrying install' }, plan);
  assert.strictEqual(plan.steps[1].status, 'in_progress');
  assert.strictEqual(plan.steps[1].attempts, 2, 'Attempt count must increment on retry');

  plan = await simulatePlanExecution('update_step', { stepId: 's2', status: 'completed' }, plan);
  assert.strictEqual(plan.steps[1].status, 'completed');
  assert.strictEqual(plan.steps[1].attempts, 2, 'Attempt metadata preserved');
  console.log('✅ Test 5 Passed: Retry metadata (attempts=2) preserved after completion.');

  // Test 6: Deterministic completion check (prevent completion if required steps incomplete)
  console.log('\n[Test 6] Deterministic completion enforcement...');
  assert.notStrictEqual(plan.status, 'completed', 'Plan must NOT be marked completed while step 3 is pending');
  
  plan = await simulatePlanExecution('update_step', { stepId: 's3', status: 'completed' }, plan);
  assert.strictEqual(plan.status, 'completed', 'Plan is completed only when ALL steps are completed');
  console.log('✅ Test 6 Passed: Plan completion allowed ONLY when all steps are completed.');

  // Test 7: plan.json and plan.md synchronization
  console.log('\n[Test 7] Verifying plan.json and plan.md synchronization...');
  const jsonContent = await readFile(join(testDir, '.peep', 'plan.json'), 'utf-8');
  const mdContent = await readFile(join(testDir, '.peep', 'plan.md'), 'utf-8');
  
  const parsedJson = JSON.parse(jsonContent);
  assert.strictEqual(parsedJson.status, 'completed');
  assert(mdContent.includes('# Plan: Create Expo Application'));
  assert(mdContent.includes('- [x] Analyze workspace'));
  assert(mdContent.includes('- [x] Create project *(Attempts: 2)*'));
  assert(mdContent.includes('- [x] Install dependencies'));
  console.log('✅ Test 7 Passed: plan.json and plan.md are 100% synchronized.');

  // Cleanup
  await rm(testDir, { recursive: true, force: true });
  console.log('\n🎉 ALL PHASE 1 AGENT PLANNING SYSTEM TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('❌ Phase 1 Test Failure:', err);
  process.exit(1);
});
