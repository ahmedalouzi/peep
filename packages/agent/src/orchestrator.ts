import { OPENAI_TOOLS } from './tools/definitions';
import type { ChatMessage } from './types';

import type { AIGateway, CapabilityTier, AgentTimelineActivity, AgentTimelineActivityType } from '@peep/shared';
import { truncateConversationHistory } from './context/truncate';

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
  /** Optional. Receives structured timeline events for the Agent Execution Timeline UI. */
  onTimelineActivity?: (activity: AgentTimelineActivity) => void;
  /** Optional. Receives runtime phase transitions for Task 15 state machine visibility. */
  onPhaseChange?: (phase: import('@peep/shared').AgentPhase) => void;
}

// ---------------------------------------------------------------------------
// Stable ID helpers
// ---------------------------------------------------------------------------

/**
 * Derives a deterministic run ID from fixed execution-context values.
 * No random component — repeated calls with the same inputs always return the
 * same string so the UI can safely deduplicate on `runId`.
 *
 * Format: `run:<sessionToken>:<firstUserMessage digest>:<epochSecond>`
 * We truncate each segment so IDs stay compact and human-readable.
 */
function deriveRunId(sessionToken: string, firstUserMessage: string, startTimeMs: number): string {
  const session = sessionToken.slice(0, 12).replace(/[^a-zA-Z0-9]/g, '_');
  // Simple deterministic digest: sum of char-codes mod 1e6, zero-padded to 6 digits.
  let hash = 0;
  for (let i = 0; i < firstUserMessage.length; i++) {
    hash = (hash * 31 + firstUserMessage.charCodeAt(i)) >>> 0;
  }
  const digest = (hash % 1_000_000).toString().padStart(6, '0');
  // Use full millisecond timestamp so the runId stays stable for the entire
  // duration of a single runAgentLoop invocation. epochSec (seconds) was
  // wrong because a run that straddles a second boundary would produce two
  // different runIds within the same invocation.
  return `run:${session}:${digest}:${startTimeMs}`;
}

/**
 * Derives a deterministic activity ID from the run context.
 * `toolCallId` is the existing `ToolCall.id` from the LLM response (stable).
 * `suffix` differentiates `in_progress` from `completed`/`failed` for the same call.
 */
function deriveActivityId(runId: string, iterationIndex: number, toolCallId: string, suffix: string): string {
  return `${runId}:i${iterationIndex}:${toolCallId}:${suffix}`;
}

/** Maps a tool name to the closest AgentTimelineActivityType. */
function toolNameToActivityType(name: string): AgentTimelineActivityType {
  switch (name) {
    case 'read_file':         return 'reading';
    case 'propose_file_edit': return 'editing';
    case 'patch_file': return 'editing';
    case 'search_files':      return 'searching';
    case 'search_content':    return 'searching';
    case 'list_dir':          return 'exploring';
    case 'run_command':       return 'running';
    case 'delete_file':       return 'deleting';
    case 'rename_file':       return 'editing';
    case 'update_design_manifest': return 'editing';
    case 'manage_plan':       return 'validating';
    default:                  return 'running';
  }
}

export interface AgentToolExecutor {
  execute: (name: string, args: Record<string, unknown>) => Promise<string>;
  lastOriginalContent?: string;
  lastProposedContent?: string;
}

const MAX_ITERATIONS = 50;

