import { OPENAI_TOOLS } from './tools/definitions';
import type { ChatMessage, ToolCall } from './types';

import type { AIGateway, CapabilityTier } from '@peep/shared';

export interface AgentConfig {
  capabilityTier: CapabilityTier;
  sessionToken: string;
  gateway?: AIGateway;
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

const MAX_ITERATIONS = 50;

async function callOpenAI(
  config: AgentConfig,
  messages: ChatMessage[],
  signal: AbortSignal,
): Promise<ChatMessage> {
  if (!config.gateway) {
    throw new Error('AIGateway is required to make calls');
  }

  const response = await config.gateway.generate({
    tier: config.capabilityTier,
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
  }, { signal });

  if (response.toolCalls && response.toolCalls.length > 0) {
    return {
      role: 'assistant',
      content: response.content || '',
      tool_calls: response.toolCalls.map(t => ({
        id: t.id,
        type: 'function',
        function: { name: t.name, arguments: typeof t.arguments === 'string' ? t.arguments : JSON.stringify(t.arguments) }
      }))
    };
  }

  return { role: 'assistant', content: response.content || 'No response.' };
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
      statusMsg = `Reading: ${args.path || ''}`;
    } else if (name === 'propose_file_edit') {
      statusMsg = `Editing: ${args.path || ''}`;
    } else if (name === 'search_files') {
      statusMsg = `Searching files: "${args.query || ''}"`;
    } else if (name === 'search_content') {
      statusMsg = `Searching codebase: "${args.query || ''}"`;
    } else if (name === 'list_dir') {
      statusMsg = `Exploring: ${args.path || '.'}`;
    } else if (name === 'run_command') {
      statusMsg = `Running: ${args.command || ''}`;
    } else if (name === 'delete_file') {
      statusMsg = `Deleting: ${args.path || ''}`;
    } else if (name === 'rename_file') {
      statusMsg = `Renaming: ${args.oldPath || ''} → ${args.newPath || ''}`;
    } else if (name === 'update_design_manifest') {
      statusMsg = `Updating Design Manifest…`;
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
  if (!config.gateway) {
    throw new Error('AIGateway is missing from AgentConfig');
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
    const assistantMessage = await callOpenAI(config, messages, signal);

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
          toolLogs += `Reading <code>${args.path || ''}</code>.<br/>`;
        } else if (name === 'propose_file_edit') {
          toolLogs += `Editing <code>${args.path || ''}</code> — ${args.description || 'applying changes'}.<br/>`;
        } else if (name === 'search_files') {
          toolLogs += `Searching files: <code>"${args.query || ''}"</code>.<br/>`;
        } else if (name === 'list_dir') {
          toolLogs += `Exploring directory: <code>${args.path || '.'}</code>.<br/>`;
        } else if (name === 'search_content') {
          toolLogs += `Searching codebase: <code>"${args.query || ''}"</code>.<br/>`;
        } else if (name === 'run_command') {
          toolLogs += `Running command: <code>${args.command || ''}</code>.<br/>`;
        } else if (name === 'delete_file') {
          toolLogs += `Deleting file: <code>${args.path || ''}</code>.<br/>`;
        } else if (name === 'rename_file') {
          toolLogs += `Renaming: <code>${args.oldPath || ''}</code> → <code>${args.newPath || ''}</code>.<br/>`;
        } else if (name === 'update_design_manifest') {
          toolLogs += `Updating Design Manifest (Design DNA).<br/>`;
        } else if (name === 'manage_plan') {
          const act = String(args.action || 'update');
          if (act === 'init') {
            toolLogs += `📋 Initialized Plan: <strong>${args.goal || 'Engineering Plan'}</strong>.<br/>`;
          } else if (act === 'update_step') {
            if (args.status === 'failed') {
              toolLogs += `⚠️ <strong>Step Failed:</strong> <code>${args.stepId || ''}</code> ${args.error ? `— ${args.error}` : ''}<br/>🔍 <strong>Diagnosing Error...</strong><br/>`;
            } else if (args.status === 'completed') {
              toolLogs += `✅ <strong>Step Completed:</strong> <code>${args.stepId || ''}</code>.<br/>`;
            } else {
              toolLogs += `📋 Plan step <code>${args.stepId || ''}</code> → <strong>${args.status || 'updated'}</strong>.<br/>`;
            }
          } else if (act === 'retry_step') {
            toolLogs += `🔧 <strong>Attempting Recovery Strategy:</strong> ${args.strategy || 'Auto Recovery'}<br/>🔄 <strong>Retrying Step:</strong> <code>${args.stepId || ''}</code>.<br/>`;
          } else if (act === 'record_recovery') {
            const status = String(args.recoveryStatus || 'pending');
            if (status === 'success') {
              toolLogs += `✅ <strong>Recovery Successful!</strong><br/>`;
            } else if (status === 'failed') {
              toolLogs += `❌ <strong>Recovery Strategy Exhausted.</strong><br/>`;
            } else {
              toolLogs += `🔧 Recorded recovery attempt.<br/>`;
            }
          } else {
            toolLogs += `📋 Plan updated.<br/>`;
          }
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
  const summary = await callOpenAI(
    config,
    [
      ...messages,
      {
        role: 'user',
        content: 'Summarize what you did and what the user should review. Be concise.',
      },
    ],
    signal,
  );

  callbacks.onDelta(summary.content || '');
  callbacks.onDone();
  return prefix + (summary.content || '');
}
