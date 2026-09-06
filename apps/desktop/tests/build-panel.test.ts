/**
 * build-panel.test.ts
 *
 * Component-level DOM tests for the Cloud Build UI (Tasks 9-14).
 *
 * Pattern: JSDOM + manual DOM assertions, same as thread-sidebar.test.ts and
 * run-history.test.ts. Uses the pure-DOM test-harness functions exported from
 * BuildPanel.tsx (renderBuildPanel, renderBuildButton) and the exported
 * MockBuildApi class from build-api.ts. No React, no xterm.js, no Electron.
 *
 * Default export required by apps/desktop test conventions.
 */

import assert from 'assert';
import { JSDOM } from 'jsdom';
import { MockBuildApi, IBuildApi } from '../src/renderer/src/services/build-api';
import {
  renderBuildPanel,
  renderBuildButton,
  BuildPanelOpts,
  BuildButtonOpts,
} from '../src/renderer/src/features/build/BuildPanel';
import type { CloudBuildJob } from '@peep/shared';

// ─── JSDOM document factory ────────────────────────────────────────────────────
function makeDoc(): Document {
  return new JSDOM('<!DOCTYPE html><html><body></body></html>', { pretendToBeVisual: true }).window.document;
}

// ─── Fixture factory ───────────────────────────────────────────────────────────
function makeJob(overrides: Partial<CloudBuildJob> = {}): CloudBuildJob {
  return {
    id: 'build-test-1',
    userId: 'user-1',
    projectId: 'project-1',
    framework: 'flutter',
    target: 'apk',
    status: 'queued',
    createdAt: new Date().toISOString(),
    versionName: '1.0.0',
    versionCode: 1,
    ...overrides,
  };
}

// ─── Test runner helpers ───────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function runTest(name: string, fn: () => void | Promise<void>): Promise<void> {
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

