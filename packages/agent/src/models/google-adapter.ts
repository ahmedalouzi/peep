import type {
  AIRequest,
  AIResponse,
  AIStreamEvent,
} from '@peep/shared';
import type { ProviderAdapter } from './backend-gateway';

export class GoogleGeminiAdapter implements ProviderAdapter {
  readonly id = 'google';

  constructor(private apiKey?: string) {}

  private mapMessages(messages: any[]): { contents: any[]; systemInstruction?: any } {
    let systemInstruction: any = undefined;
    const contents: any[] = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.role === 'system') {
        systemInstruction = { parts: [{ text: msg.content }] };
      } else if (msg.role === 'user') {
        contents.push({ role: 'user', parts: [{ text: msg.content }] });
      } else if (msg.role === 'assistant') {
        const parts: any[] = [];
        if (msg.content) parts.push({ text: msg.content });
        if (msg.tool_calls) {
          for (const tc of msg.tool_calls) {
            let args = {};
            try { args = JSON.parse(tc.function.arguments); } catch {}
            let thoughtSignature = '';
            let id = tc.id;
            try {
              const parsed = JSON.parse(tc.id);
              if (parsed.thoughtSignature) thoughtSignature = parsed.thoughtSignature;
              if (parsed.id) id = parsed.id;
            } catch {}
            
            const part: any = { functionCall: { name: tc.function.name, args, id } };
            if (thoughtSignature) part.thoughtSignature = thoughtSignature;
            parts.push(part);
          }
        }
        contents.push({ role: 'model', parts });
      } else if (msg.role === 'tool') {
        let id = msg.tool_call_id;
        try {
          const parsed = JSON.parse(id);
          if (parsed.id) id = parsed.id;
        } catch {}

        const parts = [{
          functionResponse: {
            name: msg.name,
            response: { name: msg.name, content: msg.content },
            id
          }
        }];
        
        while (i + 1 < messages.length && messages[i + 1].role === 'tool') {
          const nextMsg = messages[i + 1];
          let nextId = nextMsg.tool_call_id;
          try {
            const parsed = JSON.parse(nextId);
            if (parsed.id) nextId = parsed.id;
          } catch {}
          
          parts.push({
            functionResponse: {
              name: nextMsg.name,
              response: { name: nextMsg.name, content: nextMsg.content },
              id: nextId
            }
          });
          i++;
        }
        
        contents.push({ role: 'user', parts });
      }
    }
    return { contents, systemInstruction };
  }

  private mapTools(tools: any[] | undefined): any[] | undefined {
    if (!tools || tools.length === 0) return undefined;
    const functionDeclarations = tools
      .filter(t => t.type === 'function')
      .map(t => ({
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters
      }));
    if (functionDeclarations.length === 0) return undefined;
    return [{ functionDeclarations }];
  }

  async generate(request: AIRequest, options?: { signal?: AbortSignal } & { resolvedModelId?: string }): Promise<AIResponse> {
    if (!this.apiKey) throw new Error('GOOGLE_API_KEY is not configured');
    
    const modelId = options?.resolvedModelId || 'gemini-1.5-flash';
    const { contents, systemInstruction } = this.mapMessages(request.messages);
    const tools = this.mapTools(request.tools);

    const payload: any = { contents };
    if (systemInstruction) payload.systemInstruction = systemInstruction;
    if (tools) payload.tools = tools;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${this.apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: options?.signal
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errBody}`);
    }

    const data = await response.json();
    console.log('[DEBUG_GEMINI_RESPONSE]', JSON.stringify(data, null, 2));
    
    const result: AIResponse = { content: '' };
    
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const toolCalls: any[] = [];
    
    for (const p of parts) {
      if (p.text) result.content += p.text;
      if (p.functionCall) {
        const rawId = p.functionCall.id || p.id || 'call_' + Math.random().toString(36).substring(2);
        const combinedId = JSON.stringify({ id: rawId, thoughtSignature: p.thoughtSignature || '' });
        toolCalls.push({
          id: combinedId,
          name: p.functionCall.name,
          arguments: p.functionCall.args || {}
        });
      }
    }
    
    if (toolCalls.length > 0) {
      result.toolCalls = toolCalls;
    }
    
    return result;
  }

  async *stream(request: AIRequest, options?: { signal?: AbortSignal } & { resolvedModelId?: string }): AsyncIterable<AIStreamEvent> {
    if (!this.apiKey) throw new Error('GOOGLE_API_KEY is not configured');
    
    const modelId = options?.resolvedModelId || 'gemini-1.5-flash';
    const { contents, systemInstruction } = this.mapMessages(request.messages);
    const tools = this.mapTools(request.tools);

    const payload: any = { contents };
    if (systemInstruction) payload.systemInstruction = systemInstruction;
    if (tools) payload.tools = tools;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?alt=sse&key=${this.apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: options?.signal
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errBody}`);
    }

    if (!response.body) throw new Error('Empty response body');

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      if (options?.signal?.aborted) throw new Error('Aborted');
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const dataStr = trimmed.slice(6);
          if (dataStr === '[DONE]') continue;
          
          let data;
          try { data = JSON.parse(dataStr); } catch { continue; }
          
          const parts = data?.candidates?.[0]?.content?.parts || [];
          for (const part of parts) {
            if (part?.text) {
              yield { type: 'delta', content: part.text };
            }
            if (part?.functionCall) {
              const rawId = part.functionCall.id || part.id || 'call_' + Math.random().toString(36).substring(2);
              const combinedId = JSON.stringify({ id: rawId, thoughtSignature: part.thoughtSignature || '' });
              yield {
                type: 'tool_call',
                toolCall: {
                  id: combinedId,
                  name: part.functionCall.name,
                  arguments: part.functionCall.args || {}
                }
              };
            }
          }
        }
      }
    }
    yield { type: 'done' };
  }
}
