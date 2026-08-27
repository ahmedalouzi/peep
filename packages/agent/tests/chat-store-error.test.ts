import { useChatStore } from '../../../apps/desktop/src/renderer/src/stores/chat-store';

export default async function run() {
  console.log('  Running Chat Store IPC Error state test...');

  let fetchError = false;

  // Mock the window.peep IPC interface
  (global as any).window = {
    peep: {
      loadChatThread: async (threadId: string) => {
        if (fetchError) {
          throw new Error('Backend offline mocked error');
        }
        return {
          messages: [{ id: '1', role: 'user', content: 'test msg' }],
          runs: []
        };
      }
    }
  };

  // Test 1: Successful call does not set error
  fetchError = false;
  useChatStore.setState({ activeThreadId: null, ipcError: null, agentPhase: 'idle' });
  await useChatStore.getState().switchThread('thread_123');
  
  if (useChatStore.getState().ipcError !== null) {
    throw new Error('ipcError should be null on success');
  }

  // Test 2: Failing call sets error
  fetchError = true;
  await useChatStore.getState().switchThread('thread_123');
  
  if (useChatStore.getState().ipcError !== 'Failed to load thread') {
    throw new Error('ipcError was not set on failure');
  }
  
  console.log('    ✓ Verified: ipcError is set on failure');

  // Test 3: Subsequent successful call clears error
  fetchError = false;
  await useChatStore.getState().switchThread('thread_123');
  
  if (useChatStore.getState().ipcError !== null) {
    throw new Error(`ipcError did not clear on success. Current value: ${useChatStore.getState().ipcError}`);
  }
  
  console.log('    ✓ Verified: ipcError auto-clears on subsequent success');

  console.log('  🟢 All Chat Store IPC Error state tests passed.');
}
