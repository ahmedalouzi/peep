import { runAgentLoop, type AgentToolExecutor } from '../src/orchestrator';
import { MockAIGateway } from '../src/models/mock-gateway';
import type { ChatMessage } from '../src/types';

export default async function runTests() {
  console.log('  Running Real-Time Streaming Orchestrator unit tests...');

  // Test 1: Conversational query streams tokens incrementally without executing tools
  {
    console.log('  [Test 1] Conversational streaming without tools...');
    const gateway = new MockAIGateway();
    gateway.setScenario('success');

    const streamedChunks: string[] = [];
    let doneCalled = false;
    let statusUpdates: string[] = [];

    const executedTools: string[] = [];
    const executor: AgentToolExecutor = {
      execute: async (name) => {
        executedTools.push(name);
        return 'tool output';
      }
    };

    const controller = new AbortController();
    const result = await runAgentLoop(
      {
        capabilityTier: 'fast',
        sessionToken: 'test_token',
        gateway
      },
      'You are Synkro assistant.',
      [{ role: 'user', content: 'Can you build this using Flutter?' }],
      executor,
      {
        onStatus: (msg) => statusUpdates.push(msg),
        onDelta: (chunk) => streamedChunks.push(chunk),
        onError: (err) => { throw new Error('Unexpected onError: ' + err); },
        onDone: () => { doneCalled = true; }
      },
      controller.signal
    );

    if (executedTools.length > 0) {
      throw new Error(`Expected NO tools to be executed for conversational prompt, but got: ${executedTools.join(', ')}`);
    }

    if (streamedChunks.length < 2) {
      throw new Error(`Expected multiple streaming chunks for conversational reply, but got ${streamedChunks.length} chunks: ${JSON.stringify(streamedChunks)}`);
    }

    if (!doneCalled) {
      throw new Error('Expected onDone() to be called after conversational stream');
    }

    const fullStreamed = streamedChunks.join('');
    if (!fullStreamed || fullStreamed !== result) {
      throw new Error(`Streamed content mismatch: accumulated="${fullStreamed}" vs returned="${result}"`);
    }
    console.log(`    ✓ Streamed ${streamedChunks.length} incremental chunks for conversational query: "${fullStreamed.slice(0, 50)}..."`);
  }

  // Test 2: Coding query with tool execution followed by streamed response
  {
    console.log('  [Test 2] Coding query with tool execution and response streaming...');
    const gateway = new MockAIGateway();
    gateway.setScenario('tool_call');
    gateway.setCustomToolCall({
      id: 'call-search-1',
      name: 'search_files',
      arguments: { query: 'main' }
    });

    const streamedChunks: string[] = [];
    let doneCalled = false;
    const executedTools: string[] = [];

    const executor: AgentToolExecutor = {
      execute: async (name, args) => {
        executedTools.push(name);
        // After executing search_files, switch gateway scenario to streaming response for next turn
        gateway.setScenario('streaming');
        return 'lib/main.dart\nlib/main_page.dart';
      }
    };

    const controller = new AbortController();
    const result = await runAgentLoop(
      {
        capabilityTier: 'fast',
        sessionToken: 'test_token',
        gateway
      },
      'You are Synkro assistant.',
      [{ role: 'user', content: 'Find all main files in the project.' }],
      executor,
      {
        onStatus: () => {},
        onDelta: (chunk) => streamedChunks.push(chunk),
        onError: (err) => { throw new Error('Unexpected onError: ' + err); },
        onDone: () => { doneCalled = true; }
      },
      controller.signal
    );

    if (!executedTools.includes('search_files')) {
      throw new Error(`Expected search_files tool to be executed, but executed: ${executedTools.join(', ')}`);
    }

    if (streamedChunks.length < 2) {
      throw new Error(`Expected streamed chunks after tool execution, but got ${streamedChunks.length} chunks: ${JSON.stringify(streamedChunks)}`);
    }

    if (!doneCalled) {
      throw new Error('Expected onDone() to be called after tool response stream');
    }

    console.log(`    ✓ Successfully executed tool [${executedTools.join(', ')}] and streamed ${streamedChunks.length} chunks`);
  }

  // Test 3: Stream cancellation
  {
    console.log('  [Test 3] Stream cancellation with AbortController...');
    const gateway = new MockAIGateway();
    gateway.setScenario('streaming');

    const controller = new AbortController();
    const streamedChunks: string[] = [];

    const executor: AgentToolExecutor = {
      execute: async () => 'out'
    };

    const loopPromise = runAgentLoop(
      {
        capabilityTier: 'fast',
        sessionToken: 'test_token',
        gateway
      },
      'System context',
      [{ role: 'user', content: 'Tell me a long story.' }],
      executor,
      {
        onStatus: () => {},
        onDelta: (chunk) => {
          streamedChunks.push(chunk);
          // Abort on first chunk received
          controller.abort();
        },
        onError: () => {},
        onDone: () => {}
      },
      controller.signal
    );

    try {
      await loopPromise;
      throw new Error('Expected runAgentLoop to reject with cancellation error');
    } catch (err: any) {
      if (!err.message.includes('Cancelled') && !err.message.includes('Request aborted') && !err.message.includes('Aborted')) {
        throw err;
      }
    }

    console.log('    ✓ Cancellation aborted stream immediately on signal');
  }

  console.log('  🟢 All Real-Time Streaming Orchestrator unit tests passed.');
}
