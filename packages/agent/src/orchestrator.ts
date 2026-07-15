import { OPENAI_TOOLS } from './tools/definitions';
import type { ChatMessage, ToolCall } from './types';

export interface AgentConfig {
  apiKey: string;
  provider: 'openai' | 'anthropic' | 'google';
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

const getApiUrl = (config: AgentConfig) => {
  if (config.provider === 'google') {
    return 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
  }
  return 'https://api.openai.com/v1/chat/completions';
};

async function callOpenAI(
  config: AgentConfig,
  messages: ChatMessage[],
  signal: AbortSignal,
): Promise<ChatMessage> {
  const model = config.model ?? (config.provider === 'google' ? 'gemini-1.5-flash' : 'gpt-4o-mini');
  const cleanKey = config.apiKey.replace(/[^\x20-\x7E]/g, '');

  const response = await fetch(getApiUrl(config), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cleanKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: messages.map((m) => {
        if (m.role === 'tool') {
          return { role: 'tool', content: m.content, tool_call_id: m.tool_call_id, name: m.name };
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
    throw new Error(body || `${config.provider} API error ${response.status}`);
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
  const model = config.model ?? (config.provider === 'google' ? 'gemini-1.5-flash' : 'gpt-4o-mini');
  const cleanKey = config.apiKey.replace(/[^\x20-\x7E]/g, '');

  const response = await fetch(getApiUrl(config), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cleanKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: messages.map((m) => {
        if (m.role === 'tool') {
          return { role: 'tool', content: m.content, tool_call_id: m.tool_call_id, name: m.name };
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
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(call.function.arguments) as Record<string, unknown>;
    } catch {
      // ignore
    }

    let statusMsg = `Running ${name}…`;
    if (name === 'read_file') {
      statusMsg = `Reading file: ${args.path || ''}`;
    } else if (name === 'propose_file_edit') {
      statusMsg = `Proposing edits to: ${args.path || ''}`;
    } else if (name === 'search_files') {
      statusMsg = `Searching files matching: "${args.query || ''}"`;
    } else if (name === 'search_content') {
      statusMsg = `Searching content for: "${args.query || ''}"`;
    } else if (name === 'list_dir') {
      statusMsg = `Listing directory: ${args.path || '.'}`;
    }

    callbacks.onStatus(statusMsg);

    try {
      const output = await executor.execute(name, args);
      results.push({ role: 'tool', tool_call_id: call.id, name, content: output });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ role: 'tool', tool_call_id: call.id, name, content: `Error: ${message}` });
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
  if (config.provider !== 'openai' && config.provider !== 'google') {
    throw new Error('Only OpenAI and Google Gemini providers are supported in this version. Set provider in Settings.');
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: systemContext },
    ...initialMessages,
  ];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    if (signal.aborted) throw new Error('Cancelled');

    callbacks.onStatus(i === 0 ? 'Thinking…' : 'Continuing…');
    const assistantMessage = await callOpenAI(config, messages, signal);

    if (assistantMessage.content) {
      callbacks.onStatus(assistantMessage.content.trim());
    }

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
