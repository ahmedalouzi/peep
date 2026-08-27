import assert from 'node:assert';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
(globalThis as any).require = require;
import { BackendAIGateway } from '../src/models/backend-gateway';
import { db } from '../src/models/db';

export default async function runTests() {
  console.log('  Running Rate Limiter unit tests...');
  
  const gateway = new BackendAIGateway();
  
  // Mock usage store to prevent DB connection
  gateway.usageStore.recordUsage = async () => {};
  
  // Mock the auth service to bypass DB and return a deterministic user ID
  gateway.authService.validateSession = async (token: string) => {
    return { userId: token, email: `${token}@example.com` };
  };
  
  // Mock budget guard to prevent budget failures during rate limit testing
  gateway.budgetGuard.checkBudget = async () => {};
  gateway.budgetGuard.acquireLock = async () => {};
  gateway.budgetGuard.releaseLock = () => {};

  // Mock router and adapter to return dummy stream
  (gateway as any).router.route = () => ({ providerId: 'test', modelId: 'test' });
  const dummyAdapter = {
    stream: () => ({
      [Symbol.asyncIterator]: async function* () { yield { type: 'done' }; }
    }),
    generate: async () => ({ content: 'test', usage: {} })
  };
  (gateway as any).adapters.set('test', dummyAdapter);

  console.log('  [Test 1] enforces 30 requests per minute per user on AI endpoints');
  {
    const userId = 'user_1';
    for (let i = 0; i < 30; i++) {
      const res = await gateway.handleRequest('POST', '/v1/ai/stream', {
        'authorization': `Bearer ${userId}`,
        'x-request-id': `req-${i}`
      }, { tier: 'fast', messages: [{ role: 'user', content: 'test' }] });
      assert.strictEqual(res.status, 200);
    }
    const resRateLimited = await gateway.handleRequest('POST', '/v1/ai/stream', {
      'authorization': `Bearer ${userId}`,
      'x-request-id': 'req-31'
    }, { tier: 'fast', messages: [{ role: 'user', content: 'test' }] });
    assert.strictEqual(resRateLimited.status, 429);
    assert.strictEqual(resRateLimited.body.code, 'RATE_LIMIT_EXCEEDED');
  }

  console.log('  [Test 2] does not share rate limit quota between different users');
  {
    const userA = 'user_A';
    const userB = 'user_B';

    for (let i = 0; i < 30; i++) {
      await gateway.handleRequest('POST', '/v1/ai/stream', {
        'authorization': `Bearer ${userA}`,
        'x-request-id': `req-A-${i}`
      }, { tier: 'fast', messages: [{ role: 'user', content: 'test' }] });
    }

    const resA = await gateway.handleRequest('POST', '/v1/ai/stream', {
      'authorization': `Bearer ${userA}`,
      'x-request-id': `req-A-31`
    }, { tier: 'fast', messages: [{ role: 'user', content: 'test' }] });
    assert.strictEqual(resA.status, 429);

    const resB = await gateway.handleRequest('POST', '/v1/ai/stream', {
      'authorization': `Bearer ${userB}`,
      'x-request-id': `req-B-1`
    }, { tier: 'fast', messages: [{ role: 'user', content: 'test' }] });
    assert.strictEqual(resB.status, 200);
  }

  console.log('  [Test 3] resets the rate limit window after 60 seconds');
  {
    const userId = 'user_window_test';
    const originalDateNow = Date.now;
    let currentTime = 1000000;
    global.Date.now = () => currentTime;

    try {
      for (let i = 0; i < 30; i++) {
        await gateway.handleRequest('POST', '/v1/ai/stream', {
          'authorization': `Bearer ${userId}`,
          'x-request-id': `req-W-${i}`
        }, { tier: 'fast', messages: [{ role: 'user', content: 'test' }] });
      }

      currentTime += 30000;
      const resMiddle = await gateway.handleRequest('POST', '/v1/ai/stream', {
        'authorization': `Bearer ${userId}`,
        'x-request-id': 'req-W-31'
      }, { tier: 'fast', messages: [{ role: 'user', content: 'test' }] });
      assert.strictEqual(resMiddle.status, 429);

      currentTime += 61000;
      const resAfterReset = await gateway.handleRequest('POST', '/v1/ai/stream', {
        'authorization': `Bearer ${userId}`,
        'x-request-id': 'req-W-32'
      }, { tier: 'fast', messages: [{ role: 'user', content: 'test' }] });
      assert.strictEqual(resAfterReset.status, 200);
    } finally {
      global.Date.now = originalDateNow;
    }
  }

  console.log('  🟢 Passed');
}

import { fileURLToPath } from 'node:url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runTests().catch(console.error);
}
