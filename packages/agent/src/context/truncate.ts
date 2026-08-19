import type { ChatMessage } from '../types';

export function estimateTokens(text: string): number {
  if (!text) return 0;
  // Standard heuristic for token estimation without external dependencies
  return Math.ceil(text.length / 4);
}

export function estimateMessageTokens(msg: ChatMessage): number {
  let count = estimateTokens(msg.content || '');
  if (msg.tool_calls) {
    for (const tc of msg.tool_calls) {
      count += estimateTokens(tc.function.name) + estimateTokens(tc.function.arguments);
    }
  }
  return count;
}

export interface TruncateOptions {
  maxTokens: number;
}

/**
 * Truncates an array of messages to fit within maxTokens.
 * - Always preserves 'system' messages.
 * - Always preserves the most recent user request (last message).
 * - Tool calls and their results are treated atomically and never orphaned.
 * - Evicts older messages first if they exceed the budget.
 */
export function truncateConversationHistory(
  messages: ChatMessage[],
  options: TruncateOptions
): ChatMessage[] {
  const systemMessages = messages.filter(m => m.role === 'system');
  const nonSystemMessages = messages.filter(m => m.role !== 'system');
  
  let activeUserMsg: ChatMessage | null = null;
  if (nonSystemMessages.length > 0 && nonSystemMessages[nonSystemMessages.length - 1].role === 'user') {
    activeUserMsg = nonSystemMessages.pop()!;
  }

  let currentTokens = 0;
  for (const m of systemMessages) currentTokens += estimateMessageTokens(m);
  if (activeUserMsg) currentTokens += estimateMessageTokens(activeUserMsg);

  const turns: ChatMessage[][] = [];
  let currentTurn: ChatMessage[] = [];

  for (let i = 0; i < nonSystemMessages.length; i++) {
    const msg = nonSystemMessages[i];
    
    if (msg.role === 'user') {
      if (currentTurn.length > 0) turns.push(currentTurn);
      currentTurn = [msg];
    } else if (msg.role === 'assistant') {
      if (currentTurn.length > 0) {
        const lastAssistant = [...currentTurn].reverse().find(m => m.role === 'assistant');
        if (lastAssistant && (!lastAssistant.tool_calls || lastAssistant.tool_calls.length === 0)) {
          turns.push(currentTurn);
          currentTurn = [];
        } else if (lastAssistant && lastAssistant.tool_calls) {
          const toolCallIds = new Set(lastAssistant.tool_calls.map(tc => tc.id));
          const toolResponses = currentTurn.filter(m => m.role === 'tool');
          if (toolResponses.length >= toolCallIds.size) {
            turns.push(currentTurn);
            currentTurn = [];
          }
        }
      }
      currentTurn.push(msg);
      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        turns.push(currentTurn);
        currentTurn = [];
      }
    } else if (msg.role === 'tool') {
      currentTurn.push(msg);
      const lastAssistant = [...currentTurn].reverse().find(m => m.role === 'assistant');
      if (lastAssistant && lastAssistant.tool_calls) {
        const toolCallIds = new Set(lastAssistant.tool_calls.map(tc => tc.id));
        const toolResponses = currentTurn.filter(m => m.role === 'tool');
        if (toolResponses.length >= toolCallIds.size) {
           turns.push(currentTurn);
           currentTurn = [];
        }
      }
    }
  }
  if (currentTurn.length > 0) turns.push(currentTurn);

  const keptTurns: ChatMessage[][] = [];
  for (let i = turns.length - 1; i >= 0; i--) {
    const turn = turns[i];
    const turnTokens = turn.reduce((sum, m) => sum + estimateMessageTokens(m), 0);
    
    if (currentTokens + turnTokens <= options.maxTokens) {
      keptTurns.unshift(turn);
      currentTokens += turnTokens;
    } else {
      break; 
    }
  }

  const finalMessages: ChatMessage[] = [...systemMessages];
  for (const turn of keptTurns) {
    finalMessages.push(...turn);
  }
  if (activeUserMsg) {
    finalMessages.push(activeUserMsg);
  }

  return finalMessages;
}
