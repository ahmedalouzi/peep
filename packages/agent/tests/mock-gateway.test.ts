import { MockAIGateway } from '../src/models/mock-gateway';

export default async function runTests() {
  console.log('  Running MockAIGateway unit tests...');

  const gateway = new MockAIGateway();

  // Test 1: Successful Generation
  gateway.setScenario('success');
  const res = await gateway.generate({ tier: 'fast', prompt: 'test' });
  if (!res.content.includes('understand your message') && !res.content.includes('Response for request')) {
    throw new Error('generate failed to return correct content: ' + res.content);
  }

  // Test 2: Cost Estimation
  const cost = await gateway.estimateCost({ tier: 'premium', prompt: 'test' });
  if (cost.cost !== 0.01) {
    throw new Error('estimateCost failed to return premium cost');
  }

  // Test 3: Streaming
  gateway.setScenario('streaming');
  const stream = gateway.stream({ tier: 'fast', prompt: 'test' });
  const chunks: string[] = [];
  for await (const event of stream) {
    if (event.type === 'delta' && event.content) {
      chunks.push(event.content);
    }
  }
  if (chunks.join('') !== 'Hello from mock gateway.') {
    throw new Error('stream failed to return correct text chunks');
  }

  // Test 4: Tool Call
  gateway.setScenario('tool_call');
  const toolRes = await gateway.generate({ tier: 'fast', prompt: 'test' });
  if (!toolRes.toolCalls || toolRes.toolCalls[0].name !== 'run_command') {
    throw new Error('tool_call scenario failed to return toolCalls');
  }

  // Test 5: Simulated Errors
  gateway.setScenario('auth_error');
  try {
    await gateway.generate({ tier: 'fast', prompt: 'test' });
    throw new Error('auth_error did not throw');
  } catch (err: any) {
    if (err.code !== 'UNAUTHORIZED') throw err;
  }

  gateway.setScenario('budget_exceeded');
  try {
    await gateway.generate({ tier: 'fast', prompt: 'test' });
    throw new Error('budget_exceeded did not throw');
  } catch (err: any) {
    if (err.code !== 'BUDGET_EXCEEDED') throw err;
  }

  // Test 6: Cancellation
  gateway.setScenario('streaming');
  const controller = new AbortController();
  const cancelStream = gateway.stream({ tier: 'fast', prompt: 'test' }, { signal: controller.signal });
  
  controller.abort();
  try {
    for await (const _ of cancelStream) {
      // Loop
    }
    throw new Error('cancellation did not throw on aborted signal');
  } catch (err: any) {
    if (err.message !== 'Request aborted') throw err;
  }

  console.log('  🟢 All MockAIGateway unit tests passed.');
}
