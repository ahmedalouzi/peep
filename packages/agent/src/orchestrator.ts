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

export function getRoutedModel(config: AgentConfig, isComplex: boolean): string {
  if (config.model && config.model !== 'auto') {
    return config.model;
  }
  if (config.provider === 'google') {
    return isComplex ? 'gemini-1.5-pro' : 'gemini-3.5-flash';
  } else if (config.provider === 'openai') {
    return isComplex ? 'gpt-4o' : 'gpt-4o-mini';
  }
  return 'gpt-4o-mini';
}

function estimateTokens(text: string): number {
  return Math.ceil((text || '').length / 4);
}

function calculateCost(model: string, inputTokens: number, outputTokens: number) {
  let inputRate = 0;
  let outputRate = 0;
  const m = model.toLowerCase();
  if (m.includes('gemini-3.5-flash') || m.includes('gemini-1.5-flash')) {
    inputRate = 0.075 / 1_000_000;
    outputRate = 0.30 / 1_000_000;
  } else if (m.includes('gemini-1.5-pro')) {
    inputRate = 1.25 / 1_000_000;
    outputRate = 5.00 / 1_000_000;
  } else if (m.includes('gpt-4o-mini')) {
    inputRate = 0.15 / 1_000_000;
    outputRate = 0.60 / 1_000_000;
  } else if (m.includes('gpt-4o')) {
    inputRate = 5.00 / 1_000_000;
    outputRate = 15.00 / 1_000_000;
  } else {
    inputRate = 0.15 / 1_000_000;
    outputRate = 0.60 / 1_000_000;
  }
  const cost = (inputTokens * inputRate) + (outputTokens * outputRate);
  return { inputTokens, outputTokens, cost };
}

function logCost(model: string, inputString: string, outputString: string) {
  const inputTokens = estimateTokens(inputString);
  const outputTokens = estimateTokens(outputString);
  const usage = calculateCost(model, inputTokens, outputTokens);
  console.log(`[AI Gateway] Model: ${model} | Input: ${usage.inputTokens} t | Output: ${usage.outputTokens} t | Cost: $${usage.cost.toFixed(6)}`);
}

async function callOpenAI(
  config: AgentConfig,
  messages: ChatMessage[],
  signal: AbortSignal,
  isComplex?: boolean,
): Promise<ChatMessage> {
  const model = getRoutedModel(config, isComplex ?? false);
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
          return { role: 'tool', content: m.content, tool_call_id: m.tool_call_id, name: m.name || 'tool_name' };
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

  const assistantMessage = data.choices[0]?.message ?? { role: 'assistant', content: 'No response.' };
  
  // Track tokens and cost
  const promptText = JSON.stringify(messages);
  const completionText = assistantMessage.content || JSON.stringify(assistantMessage.tool_calls || '');
  logCost(model, promptText, completionText);

  return assistantMessage;
}

