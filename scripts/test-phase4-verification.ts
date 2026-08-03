import { ProjectIndexer } from '../packages/agent/src/intelligence/indexer';
import { DependencyGraphBuilder } from '../packages/agent/src/intelligence/dependency-graph';
import { classifyError, selectRecoveryStrategy } from '../packages/agent/src/error-recovery/diagnostics';
import { VerificationEngine } from '../packages/agent/src/verification/verification-engine';
import { TestGenerator } from '../packages/agent/src/verification/test-generator';
import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';

async function runTests() {
  console.log('=== PHASE 4 AUTONOMOUS VERIFICATION TEST SUITE ===\n');

  // Set up mock workspace
  const testDir = path.join(process.cwd(), 'temp-phase4-verification-test');
  if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });
  
  // Create mock files
  const componentsDir = path.join(testDir, 'src', 'components');
  fs.mkdirSync(componentsDir, { recursive: true });
  
  fs.writeFileSync(path.join(componentsDir, 'Counter.tsx'), `
    export function Counter() { return <div data-testid="counter">0</div>; }
  `);
  
  fs.writeFileSync(path.join(componentsDir, 'Counter.test.tsx'), `
    import { render } from '@testing-library/react';
    import { Counter } from './Counter';
    test('renders', () => { render(<Counter />); });
  `);

  fs.writeFileSync(path.join(componentsDir, 'SharedButton.tsx'), `
    export function SharedButton() { return <button>Click</button>; }
  `);
  
  const indexer = new ProjectIndexer(testDir);
  await indexer.fullIndex();

  console.log('[Test 1] Testing VerificationEngine Target Scope (Phase 3 Impact Radius)...');
  const scope1 = VerificationEngine.getTargetedVerificationScope(['src/components/Counter.tsx'], indexer);
  assert.ok(scope1.filesToVerify.includes('src/components/Counter.tsx'));
  assert.ok(scope1.testCommand?.includes('Counter'), 'Should find Counter test');
  assert.ok(!scope1.testCommand?.includes('SharedButton'), 'Should not run unrelated test');
  console.log('✅ Test 1 Passed: Verification Engine computes correct test scopes.');

  console.log('\n[Test 2] Testing TestGenerator Policy...');
  const shouldGen1 = TestGenerator.shouldGenerateTest('src/components/Counter.tsx', '...', indexer, false);
  assert.strictEqual(shouldGen1, false, 'Should not generate if test already exists');
  
  const shouldGen2 = TestGenerator.shouldGenerateTest('src/components/SharedButton.tsx', 'export function SharedButton() {}', indexer, false);
  assert.strictEqual(shouldGen2, true, 'Should generate for component missing test in a project that has tests');
  console.log('✅ Test 2 Passed: TestGenerator applies intelligent policies.');

  console.log('\n[Test 3] Testing UI Structural Verification (DOM Scraping)...');
  const html = `<body><div data-testid="increment"></div><div aria-label="decrement"></div><button>Submit</button></body>`;
  assert.ok(VerificationEngine.isStructuralUIValid(html, ['increment', 'decrement', 'submit']));
  assert.ok(!VerificationEngine.isStructuralUIValid(html, ['increment', 'missing-id']));
  console.log('✅ Test 3 Passed: DOM structural verification passes correctly.');

  console.log('\n[Test 4] Testing Verification Failure Recovery (Phase 2 Integration)...');
  const err = classifyError('verify_criterion', 'Verification failed for Counter: expect(received).toBe(expected)');
  assert.strictEqual(err.category, 'verification_failure', 'Should classify as verification_failure');
  
  const strat = selectRecoveryStrategy(err, 1, 3, indexer);
  assert.ok(strat.strategy.includes('Analyze Verification Trace'), 'Should recommend analyzing trace on attempt 1');
  assert.ok(strat.isRecoverable);
  console.log('✅ Test 4 Passed: Verification failures flow into Phase 2 Recovery.');

  console.log('\n🎉 ALL PHASE 4 TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch(e => {
  console.error('\n❌ Phase 4 Test Failure:', e);
  process.exit(1);
});
