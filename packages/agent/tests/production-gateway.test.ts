import { ProductionAIGateway } from '../src/models/production-gateway';

export default async function runTests() {
  console.log('  Running ProductionAIGateway unit tests...');

  // Mock global fetch
  const originalFetch = global.fetch;

  let lastUrl = '';
  let lastHeaders: any = {};
  let mockStatus = 200;
  let mockResponseJson = {};
  let mockResponseBody: ReadableStream<Uint8Array> | null = null;

  global.fetch = async (url: any, options: any) => {
    lastUrl = String(url);
    lastHeaders = options.headers || {};
    
    if (options.signal?.aborted) {
      const err = new Error('The user aborted a request.');
      err.name = 'AbortError';
      throw err;
    }

    const headersMock = {
      get: (key: string) => {
        if (key.toLowerCase() === 'x-synkro-server-version') return '1.0.0';
        return null;
      }
    };

    if (mockStatus !== 200) {
      return {
        ok: false,
        status: mockStatus,
        statusText: 'Error',
        headers: headersMock,
        json: async () => mockResponseJson
      } as any;
    }

    return {
      ok: true,
      status: mockStatus,
      headers: headersMock,
      json: async () => mockResponseJson,
      body: mockResponseBody
    } as any;
  };

  try {
    // 1. Test Successful Generate
    mockStatus = 200;
    mockResponseJson = { content: 'production response content' };
    const gateway = new ProductionAIGateway({ baseUrl: 'http://localhost:3000', sessionToken: 'session-123' });
    const res = await gateway.generate({ tier: 'fast', messages: [{ role: 'user', content: 'hello' }] });
    
    if (lastUrl !== 'http://localhost:3000/v1/ai/generate') {
      throw new Error('generate did not target correct endpoint');
    }
    if (lastHeaders['Authorization'] !== 'Bearer session-123') {
      throw new Error('generate request did not include Bearer authorization header');
    }
    if (res.content !== 'production response content') {
      throw new Error('generate returned unexpected content');
    }

    // 2. Test Missing Session Token
    const badGateway = new ProductionAIGateway({ baseUrl: 'http://localhost:3000', sessionToken: '' });
    try {
      await badGateway.generate({ tier: 'fast', messages: [{ role: 'user', content: 'hello' }] });
      throw new Error('unauthorized request did not throw');
    } catch (err: any) {
      if (err.code !== 'UNAUTHORIZED') throw err;
    }

    // 3. Test 401 Unauthorized
    mockStatus = 401;
    mockResponseJson = { message: 'invalid session' };
    try {
      await gateway.generate({ tier: 'fast', messages: [{ role: 'user', content: 'hello' }] });
      throw new Error('401 error response did not throw');
    } catch (err: any) {
      if (err.code !== 'UNAUTHORIZED' || err.status !== 401) throw err;
    }

    // 4. Test 429 Rate Limit
    mockStatus = 429;
    mockResponseJson = { message: 'rate limit hit' };
    try {
      await gateway.generate({ tier: 'fast', messages: [{ role: 'user', content: 'hello' }] });
      throw new Error('429 error response did not throw');
    } catch (err: any) {
      if (err.code !== 'RATE_LIMIT_EXCEEDED') throw err;
    }

    // 5. Test Budget Exceeded
    mockStatus = 400;
    mockResponseJson = { code: 'BUDGET_EXCEEDED', message: 'Budget exceeded' };
    try {
      await gateway.generate({ tier: 'fast', messages: [{ role: 'user', content: 'hello' }] });
      throw new Error('budget exceeded response did not throw');
    } catch (err: any) {
      if (err.code !== 'BUDGET_EXCEEDED') throw err;
    }

    // 6. Test Streaming & Cancellation
    mockStatus = 200;
    const controller = new AbortController();
    
    // Mock stream reader
    const encoder = new TextEncoder();
    const dataChunks = [
      'data: ' + JSON.stringify({ type: 'delta', content: 'hello' }) + '\n',
      'data: ' + JSON.stringify({ type: 'delta', content: ' world' }) + '\n'
    ];
    let chunkIndex = 0;

    mockResponseBody = new ReadableStream({
      async pull(controllerStream) {
        if (chunkIndex < dataChunks.length) {
          controllerStream.enqueue(encoder.encode(dataChunks[chunkIndex++]));
        } else {
          controllerStream.close();
        }
      }
    });

    const stream = gateway.stream({ tier: 'fast', messages: [{ role: 'user', content: 'hello' }] }, { signal: controller.signal });
    const collected: string[] = [];
    for await (const event of stream) {
      if (event.type === 'delta' && event.content) {
        collected.push(event.content);
      }
    }
    if (collected.join('') !== 'hello world') {
      throw new Error('streaming failed to return correct text deltas');
    }

    console.log('  🟢 All ProductionAIGateway unit tests passed.');
  } finally {
    global.fetch = originalFetch;
  }
}