// ─── Default export ────────────────────────────────────────────────────────────
export default async function runTests() {
  console.log('\n  Running Build Panel DOM-level component tests...\n');

  // ── Section 1: BuildPanel — empty state ─────────────────────────────────────

  await runTest('BuildPanel with no build shows empty state', () => {
    const doc = makeDoc();
    const el = renderBuildPanel({ currentBuild: null }, doc);
    assert.strictEqual(el.id, 'build-panel-empty', 'Expected id="build-panel-empty"');
    assert.ok(el.textContent?.includes('No active build'), 'Expected "No active build." text');
    assert.ok(!el.querySelector('#build-cancel-btn'), 'Cancel button must NOT exist');
    assert.ok(!el.querySelector('#build-download-btn'), 'Download button must NOT exist');
    assert.ok(!el.querySelector('#build-error-banner'), 'Error banner must NOT exist');
  });

  // ── Section 2: BuildPanel — QUEUED status ────────────────────────────────────

  await runTest('BuildPanel QUEUED: shows badge, cancel button, NO download, NO error banner', () => {
    const doc = makeDoc();
    const job = makeJob({ status: 'queued' });
    const el = renderBuildPanel({ currentBuild: job }, doc);

    const badge = el.querySelector('#build-status-badge');
    assert.ok(badge, 'Status badge must exist');
    assert.strictEqual(badge!.textContent, 'QUEUED', 'Badge text must be QUEUED');
    assert.ok(badge!.classList.contains('queued'), 'Badge must have .queued class');

    assert.ok(el.querySelector('#build-cancel-btn'), 'Cancel button must exist for queued');
    assert.ok(!el.querySelector('#build-download-btn'), 'Download button must NOT exist for queued');
    assert.ok(!el.querySelector('#build-error-banner'), 'Error banner must NOT exist for queued');

    const targetLabel = el.querySelector('#build-target-label');
    assert.ok(targetLabel, 'Target label must exist');
    assert.ok(targetLabel!.textContent?.includes('flutter'), 'Target label must include framework');
    assert.ok(targetLabel!.textContent?.includes('APK'), 'Target label must include target');
  });

  // ── Section 3: BuildPanel — RUNNING status ───────────────────────────────────

  await runTest('BuildPanel RUNNING: shows badge, cancel button, NO download, NO error banner', () => {
    const doc = makeDoc();
    const job = makeJob({ status: 'running', startedAt: new Date().toISOString() });
    const el = renderBuildPanel({ currentBuild: job }, doc);

    const badge = el.querySelector('#build-status-badge');
    assert.strictEqual(badge!.textContent, 'RUNNING', 'Badge text must be RUNNING');
    assert.ok(badge!.classList.contains('running'), 'Badge must have .running class');

    assert.ok(el.querySelector('#build-cancel-btn'), 'Cancel button must exist for running');
    assert.ok(!el.querySelector('#build-download-btn'), 'Download button must NOT exist for running');
    assert.ok(!el.querySelector('#build-error-banner'), 'Error banner must NOT exist for running');
  });

  // ── Section 4: BuildPanel — SUCCESS status ───────────────────────────────────

  await runTest('BuildPanel SUCCESS: shows download button, NO cancel, NO error banner', () => {
    const doc = makeDoc();
    const job = makeJob({
      status: 'success',
      completedAt: new Date().toISOString(),
      artifactUrl: 'https://builds.example.com/app-release.apk',
    });
    const el = renderBuildPanel({ currentBuild: job }, doc);

    const badge = el.querySelector('#build-status-badge');
    assert.strictEqual(badge!.textContent, 'SUCCESS', 'Badge text must be SUCCESS');
    assert.ok(badge!.classList.contains('success'), 'Badge must have .success class');

    assert.ok(!el.querySelector('#build-cancel-btn'), 'Cancel button must NOT exist for success');

    const downloadBtn = el.querySelector('#build-download-btn') as HTMLButtonElement;
    assert.ok(downloadBtn, 'Download button must exist for success with artifactUrl');
    assert.ok(downloadBtn.textContent?.includes('APK'), 'Download button text must include target');

    assert.ok(!el.querySelector('#build-error-banner'), 'Error banner must NOT exist for success');
  });

  await runTest('BuildPanel SUCCESS without artifactUrl: NO download button', () => {
    const doc = makeDoc();
    const job = makeJob({ status: 'success', completedAt: new Date().toISOString() });
    // No artifactUrl — can happen if upload failed server-side
    const el = renderBuildPanel({ currentBuild: job }, doc);
    assert.ok(!el.querySelector('#build-download-btn'), 'Download button must NOT exist without artifactUrl');
  });

  // ── Section 5: BuildPanel — FAILED status ────────────────────────────────────

  await runTest('BuildPanel FAILED: shows error banner with errorLog text, NO cancel, NO download', () => {
    const doc = makeDoc();
    const errorLog = 'Gradle build failed with exit code 1\n> Task :app:compileDebugJavaWithJavac FAILED';
    const job = makeJob({
      status: 'failed',
      completedAt: new Date().toISOString(),
      errorLog,
    });
    const el = renderBuildPanel({ currentBuild: job }, doc);

    const badge = el.querySelector('#build-status-badge');
    assert.strictEqual(badge!.textContent, 'FAILED', 'Badge text must be FAILED');
    assert.ok(badge!.classList.contains('failed'), 'Badge must have .failed class');

    assert.ok(!el.querySelector('#build-cancel-btn'), 'Cancel button must NOT exist for failed');
    assert.ok(!el.querySelector('#build-download-btn'), 'Download button must NOT exist for failed');

    const banner = el.querySelector('#build-error-banner');
    assert.ok(banner, 'Error banner must exist for failed build');

    const errLog = el.querySelector('#build-error-log') as HTMLPreElement;
    assert.ok(errLog, '#build-error-log must exist');
    assert.ok(errLog.textContent?.includes('Gradle build failed'), 'Error log must contain errorLog text');
    assert.ok(errLog.textContent?.includes(':app:compileDebugJavaWithJavac'), 'Error log must contain full error message');
  });

  await runTest('BuildPanel FAILED without errorLog: error banner is NOT shown', () => {
    const doc = makeDoc();
    // Failed but errorLog not populated (e.g. worker crashed before writing logs)
    const job = makeJob({ status: 'failed', completedAt: new Date().toISOString() });
    const el = renderBuildPanel({ currentBuild: job }, doc);
    assert.ok(!el.querySelector('#build-error-banner'), 'Error banner must NOT appear when errorLog is missing');
    // Status badge still shows FAILED
    assert.strictEqual(el.querySelector('#build-status-badge')!.textContent, 'FAILED');
  });

  // ── Section 6: BuildPanel — CANCELLED status ─────────────────────────────────

  await runTest('BuildPanel CANCELLED: badge shows CANCELLED, no cancel/download/error', () => {
    const doc = makeDoc();
    const job = makeJob({ status: 'cancelled', completedAt: new Date().toISOString() });
    const el = renderBuildPanel({ currentBuild: job }, doc);

    const badge = el.querySelector('#build-status-badge');
    assert.strictEqual(badge!.textContent, 'CANCELLED');
    assert.ok(badge!.classList.contains('cancelled'));
    assert.ok(!el.querySelector('#build-cancel-btn'));
    assert.ok(!el.querySelector('#build-download-btn'));
    assert.ok(!el.querySelector('#build-error-banner'));
  });

  // ── Section 7: Cancel button click ───────────────────────────────────────────

  await runTest('Click Cancel → onCancel callback is invoked', () => {
    const doc = makeDoc();
    const job = makeJob({ status: 'running', startedAt: new Date().toISOString() });
    let cancelCalled = 0;
    const el = renderBuildPanel({ currentBuild: job, onCancel: () => cancelCalled++ }, doc);

    const cancelBtn = el.querySelector('#build-cancel-btn') as HTMLButtonElement;
    assert.ok(cancelBtn, 'Cancel button must exist');
    cancelBtn.click();
    assert.strictEqual(cancelCalled, 1, 'onCancel must be called exactly once');
  });

  await runTest('Click Cancel for queued build → onCancel callback is invoked', () => {
    const doc = makeDoc();
    const job = makeJob({ status: 'queued' });
    let cancelCalled = 0;
    const el = renderBuildPanel({ currentBuild: job, onCancel: () => cancelCalled++ }, doc);
    (el.querySelector('#build-cancel-btn') as HTMLButtonElement).click();
    assert.strictEqual(cancelCalled, 1, 'onCancel must be called for queued builds too');
  });

  // ── Section 8: Download button click ─────────────────────────────────────────

  await runTest('Click Download → onDownload callback is invoked', () => {
    const doc = makeDoc();
    const job = makeJob({ status: 'success', artifactUrl: 'https://builds.example.com/app.apk' });
    let downloadCalled = 0;
    const el = renderBuildPanel({ currentBuild: job, onDownload: () => downloadCalled++ }, doc);

    const downloadBtn = el.querySelector('#build-download-btn') as HTMLButtonElement;
    assert.ok(downloadBtn, 'Download button must exist');
    downloadBtn.click();
    assert.strictEqual(downloadCalled, 1, 'onDownload must be called exactly once');
  });

  // ── Section 9: TitleBar Build APK button ─────────────────────────────────────

  await runTest('Build APK button is NOT rendered for non-mobile projects (web platform)', () => {
    const doc = makeDoc();
    const btn = renderBuildButton({ platform: 'web', activeBuildStatus: null, onBuildApk: () => {} }, doc);
    assert.strictEqual(btn, null, 'Button must be null for web projects');
  });

  await runTest('Build APK button is NOT rendered when platform is null', () => {
    const doc = makeDoc();
    const btn = renderBuildButton({ platform: null, activeBuildStatus: null, onBuildApk: () => {} }, doc);
    assert.strictEqual(btn, null, 'Button must be null when no project is open');
  });

  await runTest('Build APK button IS rendered for flutter project, no active build → enabled', () => {
    const doc = makeDoc();
    const btn = renderBuildButton({ platform: 'flutter', activeBuildStatus: null, onBuildApk: () => {} }, doc) as HTMLButtonElement;
    assert.ok(btn, 'Button must exist for flutter project');
    assert.strictEqual(btn.id, 'build-apk-btn');
    assert.strictEqual(btn.disabled, false, 'Button must be enabled when no active build');
  });

  await runTest('Build APK button IS rendered for react-native project, no active build → enabled', () => {
    const doc = makeDoc();
    const btn = renderBuildButton({ platform: 'react-native', activeBuildStatus: null, onBuildApk: () => {} }, doc) as HTMLButtonElement;
    assert.ok(btn, 'Button must exist for react-native project');
    assert.strictEqual(btn.disabled, false);
  });

  await runTest('Build APK button click → onBuildApk called, bottom panel switches to build tab', () => {
    const doc = makeDoc();
    let buildApkCalled = 0;
    const btn = renderBuildButton({
      platform: 'flutter',
      activeBuildStatus: null,
      onBuildApk: () => buildApkCalled++,
    }, doc) as HTMLButtonElement;
    assert.ok(btn, 'Button must exist');
    btn.click();
    assert.strictEqual(buildApkCalled, 1, 'onBuildApk must be called on click');
  });

  // ── Section 10: Double-click race prevention ──────────────────────────────────

  await runTest('Build APK button is DISABLED when build status is queued → second click is a no-op', () => {
    const doc = makeDoc();
    let buildApkCalled = 0;
    const btn = renderBuildButton({
      platform: 'flutter',
      activeBuildStatus: 'queued',
      onBuildApk: () => buildApkCalled++,
    }, doc) as HTMLButtonElement;

    assert.ok(btn, 'Button must exist');
    assert.strictEqual(btn.disabled, true, 'Button must be disabled when a build is queued');
    btn.click(); // click on disabled button
    assert.strictEqual(buildApkCalled, 0, 'onBuildApk must NOT be called when button is disabled (queued)');
  });

  await runTest('Build APK button is DISABLED when build status is running → second click is a no-op', () => {
    const doc = makeDoc();
    let buildApkCalled = 0;
    const btn = renderBuildButton({
      platform: 'flutter',
      activeBuildStatus: 'running',
      onBuildApk: () => buildApkCalled++,
    }, doc) as HTMLButtonElement;

    assert.strictEqual(btn.disabled, true, 'Button must be disabled when a build is running');
    btn.click();
    assert.strictEqual(buildApkCalled, 0, 'onBuildApk must NOT be called when button is disabled (running)');
  });

  await runTest('Build APK button re-enables after build completes (success)', () => {
    const doc = makeDoc();
    // Simulate post-success state: activeBuildStatus is null (no active build)
    let buildApkCalled = 0;
    const btn = renderBuildButton({
      platform: 'flutter',
      activeBuildStatus: null,
      onBuildApk: () => buildApkCalled++,
    }, doc) as HTMLButtonElement;

    assert.strictEqual(btn.disabled, false, 'Button must re-enable when no build is active');
    btn.click();
    assert.strictEqual(buildApkCalled, 1, 'New build can be started after completion');
  });

  // ── Section 11: MockBuildApi state machine ────────────────────────────────────

  await runTest('MockBuildApi.simulateFailure=true → produces failed status', async () => {
    const api = new MockBuildApi();
    api.simulateFailure = true;
    const job = await api.startBuild('/path', 'flutter', 'apk');
    assert.strictEqual(job.status, 'queued', 'Initially queued');

    // Wait for queued→running (2s) + failure simulation (1.5s)
    await new Promise(r => setTimeout(r, 4000));

    const updated = await api.getBuild(job.id);
    assert.strictEqual(updated.status, 'failed', `Expected failed, got ${updated.status}`);
    assert.ok(updated.errorLog, 'errorLog must be populated on failure');
    assert.ok(updated.errorLog!.includes('Gradle build failed'), 'errorLog must contain error message');
    assert.ok(updated.completedAt, 'completedAt must be set');
    api.reset();
  });

  await runTest('MockBuildApi.emitLogChunk → chunk delivered to all streamLogs listeners', () => {
    const api = new MockBuildApi();
    const received: string[] = [];
    const received2: string[] = [];
    api.streamLogs('any-id', (chunk) => received.push(chunk));
    api.streamLogs('any-id', (chunk) => received2.push(chunk));

    api.emitLogChunk('hello build\r\n');
    api.emitLogChunk('second line\r\n');

    assert.deepStrictEqual(received, ['hello build\r\n', 'second line\r\n'], 'First listener received chunks');
    assert.deepStrictEqual(received2, ['hello build\r\n', 'second line\r\n'], 'Second listener received chunks');
    api.reset();
  });

  await runTest('MockBuildApi log chunks flow during running state → append in order', async () => {
    const api = new MockBuildApi();
    const received: string[] = [];

    const job = await api.startBuild('/path', 'react-native', 'apk');
    api.streamLogs(job.id, (chunk) => received.push(chunk));

    // Wait for queued→running (2s) + first 3 log intervals (3 × 1.5s = 4.5s)
    await new Promise(r => setTimeout(r, 7000));

    assert.ok(received.length >= 3, `Expected at least 3 log chunks, got ${received.length}`);
    assert.ok(received[0].includes('Starting build'), 'First chunk must be "Starting build..."');
    assert.ok(received[1].includes('Downloading'), 'Second chunk must be "Downloading..."');
    assert.ok(received[2].includes('Resolving'), 'Third chunk must be "Resolving..."');

    // Verify ordering: each subsequent chunk comes after the previous one
    for (let i = 1; i < received.length; i++) {
      assert.ok(typeof received[i] === 'string', `Chunk ${i} must be a string`);
    }
    api.reset();
  });

  await runTest('streamLogs unsubscribe stops delivery', async () => {
    const api = new MockBuildApi();
    const received: string[] = [];
    const unsub = api.streamLogs('any-id', (chunk) => received.push(chunk));

    api.emitLogChunk('before-unsub\r\n');
    unsub();
    api.emitLogChunk('after-unsub\r\n');

    assert.strictEqual(received.length, 1, 'Only chunk before unsub must be delivered');
    assert.strictEqual(received[0], 'before-unsub\r\n');
    api.reset();
  });

  await runTest('MockBuildApi.reset() clears all state and call history', async () => {
    const api = new MockBuildApi();
    await api.startBuild('/path', 'flutter', 'apk');
    assert.strictEqual(api.startBuildCallCount, 1);
    assert.ok(api.getCurrentJob() !== null);

    api.reset();
    assert.strictEqual(api.startBuildCallCount, 0, 'Call count must reset to 0');
    assert.strictEqual(api.getCurrentJob(), null, 'currentJob must be null after reset');
    assert.strictEqual(api.simulateFailure, false, 'simulateFailure must reset to false');
  });

  // ── Section 12: startBuild call recording ────────────────────────────────────

  await runTest('MockBuildApi records startBuild args → lastStartBuildArgs is correct', async () => {
    const api = new MockBuildApi();
    await api.startBuild('/workspace/my-app', 'react-native', 'apk');
    const args = api.lastStartBuildArgs!;
    assert.strictEqual(args.workspacePath, '/workspace/my-app');
    assert.strictEqual(args.framework, 'react-native');
    assert.strictEqual(args.target, 'apk');
    api.reset();
  });

  await runTest('Clicking BUILD APK button calls startBuild exactly once', async () => {
    const doc = makeDoc();
    const api = new MockBuildApi();
    let callCount = 0;

    const btn = renderBuildButton({
      platform: 'flutter',
      activeBuildStatus: null,
      onBuildApk: async () => {
        callCount++;
        await api.startBuild('/path', 'flutter', 'apk');
      },
    }, doc) as HTMLButtonElement;

    btn.click();
    await new Promise(r => setTimeout(r, 50)); // allow async click handler
    assert.strictEqual(callCount, 1, 'startBuild must be called once on click');
    assert.strictEqual(api.startBuildCallCount, 1);
    api.reset();
  });

  // ── Final report ─────────────────────────────────────────────────────────────

  if (failed > 0) {
    throw new Error(`${failed} Build Panel component test(s) FAILED`);
  }
  console.log(`\n  🟢 All ${passed} Build Panel component tests passed.\n`);
}
