import { useWorkspaceStore } from './apps/desktop/src/renderer/src/stores/workspace-store';

export default async function runStoreTests() {
  console.log('Testing workspace store selection semantics...');
  const store = useWorkspaceStore.getState();

  // 1. Initial state
  store.setActiveFile('foo.ts');
  store.setActiveSelection({ text: 'const a = 1;', startLine: 1, endLine: 1, filePath: 'foo.ts' });
  
  let currentSelection = useWorkspaceStore.getState().activeSelection;
  if (currentSelection?.filePath !== 'foo.ts') throw new Error('Selection file path should be foo.ts');

  // 2. Switch tab to bar.ts
  store.setActiveFile('bar.ts');

  currentSelection = useWorkspaceStore.getState().activeSelection;
  if (!currentSelection) throw new Error('Selection should not be cleared just by switching tabs');
  if (currentSelection.filePath !== 'foo.ts') {
    throw new Error(`Switching tab incorrectly changed selection filePath to ${currentSelection.filePath}`);
  }

  // 3. Clear selection
  store.setActiveSelection(null);
  currentSelection = useWorkspaceStore.getState().activeSelection;
  if (currentSelection !== null) throw new Error('Selection should be cleared');

  console.log('v Workspace store selection semantics tests passed!');
}
runStoreTests().catch(console.error);  
