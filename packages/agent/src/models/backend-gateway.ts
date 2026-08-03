import type {
  AIRequest,
  AIResponse,
  AIStreamEvent,
  CostEstimate,
  AIError
} from '@peep/shared';
import { randomUUID } from 'node:crypto';

export interface ProviderAdapter {
  id: string;
  generate(request: AIRequest, options?: { signal?: AbortSignal; resolvedModelId?: string }): Promise<AIResponse>;
  stream(request: AIRequest, options?: { signal?: AbortSignal; resolvedModelId?: string }): AsyncIterable<AIStreamEvent>;
}

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

import { AuthService } from './auth';
import { ServerModelRouter } from './server-router';
import { ServerUsageStore } from './usage-store';
import { ServerBudgetGuard } from './budget-guard';
import { GoogleGeminiAdapter } from './google-adapter';

export class BackendAIGateway {
  private adapters = new Map<string, ProviderAdapter>();
  readonly authService = new AuthService();
  private router = new ServerModelRouter();
  readonly usageStore = new ServerUsageStore();
  readonly budgetGuard = new ServerBudgetGuard();
  constructor() {
    this.adapters.set('openai', new MockOpenAIAdapter());
    this.adapters.set('google', new GoogleGeminiAdapter(process.env.GOOGLE_API_KEY));
    this.adapters.set('anthropic', new MockOpenAIAdapter());
  }

  async handleRequest(
    _method: 'POST',
    path: string,
    headers: Record<string, string>,
    body: any,
    options?: { signal?: AbortSignal }
  ): Promise<{ status: number; headers: Record<string, string>; body: any }> {
    const requestId = headers['x-request-id'] || randomUUID();
    const responseHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-request-id': requestId
    };

    // Kill switch check
    const { db } = require('./db');
    try {
      const ksRes = await db.query("SELECT value FROM system_config WHERE key = 'global_kill_switch'");
      if (ksRes.rows.length > 0 && ksRes.rows[0].value.is_active) {
        return { status: 503, headers: responseHeaders, body: { code: 'SERVICE_UNAVAILABLE', message: 'System is currently disabled by global kill switch.' } };
      }
    } catch (e) {
      console.error('[KillSwitch] Error checking kill switch:', e);
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
    let session: any;
    try {
      session = await this.authService.validateSession(token);
    } catch (err: any) {
      return {
        status: 401,
        headers: responseHeaders,
        body: { code: 'UNAUTHORIZED', message: err.message || 'Invalid authentication session token.' }
      };
    }

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
      
      await this.budgetGuard.acquireLock(session.userId);
      try {
        // Enforce server-side budget limits before calling provider adapter
        await this.budgetGuard.checkBudget(session.userId, 'pro', estimatedCost);
      } catch (err: any) {
        this.budgetGuard.releaseLock(session.userId);
        return { status: 403, headers: responseHeaders, body: err };
      }

      let config: any;
      try {
        config = this.router.route(requestData.tier);
        let adapter = this.adapters.get(config.providerId) || this.adapters.get('openai')!;
        this.logRequest(requestId, 'generate', requestData);
        let result: AIResponse;
        
        try {
          result = await adapter.generate(requestData, { ...options, resolvedModelId: config.modelId });
        } catch (e: any) {
          if (this.isRetryable(e) && config.fallback) {
            console.log(`[BackendAIGateway] [${requestId}] Primary provider failed, failing over to fallback: ${config.fallback.providerId}`);
            adapter = this.adapters.get(config.fallback.providerId) || this.adapters.get('openai')!;
            result = await adapter.generate(requestData, { ...options, resolvedModelId: config.fallback.modelId });
            responseHeaders['x-provider-fallback'] = config.fallback.providerId;
          } else {
            throw e;
          }
        }

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

        return { status: 200, headers: responseHeaders, body: result };
      } catch (e: any) {
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
        return { status: 502, headers: responseHeaders, body: this.mapError(e) };
      } finally {
        this.budgetGuard.releaseLock(session.userId);
      }
    }

    if (path === '/v1/ai/stream') {
      const requestData = body as AIRequest;
      const valErr = this.validateAIRequest(requestData);
      if (valErr) {
        return { status: 400, headers: responseHeaders, body: valErr };
      }

      const estimatedCost = requestData.tier === 'premium' ? 0.01 : (requestData.tier === 'reasoning' ? 0.005 : 0.001);
      
      await this.budgetGuard.acquireLock(session.userId);
      try {
        await this.budgetGuard.checkBudget(session.userId, 'pro', estimatedCost);
      } catch (err: any) {
        this.budgetGuard.releaseLock(session.userId);
        return { status: 403, headers: responseHeaders, body: err };
      }

      let config: any;
      try {
        config = this.router.route(requestData.tier);
        let adapter = this.adapters.get(config.providerId) || this.adapters.get('openai')!;
        this.logRequest(requestId, 'stream', requestData);
        let stream: any;

        try {
          stream = adapter.stream(requestData, { ...options, resolvedModelId: config.modelId });
          // Force materialization if we need to check stream startup error for failover
          // For simplicity, mock adapter stream calls are synchronous generators.
        } catch (e: any) {
          if (this.isRetryable(e) && config.fallback) {
            console.log(`[BackendAIGateway] [${requestId}] Primary streaming failed, failing over to: ${config.fallback.providerId}`);
            adapter = this.adapters.get(config.fallback.providerId) || this.adapters.get('openai')!;
            stream = adapter.stream(requestData, { ...options, resolvedModelId: config.fallback.modelId });
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

        // Record a success placeholder for streaming usage
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

        return { status: 200, headers: responseHeaders, body: stream };
      } catch (e: any) {
        await this.usageStore.recordUsage({
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
        return { status: 502, headers: responseHeaders, body: this.mapError(e) };
      } finally {
        this.budgetGuard.releaseLock(session.userId);
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
