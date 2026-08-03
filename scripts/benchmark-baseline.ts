import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { ProjectIndexer, ProjectRetrieval } from '../packages/agent/src/index';

console.log('=== STEP 1: BASELINE PERFORMANCE BENCHMARK ===');

const testDir = join(process.cwd(), 'temp-baseline-benchmark');

async function createSampleProject() {
  await rm(testDir, { recursive: true, force: true });
  await mkdir(join(testDir, 'src', 'components'), { recursive: true });
  await mkdir(join(testDir, 'src', 'screens'), { recursive: true });
  await mkdir(join(testDir, 'src', 'services'), { recursive: true });

  // Create 30 sample files
  for (let i = 1; i <= 10; i++) {
    await writeFile(
      join(testDir, 'src', 'components', `Button${i}.tsx`),
      `import React from 'react';\nimport { render } from '../services/api';\nexport const Button${i} = () => <button>Btn ${i}</button>;`
    );
    await writeFile(
      join(testDir, 'src', 'screens', `Screen${i}.tsx`),
      `import { Button${i} } from '../components/Button${i}';\nexport const Screen${i} = () => <div>Screen ${i}</div>;`
    );
    await writeFile(
      join(testDir, 'src', 'services', `api${i}.ts`),
      `export function fetchData${i}() { return Promise.resolve(${i}); }`
    );
  }
}

async function runBenchmark() {
  await createSampleProject();

  const indexer = new ProjectIndexer(testDir, 'react-native');
  
  // Benchmark Full Indexing
  const startFull = performance.now();
  await indexer.fullIndex();
  const endFull = performance.now();
  const fullDuration = endFull - startFull;

  // Benchmark Retrieval
  const index = indexer.getIndex();
  const retrieval = new ProjectRetrieval(index);
  const startRet = performance.now();
  const context = retrieval.retrieveRelevantContext('Screen1 Button1 api1');
  const endRet = performance.now();
  const retDuration = endRet - startRet;

  console.log(`📊 Baseline Full Indexing Duration: ${fullDuration.toFixed(2)} ms`);
  console.log(`📊 Baseline Context Retrieval Duration: ${retDuration.toFixed(2)} ms`);
  console.log(`📄 Retrieved Context Length: ${context.length} characters`);

  // Cleanup
  await rm(testDir, { recursive: true, force: true });
  console.log('✅ Baseline benchmark finished cleanly.');
}

runBenchmark().catch((err) => {
  console.error('❌ Baseline benchmark failed:', err);
  process.exit(1);
});
