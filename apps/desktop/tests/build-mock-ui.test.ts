import { buildApi } from '../src/renderer/src/services/build-api';
import { useBuildStore } from '../src/renderer/src/stores/build-store';
import { CloudBuildJob } from '@peep/shared';

let passed = 0;
let failed = 0;

function runTest(name: string, fn: () => void | Promise<void>) {
  return (async () => {
    try {
      await fn();
      console.log(`  ✓ [Test ${passed + failed + 1}] ${name}`);
      passed++;
    } catch (e: any) {
      console.error(`  ✗ [Test ${passed + failed + 1}] ${name}`);
      console.error(`    ${e.message}`);
      failed++;
    }
  })();
}

async function run() {
  console.log('\n  Running Build UI Mock Tests...\n');

  // Override VITE env implicitly since we're in node, it falls back to MockBuildApi
  
  await runTest('BuildStore initializes empty', () => {
    const state = useBuildStore.getState();
    if (state.currentBuild !== null) throw new Error('Expected currentBuild to be null');
    if (state.isBuildPanelOpen !== false) throw new Error('Expected panel to be closed');
  });

  await runTest('MockBuildApi returns queued job initially', async () => {
    const job = await buildApi.startBuild('/mock/path', 'flutter', 'apk');
    if (job.status !== 'queued') throw new Error(`Expected status queued, got ${job.status}`);
    if (job.framework !== 'flutter') throw new Error('Framework mismatch');
    
    useBuildStore.getState().setCurrentBuild(job);
    if (useBuildStore.getState().currentBuild?.id !== job.id) throw new Error('Store did not update');
  });

  await runTest('MockBuildApi transitions from queued to running automatically', async () => {
    const state = useBuildStore.getState();
    const id = state.currentBuild!.id;
    
    // Wait for the 2000ms timeout
    await new Promise(r => setTimeout(r, 2200));
    
    const updated = await buildApi.getBuild(id);
    if (updated.status !== 'running') throw new Error(`Expected status running, got ${updated.status}`);
    if (!updated.startedAt) throw new Error('Expected startedAt to be populated');
  });

  await runTest('MockBuildApi streams logs during running state', async () => {
    const state = useBuildStore.getState();
    const id = state.currentBuild!.id;
    
    let receivedLogs: string[] = [];
    const unsub = buildApi.streamLogs(id, (chunk) => {
      receivedLogs.push(chunk);
    });
    
    // Wait for a few intervals (1500ms each)
    await new Promise(r => setTimeout(r, 3200));
    
    unsub();
    
    if (receivedLogs.length === 0) throw new Error('No logs were streamed');
    if (!receivedLogs[0].includes('Starting build')) throw new Error('Log content mismatch');
  });

  await runTest('MockBuildApi transitions to success and provides artifactUrl', async () => {
    const state = useBuildStore.getState();
    const id = state.currentBuild!.id;
    
    // Wait for completion (Total steps = 8 * 1.5s = 12s)
    await new Promise(r => setTimeout(r, 12000));
    
    const updated = await buildApi.getBuild(id);
    if (updated.status !== 'success') throw new Error(`Expected status success, got ${updated.status}`);
    if (!updated.completedAt) throw new Error('Expected completedAt to be populated');
    if (!updated.artifactUrl) throw new Error('Expected artifactUrl to be populated');
  });

  await runTest('MockBuildApi supports cancellation', async () => {
    const job = await buildApi.startBuild('/path', 'react-native', 'both');
    const cancelled = await buildApi.cancelBuild(job.id);
    
    if (cancelled.status !== 'cancelled') throw new Error(`Expected cancelled, got ${cancelled.status}`);
    if (!cancelled.completedAt) throw new Error('Expected completedAt to be populated on cancel');
  });

  console.log(`\n  🟢 All ${passed} tests passed.`);
  if (failed > 0) process.exit(1);
}

run().catch(console.error);
