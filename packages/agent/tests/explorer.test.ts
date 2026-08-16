import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { WorkspaceManager } from '../../../apps/desktop/src/main/services/workspace-manager';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error('Assertion Failed: ' + msg);
}

export default async function runExplorerTests() {
  console.log('  Running Workspace Explorer unit tests...');

  const tempRoot = join(process.cwd(), 'temp_test_workspace_explorer');

  // Clean up any stale directory from previous runs
  try {
    await fs.rm(tempRoot, { recursive: true, force: true });
  } catch {}

  // Set up mock DB service for WorkspaceManager
  const mockDb = {
    upsertProject: async () => {},
    getRecentProjects: () => []
  } as any;

  const workspace = new WorkspaceManager(mockDb);

  try {
    // A & G. Test top-level listing and hidden folder policy
    await fs.mkdir(tempRoot, { recursive: true });
    await fs.mkdir(join(tempRoot, 'assets'), { recursive: true });
    await fs.mkdir(join(tempRoot, 'src'), { recursive: true });
    await fs.mkdir(join(tempRoot, '.git'), { recursive: true });
    await fs.mkdir(join(tempRoot, 'node_modules'), { recursive: true });
    await fs.writeFile(join(tempRoot, 'App.tsx'), 'export default function App() {}');

    const topEntries = await workspace.listDir(tempRoot, 0, 1);
    const names = topEntries.map(e => e.name);

    assert(names.includes('assets'), 'assets folder should be visible');
    assert(names.includes('src'), 'src folder should be visible');
    assert(names.includes('App.tsx'), 'App.tsx file should be visible');
    assert(!names.includes('.git'), '.git directory should be ignored');
    assert(!names.includes('node_modules'), 'node_modules directory should be ignored');

    // B. Test directory creation and listing
    const srcPath = join(tempRoot, 'src');
    const featuresPath = join(srcPath, 'features');
    const bookingPath = join(featuresPath, 'booking');
    await fs.mkdir(bookingPath, { recursive: true });

    const srcEntries = await workspace.listDir(srcPath, 0, 2);
    assert(srcEntries.length === 1 && srcEntries[0].name === 'features', 'features should be under src');
    
    const featureEntries = srcEntries[0].children || [];
    assert(featureEntries.length === 1 && featureEntries[0].name === 'booking', 'booking should be under features');

    // C. Test file creation and visibility in children list
    const fileItemPath = join(bookingPath, 'BookingScreen.tsx');
    await fs.writeFile(fileItemPath, 'export default function BookingScreen() {}');

    const bookingEntries = await workspace.listDir(bookingPath, 0, 1);
    assert(bookingEntries.some(e => e.name === 'BookingScreen.tsx'), 'BookingScreen.tsx should be visible');

    // D. Test directory renaming
    const reservationPath = join(featuresPath, 'reservations');
    await workspace.renameItem(bookingPath, reservationPath);

    const updatedFeatureEntries = await workspace.listDir(featuresPath, 0, 1);
    const updatedNames = updatedFeatureEntries.map(e => e.name);
    assert(updatedNames.includes('reservations'), 'reservations directory should exist after rename');
    assert(!updatedNames.includes('booking'), 'booking directory should no longer exist after rename');

    // E. Test directory deletion
    await workspace.deleteItem(reservationPath);
    const postDeleteEntries = await workspace.listDir(featuresPath, 0, 1);
    assert(postDeleteEntries.length === 0, 'features directory should be empty after deleting reservations subfolder');

    // F. Test deep nesting expansion: src/a/b/c/d/e/Test.tsx
    const aPath = join(srcPath, 'a');
    const bPath = join(aPath, 'b');
    const cPath = join(bPath, 'c');
    const dPath = join(cPath, 'd');
    const ePath = join(dPath, 'e');
    await fs.mkdir(ePath, { recursive: true });
    await fs.writeFile(join(ePath, 'Test.tsx'), 'export default function Test() {}');

    // Simulate expanding each directory with maxDepth = 0 (lazy loading)
    // 1. Expand src
    const srcList = await workspace.listDir(srcPath, 0, 0);
    assert(srcList.some(item => item.name === 'a'), 'src folder contains "a"');

    // 2. Expand a
    const aList = await workspace.listDir(aPath, 0, 0);
    assert(aList.some(item => item.name === 'b'), 'a folder contains "b"');

    // 3. Expand b
    const bList = await workspace.listDir(bPath, 0, 0);
    assert(bList.some(item => item.name === 'c'), 'b folder contains "c"');

    // 4. Expand c
    const cList = await workspace.listDir(cPath, 0, 0);
    assert(cList.some(item => item.name === 'd'), 'c folder contains "d"');

    // 5. Expand d
    const dList = await workspace.listDir(dPath, 0, 0);
    assert(dList.some(item => item.name === 'e'), 'd folder contains "e"');

    // 6. Expand e
    const eList = await workspace.listDir(ePath, 0, 0);
    assert(eList.some(item => item.name === 'Test.tsx'), 'e folder contains "Test.tsx"');

    console.log('  🟢 All Workspace Explorer unit tests passed.');
  } finally {
    // Clean up temp directory
    try {
      await fs.rm(tempRoot, { recursive: true, force: true });
    } catch {}
  }
}
