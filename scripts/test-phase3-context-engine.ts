import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert';
import { ProjectIndexer } from '../packages/agent/src/intelligence/indexer';
import { ProjectRetrieval } from '../packages/agent/src/intelligence/retrieval';

console.log('=== PHASE 3 CONTEXT ENGINE TEST SUITE ===');

const testDir = join(process.cwd(), 'temp-phase3-context-test');

async function setup() {
  await rm(testDir, { recursive: true, force: true });
  await mkdir(join(testDir, 'src/components'), { recursive: true });
  await mkdir(join(testDir, 'src/services'), { recursive: true });
  await mkdir(join(testDir, 'src/config'), { recursive: true });

  // Create a dependency chain: Button <- Form <- Screen
  await writeFile(join(testDir, 'src/components/Button.tsx'), 'export const Button = () => <button/>;');
  await writeFile(join(testDir, 'src/components/Form.tsx'), `import { Button } from './Button';\nexport const Form = () => <Button/>;`);
  await writeFile(join(testDir, 'src/Screen.tsx'), `import { Form } from './components/Form';\nexport const Screen = () => <Form/>;`);
  
  // Secrets
  await writeFile(join(testDir, '.env'), 'OPENAI_API_KEY=sk-test1234');
  await writeFile(join(testDir, 'src/config/secrets.ts'), 'export const TOKEN = "secret";');
  
  // Theme
  await writeFile(join(testDir, 'src/theme.ts'), 'export const colors = { primary: "#000" };');
}

async function runTests() {
  await setup();

  console.log('\n[Test 1] Testing AST Dependency Graph & Impact Radius...');
  const indexer = new ProjectIndexer(testDir, 'react-native');
  await indexer.fullIndex();

  const graphBuilder = indexer.getDependencyGraphBuilder();
  const graph = graphBuilder.getGraph();

  // Button should have no imports, Form imports Button, Screen imports Form
  assert.ok(graph.imports['src/components/Form.tsx'].includes('src/components/Button.tsx'), 'Form should import Button');
  assert.ok(graph.dependents['src/components/Button.tsx'].includes('src/components/Form.tsx'), 'Button should have Form as dependent');

  const impact = graphBuilder.getImpactRadius(['src/components/Button.tsx']);
  assert.ok(impact.includes('src/components/Form.tsx'), 'Impact should include Form');
  assert.ok(impact.includes('src/Screen.tsx'), 'Impact should include Screen (depth 2)');
  console.log('✅ Test 1 Passed: Dependency Graph parsed and impact radius computed accurately.');

  console.log('\n[Test 2] Testing Context Budget & Secret Safeguards...');
  const retrieval = new ProjectRetrieval(indexer.getIndex(), testDir);
  
  // Small budget test
  const smallResult = retrieval.retrieveRelevantContext('Form', 50); // Very small limit
  assert.ok(smallResult.filesRead.length === 0, 'Should not read any files if budget is too small');
  
  const result = retrieval.retrieveRelevantContext('Form', 200000);
  assert.ok(result.summary.includes('Form.tsx'), 'Should retrieve Form');
  assert.ok(result.summary.includes('Button.tsx'), 'Should retrieve Button via impact expansion');
  
  // Secret Check
  assert.ok(!result.summary.includes('OPENAI_API_KEY'), 'Must NOT leak .env');
  assert.ok(!result.summary.includes('secrets.ts'), 'Must NOT leak secrets.ts');
  console.log('✅ Test 2 Passed: Context budget enforced and secrets protected from AI Gateway.');

  console.log('\n[Test 3] Testing Incremental Indexing Performance...');
  const startIncremental = performance.now();
  await indexer.incrementalIndex();
  const endIncremental = performance.now();
  
  const duration = endIncremental - startIncremental;
  assert.ok(duration < 20, 'Incremental index of unchanged repo should be near 0ms');
  console.log(`✅ Test 3 Passed: Incremental scan took ${duration.toFixed(2)}ms.`);

  console.log('\n🎉 ALL PHASE 3 CONTEXT ENGINE TESTS PASSED SUCCESSFULLY!\n');
  await rm(testDir, { recursive: true, force: true });
}

runTests().catch((e) => {
  console.error('\n❌ Phase 3 Test Failure:', e);
  process.exit(1);
});
