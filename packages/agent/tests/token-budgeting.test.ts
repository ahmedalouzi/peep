import assert from 'node:assert';
import { truncateConversationHistory, estimateTokens } from '../src/context/truncate';
import type { ChatMessage } from '../src/types';

export default async function runTests() {
  console.log('  Running Token Budgeting unit tests...');

  console.log('  [Test 1] estimateTokens calculates chars/4 rounded up...');
  {
    assert.strictEqual(estimateTokens('123'), 1);
    assert.strictEqual(estimateTokens('1234'), 1);
    assert.strictEqual(estimateTokens('12345'), 2);
    console.log('    ✓ estimateTokens correct');
  }

  console.log('  [Test 2] truncateConversationHistory preserves system and latest user message...');
  {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'You are an agent' },
      { role: 'user', content: 'First message' },
      { role: 'assistant', content: 'First reply' },
      { role: 'user', content: 'Second message' }
    ];

    const truncated = truncateConversationHistory(messages, { maxTokens: 10 });
    assert.strictEqual(truncated.length, 2);
    assert.strictEqual(truncated[0].role, 'system');
    assert.strictEqual(truncated[1].role, 'user');
    assert.strictEqual(truncated[1].content, 'Second message');
    console.log('    ✓ Preserved system and latest user message');
  }

  console.log('  [Test 3] truncateConversationHistory evicts oldest history cleanly...');
  {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'SYS' },
      { role: 'user', content: 'U1' },
      { role: 'assistant', content: 'A1' },
      { role: 'user', content: 'U2' },
      { role: 'assistant', content: 'A2' },
      { role: 'user', content: 'U3' }
    ];

    const truncated = truncateConversationHistory(messages, { maxTokens: 4 });
    assert.strictEqual(truncated.length, 4);
    assert.strictEqual(truncated[0].content, 'SYS');
    assert.strictEqual(truncated[1].content, 'U2');
    assert.strictEqual(truncated[2].content, 'A2');
    assert.strictEqual(truncated[3].content, 'U3');
    console.log('    ✓ Evicted oldest history cleanly');
  }

  console.log('  [Test 4] truncateConversationHistory keeps tool calls and results atomic...');
  {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'SYS' },
      { role: 'user', content: 'U1' },
      { 
        role: 'assistant', 
        content: '', 
        tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'read_file', arguments: '{}' } }]
      },
      { role: 'tool', tool_call_id: 'call_1', name: 'read_file', content: 'file content' },
      { role: 'assistant', content: 'I read the file' },
      { role: 'user', content: 'U2' },
    ];

    const truncated = truncateConversationHistory(messages, { maxTokens: 4 }); 
    assert.strictEqual(truncated.length, 2);
    assert.strictEqual(truncated[0].role, 'system');
    assert.strictEqual(truncated[1].content, 'U2');

    const truncatedFit = truncateConversationHistory(messages, { maxTokens: 50 });
    assert.strictEqual(truncatedFit.length, 6);
    console.log('    ✓ Handled atomic tool turns');
  }

  console.log('  [Test 5] truncateConversationHistory handles multiple tool calls atomically...');
  {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'SYS' },
      { role: 'user', content: 'U1' },
      { 
        role: 'assistant', 
        content: '', 
        tool_calls: [
          { id: 'call_1', type: 'function', function: { name: 't1', arguments: '' } },
          { id: 'call_2', type: 'function', function: { name: 't2', arguments: '' } }
        ]
      },
      { role: 'tool', tool_call_id: 'call_1', name: 't1', content: 'res1' },
      { role: 'tool', tool_call_id: 'call_2', name: 't2', content: 'res2' },
      { role: 'user', content: 'U2' },
    ];

    const truncatedFit = truncateConversationHistory(messages, { maxTokens: 20 });
    assert.strictEqual(truncatedFit.length, 6);

    const truncatedSmall = truncateConversationHistory(messages, { maxTokens: 4 });
    assert.strictEqual(truncatedSmall.length, 2);
    console.log('    ✓ Handled multiple tool calls atomically');
  }

  console.log('  [Test 6] truncateConversationHistory evicts oldest history but preserves large system prompt...');
  {
    const largeSystem = 'S'.repeat(400); // 100 tokens
    const largeUserMsg = 'U'.repeat(100); // 25 tokens

    const messages: ChatMessage[] = [
      { role: 'system', content: largeSystem },
      { role: 'user', content: 'old 1' },
      { role: 'assistant', content: 'old 2' },
      { role: 'user', content: largeUserMsg }
    ];

    const truncated = truncateConversationHistory(messages, { maxTokens: 125 });
    assert.strictEqual(truncated.length, 2);
    assert.strictEqual(truncated[0].content, largeSystem);
    assert.strictEqual(truncated[1].content, largeUserMsg);
    console.log('    ✓ Preserved large system prompt');
  }
}
