import { BackendAIGateway, ProviderAdapter } from '../src/models/backend-gateway';
import type { AIRequest, AIResponse, AIStreamEvent } from '@peep/shared';

class FlakyProviderAdapter implements ProviderAdapter {
  readonly id = 'google';
  attempts = 0;

  async generate(request: AIRequest, options?: { signal?: AbortSignal }): Promise<AIResponse> {
    this.attempts++;
    if (this.attempts === 1) {
      const err: any = new Error('Rate limit exceeded');
      err.status = 429;
      throw err;
    }
    return {
      content: 'Fallback success response',
      usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 }
    };
  }

  async *stream(request: AIRequest, options?: { signal?: AbortSignal }): AsyncIterable<AIStreamEvent> {
    this.attempts++;
    if (this.attempts === 1) {
      const err: any = new Error('Rate limit exceeded');
      err.status = 429;
      throw err;
    }
    yield { type: 'delta', content: 'Fallback streaming' };
  }
}

export default async function runTests() {
  console.log('  Running Server Failover unit tests...');

  const gateway = new BackendAIGateway();
  const flaky = new FlakyProviderAdapter();
  
  // Override adapters list
  (gateway as any).adapters.set('google', flaky); // Google as primary for fast tier
  (gateway as any).adapters.set('openai', {
    id: 'openai',
    generate: async () => ({
      content: 'openai fallback generated response',
      usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 }
    }),
    stream: async function* () {
      yield { type: 'delta', content: 'openai fallback stream' };
    }
  });

  const session = await gateway.authService.login('user@example.com', 'hash-password-123');

  const headers = {
    'authorization': `Bearer ${session.sessionToken}`,
    'x-request-id': 'failover-req-id'
  };

  // Test 1: Primary fails on 429 (rate-limit) -> Fallback (openai) succeeds
  const res = await gateway.handleRequest('POST', '/v1/ai/generate', headers, {
    tier: 'fast',
    prompt: 'trigger failover'
  });

  if (res.status !== 200 || !res.body.content.includes('openai fallback')) {
    throw new Error(`Failover failed. Status: ${res.status}, content: ${res.body.content}`);
  }

  console.log('  🟢 All Server Failover unit tests passed.');
}
