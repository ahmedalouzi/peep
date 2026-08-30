import { ServerUsageStore } from '../src/models/usage-store';
import { ServerBudgetGuard } from '../src/models/budget-guard';
import { BackendAIGateway } from '../src/models/backend-gateway';
import { db } from '../src/models/db';

export default async function runTests() {
  console.log('  Running ServerBudgetGuard unit tests...');

  const store = new ServerUsageStore();
  const guard = new ServerBudgetGuard();
  const testUserId = '00000000-0000-0000-0000-000000000001';

  // Seed user to satisfy foreign key constraints
  await db.query(
    "INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING",
    [testUserId, 'budget-guard-user@example.com', 'scrypt:mock-hash']
  );

  // Test 1: Request within budget
  await guard.acquireLock(testUserId);
  try {
    await guard.checkBudget(testUserId, 'pro', 0.001); // Within maxRequestCost ($0.05) and daily ($0.50)
  } finally {
    guard.releaseLock(testUserId);
  }

  // Test 2: Request exceeding per-request limit
  await guard.acquireLock(testUserId);
  try {
    await guard.checkBudget(testUserId, 'pro', 0.10); // Exceeds pro maxRequestCost ($0.05)
    throw new Error('Allowed request exceeding per-request cost limit');
  } catch (err: any) {
    if (err.code !== 'BUDGET_EXCEEDED') throw err;
  } finally {
    guard.releaseLock(testUserId);
  }

  // Test 3: Daily budget exceeded
  await store.recordUsage({
    userId: testUserId,
    requestId: 'req-large-1',
    modelTier: 'premium',
    resolvedModel: 'claude-3-5-sonnet',
    inputTokens: 100,
    outputTokens: 200,
    totalTokens: 300,
    estimatedCost: 0.495, // spent almost daily budget
    status: 'success'
  });

  await guard.acquireLock(testUserId);
  try {
    await guard.checkBudget(testUserId, 'pro', 0.01); // daily spent 0.495 + 0.01 = 0.505 > daily limit of 0.50
    throw new Error('Allowed request exceeding daily budget limit');
  } catch (err: any) {
    if (err.code !== 'BUDGET_EXCEEDED') throw err;
  } finally {
    guard.releaseLock(testUserId);
  }

  // Test 4: Gateway Authorization Rejection integration
  const gateway = new BackendAIGateway();
  const { MockOpenAIAdapter } = await import('../src/models/backend-gateway');
  (gateway as any).adapters.set('google', new MockOpenAIAdapter());
  
  // Create user first
  const email = `budget_test_${Math.random().toString(36).substring(7)}@example.com`;
  await gateway.authService.signup(email, 'hash-password-123');
  const session = await gateway.authService.login(email, 'hash-password-123');

  const headers = {
    'authorization': `Bearer ${session.sessionToken}`,
    'x-request-id': 'budget-exceed-req'
  };

  // Force daily budget usage onto gateway store
  const gatewaySpentReqId = `gateway-spent-${Math.random().toString(36).substring(7)}`;
  await gateway.usageStore.recordUsage({
    userId: session.userId,
    requestId: gatewaySpentReqId,
    modelTier: 'premium',
    resolvedModel: 'claude-3-5-sonnet',
    inputTokens: 100,
    outputTokens: 200,
    totalTokens: 300,
    estimatedCost: 0.50,
    status: 'success'
  });

  const res = await gateway.handleRequest('POST', '/v1/ai/generate', headers, {
    tier: 'fast',
    messages: [{ role: 'user', content: 'triggers budget error' }]
  });
  
  if (res.status !== 403 || res.body.code !== 'BUDGET_EXCEEDED') {
    throw new Error(`Gateway failed to reject request exceeding daily budget. Status: ${res.status}`);
  }

  console.log('  🟢 All ServerBudgetGuard unit tests passed.');
}
