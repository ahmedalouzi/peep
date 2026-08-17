import type {
  AIRequest,
  AIResponse,
  AIStreamEvent,
  CostEstimate,
  AIError
} from '@peep/shared';
import { randomUUID } from 'node:crypto';

import { type ProviderAdapter } from './types';
export { type ProviderAdapter };


export class MockOpenAIAdapter implements ProviderAdapter {
  readonly id = 'openai';

  async generate(request: AIRequest, options?: { signal?: AbortSignal }): Promise<AIResponse> {
    if (options?.signal?.aborted) {
      throw new Error('Provider request aborted');
    }
    return {
      content: `[OpenAI Backend] Response for prompt: ${JSON.stringify(request.messages)}`,
      usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
      cost: { cost: 0.0001, currency: 'USD' }
    };
  }

  async *stream(_request: AIRequest, options?: { signal?: AbortSignal }): AsyncIterable<AIStreamEvent> {
    if (options?.signal?.aborted) {
      throw new Error('Provider request aborted');
    }
    const chunks = ['[OpenAI ', 'Backend] ', 'streaming ', 'response.'];
    for (const chunk of chunks) {
      if (options?.signal?.aborted) {
        throw new Error('Provider request aborted');
      }
      yield { type: 'delta', content: chunk };
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    yield {
      type: 'done',
      usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
      cost: { cost: 0.0001, currency: 'USD' }
    };
  }
}

export class OpenAIAdapter implements ProviderAdapter {
  readonly id = 'openai';
  constructor(private apiKey: string) {}

  async generate(request: AIRequest, options?: { signal?: AbortSignal; resolvedModelId?: string }): Promise<AIResponse> {
    const modelId = options?.resolvedModelId || 'gpt-4o-mini';
    const payload = {
      model: modelId,
      messages: request.messages.map(m => ({ role: m.role, content: m.content })),
      tools: request.tools,
      temperature: 0.2
    };
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(payload),
      signal: options?.signal
    });
    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errBody}`);
    }
    const data = await response.json();
    const message = data?.choices?.[0]?.message;
    const result: AIResponse = { content: message?.content || '' };
    if (message?.tool_calls) {
      result.toolCalls = message.tool_calls.map((tc: any) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments
      }));
    }
    return result;
  }

  async *stream(request: AIRequest, options?: { signal?: AbortSignal; resolvedModelId?: string }): AsyncIterable<AIStreamEvent> {
    const modelId = options?.resolvedModelId || 'gpt-4o-mini';
    const payload = {
      model: modelId,
      messages: request.messages.map(m => ({ role: m.role, content: m.content })),
      tools: request.tools,
      stream: true,
      temperature: 0.2
    };
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(payload),
      signal: options?.signal
    });
    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errBody}`);
    }
    if (!response.body) throw new Error('Empty response body');
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const cleaned = line.trim();
        if (!cleaned || cleaned === 'data: [DONE]') continue;
        if (cleaned.startsWith('data: ')) {
          try {
            const data = JSON.parse(cleaned.slice(6));
            const delta = data?.choices?.[0]?.delta;
            if (delta?.content) {
              yield { type: 'delta', content: delta.content };
            }
          } catch {}
        }
      }
    }
    yield { type: 'done' };
  }
}

export class AnthropicAdapter implements ProviderAdapter {
  readonly id = 'anthropic';
  constructor(private apiKey: string) {}

  private mapMessages(messages: any[]): { system?: string; messages: any[] } {
    let system: string | undefined = undefined;
    const mapped: any[] = [];
    for (const m of messages) {
      if (m.role === 'system') {
        system = m.content;
      } else {
        mapped.push({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        });
      }
    }
    return { system, messages: mapped };
  }