async function callOpenAI(
  config: AgentConfig,
  messages: ChatMessage[],
  signal: AbortSignal,
  onDelta?: (text: string) => void,
): Promise<ChatMessage> {
  if (!config.gateway) {
    throw new Error('AIGateway is required to make calls');
  }

  const stream = config.gateway.stream(
    {
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
    },
    { signal }
  );

  let fullContent = '';
  const toolCalls: Array<{ id: string; name: string; arguments: string | Record<string, unknown> }> = [];

  for await (const event of stream) {
    if (signal.aborted) {
      throw new Error('Cancelled');
    }

    if (event.type === 'delta' && event.content) {
      fullContent += event.content;
      onDelta?.(event.content);
    } else if (event.type === 'tool_call' && event.toolCall) {
      toolCalls.push({
        id: event.toolCall.id,
        name: event.toolCall.name,
        arguments: event.toolCall.arguments,
      });
    } else if (event.type === 'error' && event.error) {
      throw new Error(event.error.message || 'Stream error');
    }
  }

  if (toolCalls.length > 0) {
    return {
      role: 'assistant',
      content: fullContent,
      tool_calls: toolCalls.map((t) => ({
        id: t.id,
        type: 'function',
        function: {
          name: t.name,
          arguments: typeof t.arguments === 'string' ? t.arguments : JSON.stringify(t.arguments),
        },
      })),
    };
  }

  return { role: 'assistant', content: fullContent || 'No response.' };
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
  let logsEmitted = false;

  // -------------------------------------------------------------------------
  // Timeline: derive stable IDs and emit the initial 'understanding' event
  // -------------------------------------------------------------------------
  const firstUserMsg = initialMessages.find((m) => m.role === 'user')?.content ?? '';
  const runId = deriveRunId(config.sessionToken, firstUserMsg, startTime);

  const dispatchTimeline = (activity: AgentTimelineActivity): void => {
    callbacks.onTimelineActivity?.(activity);
  };

  // Emit the 'understanding' event immediately so the UI shows the run started.
  dispatchTimeline({
    id: `${runId}:understanding`,
    runId,
    type: 'understanding',
    message: 'Understanding request…',
    status: 'in_progress',
    timestamp: new Date().toISOString(),
  });

  const emitLogsBlockIfNeeded = () => {
    if (toolLogs && !logsEmitted) {
      logsEmitted = true;
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const logsBlock = `<details class="agent-activity-dropdown" style="background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: 6px; padding: 8px 12px; margin-bottom: 12px; outline: none; display: block; width: 100%;">
<summary style="cursor: pointer; font-weight: 600; font-size: 12.5px; color: var(--gold); user-select: none; outline: none; list-style: none; display: flex; align-items: center; gap: 6px;">
  <span>▶</span> Worked for ${duration}s
</summary>
<div style="margin-top: 8px; font-size: 11.5px; line-height: 1.6; color: #8b949e; border-left: 2px solid var(--border); padding-left: 8px;">
  ${toolLogs}
</div>
</details>\n\n`;
      callbacks.onDelta(logsBlock);
    }
  };

  // Inject Planner directive for complex requests
  let activeContext = systemContext;
  if (isComplex) {
    activeContext += `\n\n[PLANNING MODE ACTIVE] You are faced with a complex software engineering task. First, outline a clear step-by-step checklist of actions and files you will edit. Only then proceed to invoke your tools.`;
  }

  let messages: ChatMessage[] = [
    { role: 'system', content: activeContext },
    ...initialMessages,
  ];

  let effectiveBudget = 100000;
  if (typeof config.gateway.getContextLimit === 'function') {
     effectiveBudget = Math.max(10000, config.gateway.getContextLimit(config.capabilityTier) - 4096 - 2000);
  }

  let accumulatedResponseText = '';
  // Notify observer that LLM thinking begins.
  callbacks.onPhaseChange?.('thinking');

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    if (signal.aborted) throw new Error('Cancelled');

    callbacks.onStatus(i === 0 ? 'Thinking…' : 'Continuing…');

    // Truncate dynamically before each LLM call to prevent loop growth token exhaustion
    messages = truncateConversationHistory(messages, { maxTokens: effectiveBudget });

    const assistantMessage = await callOpenAI(
      config,
      messages,
      signal,
      (delta) => {
        emitLogsBlockIfNeeded();
        callbacks.onDelta(delta);
      }
    );

    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      // Notify observer: entering tool execution phase.
      callbacks.onPhaseChange?.('tool_executing');
      // Accumulate action log statements
      for (const call of assistantMessage.tool_calls) {
        const name = call.function.name;
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(call.function.arguments); } catch {}
        
        if (name === 'read_file') {
          toolLogs += `Reading <code>${args.path || ''}</code>.<br/>`;
        } else if (name === 'propose_file_edit' || name === 'patch_file') {
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

      // -----------------------------------------------------------------------
      // Timeline: emit 'in_progress' for each tool call BEFORE execution,
      //           then 'completed'/'failed' AFTER, preserving event ordering.
      // -----------------------------------------------------------------------
      const toolCallsThisIter = assistantMessage.tool_calls;
      const toolResultMessages: ChatMessage[] = [];

      for (let j = 0; j < toolCallsThisIter.length; j++) {
        const call = toolCallsThisIter[j];
        const name = call.function.name;
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(call.function.arguments); } catch {}

        const activityType = toolNameToActivityType(name);
        // Reuse the LLM-supplied call.id as the stable anchor; it is already
        // deterministic per turn because the model generates it consistently.
        const inProgressId = deriveActivityId(runId, i, call.id, 'in_progress');
        const resolvedId   = deriveActivityId(runId, i, call.id, 'resolved');

        // Build a human-readable message for the in-progress event.
        let inProgressMsg = `Running ${name}…`;
        let fileHint: string | undefined;
        let cmdHint: string | undefined;
        if (name === 'read_file')          { inProgressMsg = `Reading ${args.path || ''}`; fileHint = String(args.path || ''); }
        else if (name === 'propose_file_edit' || name === 'patch_file') { inProgressMsg = `Editing ${args.path || ''}`; fileHint = String(args.path || ''); }
        else if (name === 'search_files')  { inProgressMsg = `Searching files: "${args.query || ''}"`; }
        else if (name === 'search_content'){ inProgressMsg = `Searching codebase: "${args.query || ''}"`; }
        else if (name === 'list_dir')      { inProgressMsg = `Exploring: ${args.path || '.'}`; fileHint = String(args.path || '.'); }
        else if (name === 'run_command')   { inProgressMsg = `Running: ${args.command || ''}`; cmdHint = String(args.command || ''); }
        else if (name === 'delete_file')   { inProgressMsg = `Deleting: ${args.path || ''}`; fileHint = String(args.path || ''); }
        else if (name === 'rename_file')   { inProgressMsg = `Renaming: ${args.oldPath || ''} → ${args.newPath || ''}`; }

        // Dispatch 'in_progress' before execution.
        dispatchTimeline({
          id: inProgressId,
          runId,
          type: activityType,
          message: inProgressMsg,
          status: 'in_progress',
          timestamp: new Date().toISOString(),
          ...(fileHint ? { file: fileHint } : {}),
          ...(cmdHint  ? { command: cmdHint } : {}),
        });

        // Execute the single tool call.
        const singleCallMsg = await (async () => {
          const singleCallName = call.function.name;
          const singleCallArgs = args;
          callbacks.onStatus(inProgressMsg);
          try {
            const output = await executor.execute(singleCallName, singleCallArgs);
            return { role: 'tool' as const, tool_call_id: call.id, name: singleCallName, content: output };
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return { role: 'tool' as const, tool_call_id: call.id, name: singleCallName, content: `Error: ${message}` };
          }
        })();

        toolResultMessages.push(singleCallMsg);

        // Determine outcome.
        const toolFailed = singleCallMsg.content.startsWith('Error:');

        // Accumulate legacy toolLogs (unchanged behaviour).
        if (name === 'read_file') {
          toolLogs += `Reading <code>${args.path || ''}</code>.<br/>`;
          toolLogs += `Explored 1 file &gt;<br/><br/>`;
        } else if (name === 'propose_file_edit' || name === 'patch_file') {
          toolLogs += `Editing <code>${args.path || ''}</code> — ${args.description || 'applying changes'}.<br/>`;
          const original = executor.lastOriginalContent ?? '';
          const proposed = name === 'patch_file' ? (executor.lastProposedContent ?? '') : (args.content ? String(args.content) : '');
          const stats = getDiffStats(original, proposed);
          const filename = String(args.path).split(/[\\/]/).pop() || '';
          toolLogs += `Edited <strong>TS</strong> <code>${filename}</code> <span style="color:#3fb950">+${stats.added}</span> <span style="color:#f85149">-${stats.removed}</span><br/><br/>`;
        } else if (name === 'search_files')  { toolLogs += `Searching files: <code>"${args.query || ''}"</code>.<br/>`; }
        else if (name === 'list_dir')        { toolLogs += `Exploring directory: <code>${args.path || '.'}</code>.<br/>`; }
        else if (name === 'search_content')  { toolLogs += `Searching codebase: <code>"${args.query || ''}"</code>.<br/>`; }
        else if (name === 'run_command')     { toolLogs += `Running command: <code>${args.command || ''}</code>.<br/>`; }
        else if (name === 'delete_file')     { toolLogs += `Deleting file: <code>${args.path || ''}</code>.<br/>`; }
        else if (name === 'rename_file')     { toolLogs += `Renaming: <code>${args.oldPath || ''}</code> → <code>${args.newPath || ''}</code>.<br/>`; }
        else if (name === 'update_design_manifest') { toolLogs += `Updating Design Manifest (Design DNA).<br/>`; }
        else if (name === 'manage_plan') {
          const act = String(args.action || 'update');
          if (act === 'init') { toolLogs += `📋 Initialized Plan: <strong>${args.goal || 'Engineering Plan'}</strong>.<br/>`;}
          else if (act === 'update_step') {
            if (args.status === 'failed')    { toolLogs += `⚠️ <strong>Step Failed:</strong> <code>${args.stepId || ''}</code>${args.error ? ` — ${args.error}` : ''}<br/>🔍 <strong>Diagnosing Error...</strong><br/>`; }
            else if (args.status === 'completed') { toolLogs += `✅ <strong>Step Completed:</strong> <code>${args.stepId || ''}</code>.<br/>`; }
            else { toolLogs += `📋 Plan step <code>${args.stepId || ''}</code> → <strong>${args.status || 'updated'}</strong>.<br/>`; }
          } else if (act === 'retry_step') {
            toolLogs += `🔧 <strong>Attempting Recovery Strategy:</strong> ${args.strategy || 'Auto Recovery'}<br/>🔄 <strong>Retrying Step:</strong> <code>${args.stepId || ''}</code>.<br/>`;
          } else if (act === 'record_recovery') {
            const rStatus = String(args.recoveryStatus || 'pending');
            if (rStatus === 'success') { toolLogs += `✅ <strong>Recovery Successful!</strong><br/>`; }
            else if (rStatus === 'failed') { toolLogs += `❌ <strong>Recovery Strategy Exhausted.</strong><br/>`; }
            else { toolLogs += `🔧 Recorded recovery attempt.<br/>`; }
          } else { toolLogs += `📋 Plan updated.<br/>`; }
        }

        // Dispatch 'completed' or 'failed' AFTER execution.
        dispatchTimeline({
          id: resolvedId,
          runId,
          type: activityType,
          message: toolFailed ? `Failed: ${singleCallMsg.content.slice(0, 120)}` : inProgressMsg,
          status: toolFailed ? 'failed' : 'completed',
          timestamp: new Date().toISOString(),
          ...(fileHint ? { file: fileHint } : {}),
          ...(cmdHint  ? { command: cmdHint } : {}),
        });
      }

      messages.push(...toolResultMessages);
      toolLogs += 'Working.<br/><br/>';
      // Return to thinking phase for next LLM call.
      callbacks.onPhaseChange?.('thinking');
      continue;
    }

    const text = assistantMessage.content?.trim();
    if (text) {
      accumulatedResponseText += text;
      // Timeline: emit 'completed' for the whole run (zero-tool conversational path).
      dispatchTimeline({
        id: `${runId}:completed`,
        runId,
        type: 'completed',
        message: 'Done.',
        status: 'completed',
        timestamp: new Date().toISOString(),
      });
      callbacks.onPhaseChange?.('done');
      callbacks.onDone();
      return accumulatedResponseText;
    }

    break;
  }

  // Pre-stream the collapsible logs block if tools were run
  emitLogsBlockIfNeeded();

  callbacks.onStatus('Summarizing changes…');
  // Notify observer: entering summarization phase.
  callbacks.onPhaseChange?.('summarizing');
  let summaryContent = '';
  await callOpenAI(
    config,
    [
      ...messages,
      {
        role: 'user',
        content: 'Summarize what you did and what the user should review. Be concise.',
      },
    ],
    signal,
    (delta) => {
      summaryContent += delta;
      callbacks.onDelta(delta);
    }
  );

  // Timeline: emit final 'completed' event for the whole run.
  dispatchTimeline({
    id: `${runId}:completed`,
    runId,
    type: 'completed',
    message: 'Done.',
    status: 'completed',
    timestamp: new Date().toISOString(),
  });

  callbacks.onPhaseChange?.('done');
  callbacks.onDone();
  return summaryContent;
}
