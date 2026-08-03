import { ServerUsageStore } from '../src/models/usage-store';
import { BackendAIGateway } from '../src/models/backend-gateway';

export default async function runTests() {
  console.log('  Running ServerUsageStore & Accounting unit tests...');

  const store = new ServerUsageStore();

  // Test 1: Record Usage
  store.recordUsage({
    userId: 'user-123',
    requestId: 'req-abc',
    modelTier: 'fast',
    resolvedModel: 'gemini-3.6-flash',
    inputTokens: 100,
    outputTokens: 200,
    totalTokens: 300,
    estimatedCost: 0.0005,
    status: 'success'
  });

  const records = store.getRecordsForUser('user-123');
  if (records.length !== 1 || records[0].totalTokens !== 300) {
    throw new Error('recordUsage failed to store correct token count');
  }

  // Test 2: Double Counting Prevention
  store.recordUsage({
    userId: 'user-123',
    requestId: 'req-abc', // Same Request ID
    modelTier: 'fast',
    resolvedModel: 'gemini-3.6-flash',
    inputTokens: 100,
    outputTokens: 200,
    totalTokens: 300,
    estimatedCost: 0.0005,
    status: 'success'
  });

  const doubleCheckRecords = store.getRecordsForUser('user-123');
  if (doubleCheckRecords.length !== 1) {
    throw new Error('ServerUsageStore failed to prevent double counting on same Request ID');
  }

  // Test 3: Gateway integration usage logging
  const gateway = new BackendAIGateway();
  
  // Inject MockOpenAIAdapter for google to test usage isolation without real keys
  const { MockOpenAIAdapter } = await import('../src/models/backend-gateway');
  (gateway as any).adapters.set('google', new MockOpenAIAdapter());
  
  const session = await gateway.authService.login('user@example.com', 'hash-password-123');

  const headers = {
    'authorization': `Bearer ${session.sessionToken}`,
    'x-request-id': 'gateway-usage-req'
  };

  await gateway.handleRequest('POST', '/v1/ai/generate', headers, {
    tier: 'fast',
    prompt: 'please log this usage'
  });

  const gatewayRecords = gateway.usageStore.getRecordsForUser(session.userId);
  if (gatewayRecords.length !== 1 || gatewayRecords[0].requestId !== 'gateway-usage-req') {
    throw new Error('Gateway failed to log usage to usageStore');
  }

  // Test 4: Cost Accumulation
  const totalCost = gateway.usageStore.getAccumulatedCost(session.userId);
  if (totalCost <= 0) {
    throw new Error('Cost calculation returned incorrect accumulated value');
  }

  console.log('  🟢 All ServerUsageStore & Accounting unit tests passed.');
}
