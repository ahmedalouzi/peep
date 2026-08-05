import type {
  AIGateway,
  AIRequest,
  AIResponse,
  AIStreamEvent,
  CostEstimate,
  AIError
} from '@peep/shared';

export type MockScenario =
  | 'success'
  | 'streaming'
  | 'tool_call'
  | 'auth_error'
  | 'rate_limit'
  | 'budget_exceeded'
  | 'provider_error'
  | 'cancel';

export class MockAIGateway implements AIGateway {
  private scenario: MockScenario = 'success';

  private customToolCall?: any;

  setScenario(scenario: MockScenario): void {
    this.scenario = scenario;
  }

  setCustomToolCall(toolCall: any): void {
    this.customToolCall = toolCall;
    this.scenario = 'tool_call';
  }

  async generate(request: AIRequest, options?: { signal?: AbortSignal }): Promise<AIResponse> {
    if (options?.signal?.aborted) {
      throw new Error('Request aborted');
    }
    this.checkSimulatedErrors();

    if (this.scenario === 'tool_call') {
      return {
        content: 'I need to run a command to assist with your project.',
        toolCalls: [
          this.customToolCall || {
            id: 'call-1',
            name: 'run_command',
            arguments: { command: 'echo "hello"' }
          }
        ],
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        cost: { cost: 0.001, currency: 'USD' }
      };
    }

    const lastUserMsg = request.messages.filter((m: any) => m.role === 'user').pop();
    const promptText = (typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : '').trim();
    const lowerPrompt = promptText.toLowerCase();

    let content = 'Hello! I am your AI development assistant. How can I help you build, modify, or debug your app today?';

    if (/\b(merhaba|selam|hi|hello|hey|greetings|hola|bonjour)\b/i.test(lowerPrompt)) {
      if (/\b(merhaba|selam)\b/i.test(lowerPrompt)) {
        content = 'Merhaba! Size nasıl yardımcı olabilirim? Projenizdeki ekranları, UI tasarımlarını veya kod yapısını düzenlemeye hazırım.';
      } else {
        content = 'Hello! How can I help you with your application today? I can help modify components, design UI screens, or resolve build issues.';
      }
    } else if (promptText.length > 0) {
      content = `I understand you would like help with: "${promptText}". I am ready to analyze your project context and assist with your request.`;
    }

    return {
      content,
      usage: { inputTokens: 10, outputTokens: 15, totalTokens: 25 },
      cost: { cost: 0.0005, currency: 'USD' }
    };
  }

  async *stream(_request: AIRequest, options?: { signal?: AbortSignal }): AsyncIterable<AIStreamEvent> {
    if (options?.signal?.aborted) {
      throw new Error('Request aborted');
    }
    this.checkSimulatedErrors();

    const events: AIStreamEvent[] = [];

    if (this.scenario === 'tool_call') {
      events.push({
        type: 'tool_call',
        toolCall: this.customToolCall || {
          id: 'call-1',
          name: 'run_command',
          arguments: { command: 'echo "hello"' }
        }
      });
    } else {
      const chunks = ['Hello ', 'from ', 'mock ', 'gateway.'];
      for (const chunk of chunks) {
        events.push({ type: 'delta', content: chunk });
      }
    }

    events.push({
      type: 'done',
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      cost: { cost: 0.001, currency: 'USD' }
    });

    for (const event of events) {
      if (options?.signal?.aborted) {
        throw new Error('Request aborted');
      }
      yield event;
      // Sleep slightly to simulate network latency
      await new Promise(resolve => setTimeout(resolve, 5));
    }
  }

  async estimateCost(request: AIRequest): Promise<CostEstimate> {
    const isPremium = request.tier === 'premium';
    return {
      cost: isPremium ? 0.01 : 0.001,
      currency: 'USD'
    };
  }

  private checkSimulatedErrors(): void {
    if (this.scenario === 'auth_error') {
      const err: AIError = { code: 'UNAUTHORIZED', message: 'Authentication failed' };
      throw err;
    }
    if (this.scenario === 'rate_limit') {
      const err: AIError = { code: 'RATE_LIMIT_EXCEEDED', message: 'Rate limit hit' };
      throw err;
    }
    if (this.scenario === 'budget_exceeded') {
      const err: AIError = { code: 'BUDGET_EXCEEDED', message: 'Task budget of $0.50 exceeded' };
      throw err;
    }
    if (this.scenario === 'provider_error') {
      const err: AIError = { code: 'PROVIDER_ERROR', message: 'Downstream LLM provider failed' };
      throw err;
    }
  }
}
