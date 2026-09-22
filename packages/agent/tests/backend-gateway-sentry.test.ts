import assert from 'node:assert';
import { ensureSentryLoaded, _resetSentryLoaderForTest } from '../src/models/backend-gateway';

export default async function runTest() {
  console.log('  Running backend-gateway Sentry lazy loader test...');
  _resetSentryLoaderForTest();

  // Because ensureSentryLoaded caches the Promise synchronously,
  // concurrent calls must return the exact same Promise instance.
  const p1 = ensureSentryLoaded();
  const p2 = ensureSentryLoaded();
  const p3 = ensureSentryLoaded();

  assert.ok(p1, 'p1 should be defined');
  assert.strictEqual(p1, p2, 'Concurrent calls should return the exact same Promise instance (p1 === p2)');
  assert.strictEqual(p1, p3, 'Concurrent calls should return the exact same Promise instance (p1 === p3)');