async function streamOpenAISummary(
  config: AgentConfig,
  messages: ChatMessage[],
  callbacks: AgentCallbacks,
  signal: AbortSignal,
  isComplex?: boolean,
): Promise<string> {
  const model = getRoutedModel(config, isComplex ?? false);
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
          return { role: 'tool', content: m.content, tool_call_id: m.tool_call_id, name: m.name || 'tool_name' };
        }
        if (m.role === 'assistant' && m.tool_calls) {
          return { role: 'assistant', content: m.content || null, tool_calls: m.tool_calls };
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

  // Track tokens and cost for streaming summary
  const promptText = JSON.stringify(messages);
  logCost(model, promptText, fullText);

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

function getDiffStats(original: string, proposed: string) {
  const origLines = (original || '').split(/\r?\n/);
  const propLines = (proposed || '').split(/\r?\n/);
  let added = 0;
  let removed = 0;
  const origSet = new Set(origLines);
  
  for (const line of propLines) {
    if (line.trim() && !origSet.has(line)) added++;
  }
  const propSet = new Set(propLines);
  for (const line of origLines) {
    if (line.trim() && !propSet.has(line)) removed++;
  }
  return { added, removed };
}

export async function runAgentLoop(
  config: AgentConfig,
  systemContext: string,
  initialMessages: ChatMessage[],
  executor: AgentToolExecutor,
  callbacks: AgentCallbacks,
  signal: AbortSignal,
  isComplex?: boolean,
): Promise<string> {
  if (config.provider !== 'openai' && config.provider !== 'google') {
    throw new Error('Only OpenAI and Google Gemini providers are supported in this version. Set provider in Settings.');
  }

  const startTime = Date.now();
  let toolLogs = '';

  // Inject Planner directive for complex requests
  let activeContext = systemContext;
  if (isComplex) {
    activeContext += `\n\n[PLANNING MODE ACTIVE] You are faced with a complex software engineering task. First, outline a clear step-by-step checklist of actions and files you will edit. Only then proceed to invoke your tools.`;
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: activeContext },
    ...initialMessages,
  ];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    if (signal.aborted) throw new Error('Cancelled');

    callbacks.onStatus(i === 0 ? 'Thinking…' : 'Continuing…');
    const assistantMessage = await callOpenAI(config, messages, signal, isComplex);

    if (assistantMessage.content) {
      callbacks.onStatus(assistantMessage.content.trim());
    }

    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      // Accumulate action log statements
      for (const call of assistantMessage.tool_calls) {
        const name = call.function.name;
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(call.function.arguments); } catch {}
        
        if (name === 'read_file') {
          toolLogs += `I will view <code>${args.path || ''}</code>.<br/>`;
        } else if (name === 'propose_file_edit') {
          toolLogs += `I will edit <code>${args.path || ''}</code> to ${args.description || 'apply code edits'}.<br/>`;
        } else if (name === 'search_files') {
          toolLogs += `I will search files matching <code>"${args.query || ''}"</code>.<br/>`;
        } else if (name === 'list_dir') {
          toolLogs += `I will list the directory <code>${args.path || '.'}</code>.<br/>`;
        }
      }

      messages.push(assistantMessage);
      const toolResults = await executeToolCalls(assistantMessage.tool_calls, executor, callbacks);
      messages.push(...toolResults);

      // Accumulate result / completion statements
      for (let j = 0; j < assistantMessage.tool_calls.length; j++) {
        const call = assistantMessage.tool_calls[j];
        const name = call.function.name;
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(call.function.arguments); } catch {}

        if (name === 'read_file') {
          toolLogs += `Explored 1 file &gt;<br/><br/>`;
        } else if (name === 'propose_file_edit') {
          const original = (executor as any).lastOriginalContent ?? '';
          const proposed = args.content ? String(args.content) : '';
          const stats = getDiffStats(original, proposed);
          const filename = String(args.path).split(/[\\/]/).pop() || '';
          toolLogs += `Edited <strong>TS</strong> <code>${filename}</code> <span style="color:#3fb950">+${stats.added}</span> <span style="color:#f85149">-${stats.removed}</span><br/><br/>`;
        }
      }

      toolLogs += 'Working.<br/><br/>';
      continue;
    }

    const text = assistantMessage.content?.trim();
    if (text) {
      if (toolLogs) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        const logsBlock = `<details class="agent-activity-dropdown" style="background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: 6px; padding: 8px 12px; margin-bottom: 12px; outline: none; display: block; width: 100%;">
<summary style="cursor: pointer; font-weight: 600; font-size: 12.5px; color: var(--gold); user-select: none; outline: none; list-style: none; display: flex; align-items: center; gap: 6px;">
  <span>▶</span> Worked for ${duration}s
</summary>
<div style="margin-top: 8px; font-size: 11.5px; line-height: 1.6; color: #8b949e; border-left: 2px solid var(--border); padding-left: 8px;">
  ${toolLogs}
</div>
</details>\n\n`;
        callbacks.onDelta(logsBlock + text);
        callbacks.onDone();
        return logsBlock + text;
      } else {
        callbacks.onDelta(text);
        callbacks.onDone();
        return text;
      }
    }

    break;
  }

  // Pre-stream the collapsible logs block if tools were run
  let prefix = '';
  if (toolLogs) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    prefix = `<details class="agent-activity-dropdown" style="background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: 6px; padding: 8px 12px; margin-bottom: 12px; outline: none; display: block; width: 100%;">
<summary style="cursor: pointer; font-weight: 600; font-size: 12.5px; color: var(--gold); user-select: none; outline: none; list-style: none; display: flex; align-items: center; gap: 6px;">
  <span>▶</span> Worked for ${duration}s
</summary>
<div style="margin-top: 8px; font-size: 11.5px; line-height: 1.6; color: #8b949e; border-left: 2px solid var(--border); padding-left: 8px;">
  ${toolLogs}
</div>
</details>\n\n`;
    callbacks.onDelta(prefix);
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
    isComplex,
  );

  callbacks.onDone();
  return prefix + summary;
}