  async generate(request: AIRequest, options?: { signal?: AbortSignal; resolvedModelId?: string }): Promise<AIResponse> {
    const modelId = options?.resolvedModelId || 'claude-3-5-sonnet-20241022';
    const { system, messages } = this.mapMessages(request.messages);
    const payload = {
      model: modelId,
      messages,
      system,
      max_tokens: 4096,
      temperature: 0.2
    };
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(payload),
      signal: options?.signal
    });
    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${errBody}`);
    }
    const data = await response.json();
    const contentText = data?.content?.[0]?.text || '';
    return { content: contentText };
  }

  async *stream(request: AIRequest, options?: { signal?: AbortSignal; resolvedModelId?: string }): AsyncIterable<AIStreamEvent> {
    const modelId = options?.resolvedModelId || 'claude-3-5-sonnet-20241022';
    const { system, messages } = this.mapMessages(request.messages);
    const payload = {
      model: modelId,
      messages,
      system,
      max_tokens: 4096,
      stream: true,
      temperature: 0.2
    };
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(payload),
      signal: options?.signal
    });
    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${errBody}`);
    }
    if (!response.body) throw new Error('Empty response body');
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const cleaned = line.trim();
        if (!cleaned) continue;
        if (cleaned.startsWith('data: ')) {
          try {
            const data = JSON.parse(cleaned.slice(6));
            if (data.type === 'content_block_delta' && data.delta?.text) {
              yield { type: 'delta', content: data.delta.text };
            }
          } catch {}
        }
      }
    }
    yield { type: 'done' };
  }
}

import { AuthenticationRouter } from './auth-router';
import { ServerModelRouter } from './server-router';
import { ServerUsageStore } from './usage-store';
import { ServerBudgetGuard } from './budget-guard';
import { GoogleGeminiAdapter } from './google-adapter';

export class BackendAIGateway {
  private adapters = new Map<string, ProviderAdapter>();
  readonly authService = new AuthenticationRouter();
  private router = new ServerModelRouter();
  readonly usageStore = new ServerUsageStore();
  readonly budgetGuard = new ServerBudgetGuard();
  constructor() {
    const googleKey = process.env.GOOGLE_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    this.adapters.set('google', new GoogleGeminiAdapter(googleKey));

    if (openaiKey) {
      this.adapters.set('openai', new OpenAIAdapter(openaiKey));
    } else if (googleKey) {
      this.adapters.set('openai', new GoogleGeminiAdapter(googleKey));
    } else {
      this.adapters.set('openai', new MockOpenAIAdapter());
    }

    if (anthropicKey) {
      this.adapters.set('anthropic', new AnthropicAdapter(anthropicKey));
    } else if (googleKey) {
      this.adapters.set('anthropic', new GoogleGeminiAdapter(googleKey));
    } else {
      this.adapters.set('anthropic', new MockOpenAIAdapter());
    }
  }

  async handleRequest(
    _method: 'POST',
    path: string,
    headers: Record<string, string>,
    body: any,
    options?: { signal?: AbortSignal }
  ): Promise<{ status: number; headers: Record<string, string>; body: any }> {
    const requestId = headers['x-request-id'] || randomUUID();
    const serverStart = Date.now();
    const clientStartHeader = headers['x-synkro-client-start'] || headers['X-Synkro-Client-Start'];
    const transitTime = clientStartHeader ? (serverStart - parseInt(clientStartHeader, 10)) : -1;
    console.log(`[REQ ${requestId}] BackendAIGateway.handleRequest entered`);
    const responseHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-request-id': requestId
    };

    // Kill switch check
    const isDevBypass = process.env.NODE_ENV !== 'production' && process.env.SYNKRO_DEV_AUTH_BYPASS === 'true';
    if (!isDevBypass) {
      const { db } = require('./db');
      try {
        const ksRes = await db.query("SELECT value FROM system_config WHERE key = 'global_kill_switch'");
        if (ksRes.rows.length > 0 && ksRes.rows[0].value.is_active) {
          return { status: 503, headers: responseHeaders, body: { code: 'SERVICE_UNAVAILABLE', message: 'System is currently disabled by global kill switch.' } };
        }
      } catch (e) {
        console.error('[KillSwitch] Error checking kill switch:', e);
      }
    }

