import { OPENAI_TOOLS } from './tools/definitions';
import type { ChatMessage, ToolCall } from './types';

export interface AgentConfig {
  apiKey: string;
  provider: 'openai' | 'anthropic';
  model?: string;
}

export interface AgentCallbacks {
  onStatus: (message: string) => void;
  onDelta: (text: string) => void;
  onError: (message: string) => void;
  onDone: () => void;
}

export interface AgentToolExecutor {
  execute: (name: string, args: Record<string, unknown>) => Promise<string>;
}

const MAX_ITERATIONS = 8;

async function callOpenAI(
  config: AgentConfig,
  messages: ChatMessage[],
  signal: AbortSignal,
): Promise<ChatMessage> {
  const model = config.model ?? 'gpt-4o-mini';

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: messages.map((m) => {
        if (m.role === 'tool') {
          return { role: 'tool', content: m.content, tool_call_id: m.tool_call_id };
        }
        if (m.role === 'assistant' && m.tool_calls) {
          return { role: 'assistant', content: m.content || null, tool_calls: m.tool_calls };
        }
        return { role: m.role, content: m.content };
      }),
      tools: OPENAI_TOOLS,
      tool_choice: 'auto',
    }),
    signal,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `OpenAI API error ${response.status}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: ChatMessage }>;
  };

  return data.choices[0]?.message ?? { role: 'assistant', content: 'No response.' };
}

async function streamOpenAISummary(
  config: AgentConfig,
  messages: ChatMessage[],
  callbacks: AgentCallbacks,
  signal: AbortSignal,
): Promise<string> {
  const model = config.model ?? 'gpt-4o-mini';

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: messages.map((m) => {
        if (m.role === 'tool') {
          return { role: 'tool', content: m.content, tool_call_id: m.tool_call_id };
        }
        return { role: m.role, content: m.content };
      }),
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `OpenAI API error ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response stream');

  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (payload === '[DONE]') continue;

      try {
        const parsed = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          fullText += delta;
          callbacks.onDelta(delta);
        }
      } catch {
        /* skip malformed chunks */
      }
    }
  }

  return fullText;
}

async function executeToolCalls(
  toolCalls: ToolCall[],
  executor: AgentToolExecutor,
  callbacks: AgentCallbacks,
): Promise<ChatMessage[]> {
  const results: ChatMessage[] = [];

  for (const call of toolCalls) {
    const name = call.function.name;
    callbacks.onStatus(`Running ${name}…`);

    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(call.function.arguments) as Record<string, unknown>;
    } catch {
      results.push({
        role: 'tool',
        tool_call_id: call.id,
        content: 'Error: invalid tool arguments JSON',
      });
      continue;
    }

    try {
      const output = await executor.execute(name, args);
      results.push({ role: 'tool', tool_call_id: call.id, content: output });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ role: 'tool', tool_call_id: call.id, content: `Error: ${message}` });
    }
  }

  return results;
}

export async function runAgentLoop(
  config: AgentConfig,
  systemContext: string,
  initialMessages: ChatMessage[],
  executor: AgentToolExecutor,
  callbacks: AgentCallbacks,
  signal: AbortSignal,
): Promise<string> {
  if (config.provider !== 'openai') {
    throw new Error('Only OpenAI provider is supported in this version. Set provider to openai in Settings.');
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: systemContext },
    ...initialMessages,
  ];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    if (signal.aborted) throw new Error('Cancelled');

    callbacks.onStatus(i === 0 ? 'Thinking…' : 'Continuing…');
    const assistantMessage = await callOpenAI(config, messages, signal);

    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      messages.push(assistantMessage);
      const toolResults = await executeToolCalls(assistantMessage.tool_calls, executor, callbacks);
      messages.push(...toolResults);
      continue;
    }

    const text = assistantMessage.content?.trim();
    if (text) {
      callbacks.onDelta(text);
      callbacks.onDone();
      return text;
    }

    break;
  }

  callbacks.onStatus('Summarizing changes…');
  const summary = await streamOpenAISummary(
    config,
    [
      ...messages,
      {
        role: 'user',
        content: 'Summarize what you did and what the user should review. Be concise.',
      },
    ],
    callbacks,
    signal,
  );

  callbacks.onDone();
  return summary;
}
