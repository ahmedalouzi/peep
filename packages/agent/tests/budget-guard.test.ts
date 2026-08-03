import { ServerUsageStore } from '../src/models/usage-store';
import { ServerBudgetGuard } from '../src/models/budget-guard';
import { BackendAIGateway } from '../src/models/backend-gateway';

export default async function runTests() {
  console.log('  Running ServerBudgetGuard unit tests...');

  const store = new ServerUsageStore();
  const guard = new ServerBudgetGuard(store);

  // Test 1: Request within budget
  await guard.acquireLock('user-1');
  try {
    guard.checkBudget('user-1', 'pro', 0.001); // Within maxRequestCost ($0.05) and daily ($0.50)
  } finally {
    guard.releaseLock('user-1');
  }

  // Test 2: Request exceeding per-request limit
  await guard.acquireLock('user-1');
  try {
    guard.checkBudget('user-1', 'pro', 0.10); // Exceeds pro maxRequestCost ($0.05)
    throw new Error('Allowed request exceeding per-request cost limit');
  } catch (err: any) {
    if (err.code !== 'BUDGET_EXCEEDED') throw err;
  } finally {
    guard.releaseLock('user-1');
  }

  // Test 3: Daily budget exceeded
  store.recordUsage({
    userId: 'user-1',
    requestId: 'req-large-1',
    modelTier: 'premium',
    resolvedModel: 'claude-3-5-sonnet',
    inputTokens: 100,
    outputTokens: 200,
    totalTokens: 300,
    estimatedCost: 0.495, // spent almost daily budget
    status: 'success'
  });

  await guard.acquireLock('user-1');
  try {
    guard.checkBudget('user-1', 'pro', 0.01); // daily spent 0.495 + 0.01 = 0.505 > daily limit of 0.50
    throw new Error('Allowed request exceeding daily budget limit');
  } catch (err: any) {
    if (err.code !== 'BUDGET_EXCEEDED') throw err;
  } finally {
    guard.releaseLock('user-1');
  }

  // Test 4: Gateway Authorization Rejection integration
  const gateway = new BackendAIGateway();
  const session = await gateway.authService.login('user@example.com', 'hash-password-123');

  const headers = {
    'authorization': `Bearer ${session.sessionToken}`,
    'x-request-id': 'budget-exceed-req'
  };

  // Force daily budget usage onto gateway store
  gateway.usageStore.recordUsage({
    userId: session.userId,
    requestId: 'gateway-spent',
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
    prompt: 'triggers budget error'
  });
  
  if (res.status !== 403 || res.body.code !== 'BUDGET_EXCEEDED') {
    throw new Error(`Gateway failed to reject request exceeding daily budget. Status: ${res.status}`);
  }

  console.log('  🟢 All ServerBudgetGuard unit tests passed.');
}