    // --- Unauthenticated Auth Routes ---
    if (path === '/v1/auth/signup') {
      try {
        const session = await this.authService.signup(body.email, body.password);
        return { status: 200, headers: responseHeaders, body: session };
      } catch (err: any) {
        return { status: 400, headers: responseHeaders, body: { code: 'AUTH_ERROR', message: err.message } };
      }
    }

    if (path === '/v1/auth/signin') {
      try {
        const session = await this.authService.login(body.email, body.password);
        return { status: 200, headers: responseHeaders, body: session };
      } catch (err: any) {
        return { status: 401, headers: responseHeaders, body: { code: 'AUTH_ERROR', message: err.message } };
      }
    }

    if (path === '/v1/auth/refresh') {
      try {
        const session = await this.authService.refresh(body.refreshToken);
        return { status: 200, headers: responseHeaders, body: session };
      } catch (err: any) {
        return { status: 401, headers: responseHeaders, body: { code: 'AUTH_ERROR', message: err.message } };
      }
    }

    // 1. Auth Boundary
    const authHeader = headers['authorization'] || headers['Authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        status: 401,
        headers: responseHeaders,
        body: { code: 'UNAUTHORIZED', message: 'Missing or malformed Authorization header.' }
      };
    }
    const token = authHeader.substring(7);
    const authStart = Date.now();
    let session: any;
    try {
      session = await this.authService.validateSession(token, requestId);
    } catch (err: any) {
      console.error('[BackendAIGateway] validateSession error:', err);
      return {
        status: 401,
        headers: responseHeaders,
        body: { code: 'UNAUTHORIZED', message: err.message || 'Invalid authentication session token.' }
      };
    }
    const authDuration = Date.now() - authStart;

    // --- Authenticated Account Routes ---
    if (path === '/v1/auth/logout') {
      try {
        await this.authService.logout(token, body?.refreshToken);
        return { status: 200, headers: responseHeaders, body: { success: true } };
      } catch (err: any) {
        return { status: 500, headers: responseHeaders, body: { code: 'AUTH_ERROR', message: err.message } };
      }
    }

    if (path === '/v1/account/status') {
      const usage = await this.usageStore.getAccumulatedCost(session.userId);
      return {
        status: 200,
        headers: responseHeaders,
        body: {
          email: session.email,
          tier: 'pro',
          usage,
          limit: 20.00
        }
      };
    }

    // 2. Path routing
    if (path === '/v1/ai/generate') {
      const requestData = body as AIRequest;
      const valErr = this.validateAIRequest(requestData);
      if (valErr) {
        return { status: 400, headers: responseHeaders, body: valErr };
      }

      const estimatedCost = requestData.tier === 'premium' ? 0.01 : (requestData.tier === 'reasoning' ? 0.005 : 0.001);
      
      const isDevBypass = process.env.NODE_ENV !== 'production' && process.env.SYNKRO_DEV_AUTH_BYPASS === 'true';

      if (!isDevBypass) {
        await this.budgetGuard.acquireLock(session.userId);
        try {
          // Enforce server-side budget limits before calling provider adapter
          await this.budgetGuard.checkBudget(session.userId, 'pro', estimatedCost);
        } catch (err: any) {
          this.budgetGuard.releaseLock(session.userId);
          return { status: 403, headers: responseHeaders, body: err };
        }
      }

      let config: any;
      try {
        const routingStart = Date.now();
        config = this.router.route(requestData.tier);
        const routingDuration = Date.now() - routingStart;

        let adapter = this.adapters.get(config.providerId) || this.adapters.get('openai')!;
        this.logRequest(requestId, 'generate', requestData);
        let result: AIResponse;
        
        const latencyOut: any = { listModelsDuration: 0, geminiCallDuration: 0 };
        const adapterStart = Date.now();
        try {
          result = await adapter.generate(requestData, { ...options, resolvedModelId: config.modelId, latencyOut });
        } catch (e: any) {
          if (this.isRetryable(e) && config.fallback) {
            console.log(`[BackendAIGateway] [${requestId}] Primary provider failed, failing over to fallback: ${config.fallback.providerId}`);
            adapter = this.adapters.get(config.fallback.providerId) || this.adapters.get('openai')!;
            result = await adapter.generate(requestData, { ...options, resolvedModelId: config.fallback.modelId, latencyOut });
            responseHeaders['x-provider-fallback'] = config.fallback.providerId;
          } else {
            throw e;
          }
        }
        const adapterDuration = Date.now() - adapterStart;
        const serverDuration = Date.now() - serverStart;

        // Build the Latency Header
        responseHeaders['x-synkro-latency'] = `Transit: ${transitTime}ms | Auth: ${authDuration}ms | Route: ${routingDuration}ms | Resolve: ${latencyOut.listModelsDuration}ms | GeminiAPI: ${latencyOut.geminiCallDuration}ms | AdapterTotal: ${adapterDuration}ms | BackendTotal: ${serverDuration}ms`;

        if (!isDevBypass) {
          await this.usageStore.recordUsage({
            userId: session.userId,
            requestId,
            modelTier: requestData.tier,
            resolvedModel: config.modelId,
            inputTokens: result.usage?.inputTokens || 0,
            outputTokens: result.usage?.outputTokens || 0,
            totalTokens: result.usage?.totalTokens || 0,
            estimatedCost: result.cost?.cost || 0,
            status: 'success'
          });
        }

        return { status: 200, headers: responseHeaders, body: result };
      } catch (e: any) {
        if (!isDevBypass) {
          this.usageStore.recordUsage({
            userId: session.userId,
            requestId,
            modelTier: requestData.tier,
            resolvedModel: config?.modelId || 'unknown',
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            estimatedCost: 0,
            status: options?.signal?.aborted ? 'cancelled' : 'failed'
          });
        }
        return { status: 502, headers: responseHeaders, body: this.mapError(e) };
      } finally {
        if (!isDevBypass) this.budgetGuard.releaseLock(session.userId);
      }
    }

    if (path === '/v1/ai/stream') {
      const requestData = body as AIRequest;
      const valErr = this.validateAIRequest(requestData);
      if (valErr) {
        return { status: 400, headers: responseHeaders, body: valErr };
      }

      const estimatedCost = requestData.tier === 'premium' ? 0.01 : (requestData.tier === 'reasoning' ? 0.005 : 0.001);
      
      const isDevBypass = process.env.NODE_ENV !== 'production' && process.env.SYNKRO_DEV_AUTH_BYPASS === 'true';

      if (!isDevBypass) {
        await this.budgetGuard.acquireLock(session.userId);
        try {
          await this.budgetGuard.checkBudget(session.userId, 'pro', estimatedCost);
        } catch (err: any) {
          this.budgetGuard.releaseLock(session.userId);
          return { status: 403, headers: responseHeaders, body: err };
        }
      }

      let config: any;
      try {
        const routingStart = Date.now();
        config = this.router.route(requestData.tier);
        const routingDuration = Date.now() - routingStart;

        let adapter = this.adapters.get(config.providerId) || this.adapters.get('openai')!;
        this.logRequest(requestId, 'stream', requestData);
        let stream: any;

        const latencyOut: any = { listModelsDuration: 0, geminiCallDuration: 0 };
        const adapterStart = Date.now();
        try {
          stream = adapter.stream(requestData, { ...options, resolvedModelId: config.modelId, latencyOut });
        } catch (e: any) {
          if (this.isRetryable(e) && config.fallback) {
            console.log(`[BackendAIGateway] [${requestId}] Primary streaming failed, failing over to: ${config.fallback.providerId}`);
            adapter = this.adapters.get(config.fallback.providerId) || this.adapters.get('openai')!;
            stream = adapter.stream(requestData, { ...options, resolvedModelId: config.fallback.modelId, latencyOut });
            responseHeaders['x-provider-fallback'] = config.fallback.providerId;
            // Materialize fallback stream start
            const testFallback = await stream[Symbol.asyncIterator]().next();
            const originalIterator = stream[Symbol.asyncIterator];
            stream[Symbol.asyncIterator] = async function* () {
              if (!testFallback.done) yield testFallback.value;
              yield* originalIterator.call(stream);
            };
          } else {
            throw e;
          }
        }
        const adapterDuration = Date.now() - adapterStart;
        const serverDuration = Date.now() - serverStart;

        // Build the Latency Header
        responseHeaders['x-synkro-latency'] = `Transit: ${transitTime}ms | Auth: ${authDuration}ms | Route: ${routingDuration}ms | Resolve: ${latencyOut.listModelsDuration}ms | GeminiAPI: ${latencyOut.geminiCallDuration}ms | AdapterTotal: ${adapterDuration}ms | BackendTotal: ${serverDuration}ms`;

        // Record a success placeholder for streaming usage
        if (!isDevBypass) {
          await this.usageStore.recordUsage({
            userId: session.userId,
            requestId,
            modelTier: requestData.tier,
            resolvedModel: config.modelId,
            inputTokens: 10,
            outputTokens: 20,
            totalTokens: 30,
            estimatedCost: 0.001,
            status: 'success'
          });
        }

        return { status: 200, headers: responseHeaders, body: stream };
      } catch (e: any) {
        console.error(`[BackendAIGateway] [${requestId}] Request failed with error:`, e);
        if (!isDevBypass) {
          this.usageStore.recordUsage({
            userId: session.userId,
            requestId,
            modelTier: requestData.tier,
            resolvedModel: config?.modelId || 'unknown',
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            estimatedCost: 0,
            status: options?.signal?.aborted ? 'cancelled' : 'failed'
          });
        }
        return { status: 502, headers: responseHeaders, body: this.mapError(e) };
      } finally {
        if (!isDevBypass) this.budgetGuard.releaseLock(session.userId);
      }
    }

    if (path === '/v1/ai/estimate-cost') {
      const requestData = body as AIRequest;
      try {
        this.router.route(requestData.tier);
        const estimate: CostEstimate = {
          cost: requestData.tier === 'premium' ? 0.01 : (requestData.tier === 'reasoning' ? 0.005 : 0.001),
          currency: 'USD'
        };
        return { status: 200, headers: responseHeaders, body: estimate };
      } catch (e: any) {
        return { status: 400, headers: responseHeaders, body: { code: 'VALIDATION_ERROR', message: e.message } };
      }
    }

    return {
      status: 404,
      headers: responseHeaders,
      body: { code: 'NOT_FOUND', message: `Route not found: ${path}` }
    };
  }

  private validateAIRequest(req: AIRequest): AIError | null {
    if (!req) {
      return { code: 'VALIDATION_ERROR', message: 'Request body is empty.' };
    }
    if (!['fast', 'reasoning', 'premium'].includes(req.tier)) {
      return { code: 'VALIDATION_ERROR', message: `Invalid model tier: ${req.tier}` };
    }
    if ((!req.messages || req.messages.length === 0) && !(req as any).prompt) {
      return { code: 'VALIDATION_ERROR', message: 'Request messages is required.' };
    }
    return null;
  }

  private mapError(e: any): AIError {
    if (e.message === 'Provider request aborted') {
      return { code: 'REQUEST_CANCELLED', message: 'Request cancelled by the user.' };
    }
    return {
      code: 'PROVIDER_ERROR',
      message: `Provider request failed: ${e.message}`
    };
  }

  private logRequest(requestId: string, type: string, req: AIRequest): void {
    // Redact sensitive details in logs
    const msgStr = JSON.stringify(req.messages || (req as any).prompt || '');
    const redactedPrompt = msgStr ? (msgStr.length > 50 ? `${msgStr.substring(0, 50)}...` : msgStr) : '';
    console.log(`[BackendAIGateway] [${requestId}] type=${type} tier=${req.tier} prompt=${redactedPrompt}`);
  }

  private isRetryable(e: any): boolean {
    if (!e) return false;
    const msg = String(e.message || '').toLowerCase();
    const isRetryableStatus = [429, 500, 502, 503, 504].includes(e.status);
    const isRetryableMsg = msg.includes('rate limit') || msg.includes('timeout') || msg.includes('overload') || msg.includes('temporary');
    return isRetryableStatus || isRetryableMsg;
  }
}
