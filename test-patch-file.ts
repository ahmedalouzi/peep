import * as fs from 'node:fs/promises';
import * as path from 'node:path';

// Replicate the patch_file logic from agent-service.ts
async function executePatchFile(
  workspaceRoot: string,
  args: any,
): Promise<string> {
  if (!args.path || typeof args.oldText !== 'string' || typeof args.newText !== 'string') {
    return 'Error: path, oldText, and newText are required.';
  }

  // resolvePath logic
  const cleaned = String(args.path).replace(/^\.\//, '');
  const resolved = path.isAbsolute(cleaned) ? path.normalize(cleaned) : path.normalize(path.join(workspaceRoot, cleaned));
  if (!resolved.startsWith(path.normalize(workspaceRoot))) {
    return 'Error: Path is outside project workspace';
  }
  
  let originalContent = '';
  try {
    originalContent = await fs.readFile(resolved, 'utf-8');
  } catch {
    return `Error: File not found or unreadable: ${args.path}`;
  }

  const oldText = String(args.oldText);
  const newText = String(args.newText);

  if (oldText === '') {
    return 'Error: oldText cannot be empty.';
  }

  const occurrences = originalContent.split(oldText).length - 1;

  if (occurrences === 0) {
    return `Error: oldText not found in ${args.path}. Ensure the exact text, including whitespace and line endings, matches.`;
  }

  if (occurrences > 1) {
    return `Error: oldText occurs ${occurrences} times in ${args.path}. Please provide a more unique block of text to replace.`;
  }

  const newContent = originalContent.replace(oldText, newText);

  try {
    await fs.writeFile(resolved, newContent, 'utf-8');
    return `PATCH SUCCESS: Successfully patched ${args.path}.`;
  } catch (err: any) {
    return `Error: Failed to write patched file: ${err.message}`;
  }
}

async function runTests() {
  const root = path.resolve(__dirname, 'test_workspace');
  await fs.mkdir(root, { recursive: true });

  const filePath = path.join(root, 'target.ts');
  const initialContent = `function hello() {\n  console.log('world');\n}\n\nfunction duplicate() {\n  console.log('world');\n}\n`;

  try {
    // 1. Successful exact replacement
    await fs.writeFile(filePath, initialContent);
    let res = await executePatchFile(root, {
      path: 'target.ts',
      oldText: "console.log('world');",
      newText: "console.log('hello');"
    });
    // This should fail due to multiple matches! Wait, the oldText appears twice.
    if (!res.includes('Error: oldText occurs 2 times')) throw new Error('Failed test 3: multiple matches');

    // Retrying with unique text
    res = await executePatchFile(root, {
      path: 'target.ts',
      oldText: "function hello() {\n  console.log('world');\n}",
      newText: "function hello() {\n  console.log('patched');\n}"
    });
    if (!res.includes('PATCH SUCCESS')) throw new Error('Failed test 1: success');
    
    const patchedContent = await fs.readFile(filePath, 'utf-8');
    if (!patchedContent.includes('patched')) throw new Error('Failed test 1: content not patched');
    if (!patchedContent.includes('duplicate()')) throw new Error('Failed test 8: unrelated content changed');

    // 2. Old text not found
    res = await executePatchFile(root, { path: 'target.ts', oldText: 'missing', newText: 'found' });
    if (!res.includes('Error: oldText not found')) throw new Error('Failed test 2: old text not found');

    // 4. Empty oldText
    res = await executePatchFile(root, { path: 'target.ts', oldText: '', newText: 'found' });
    if (!res.includes('Error: oldText cannot be empty')) throw new Error('Failed test 4: empty oldText');

    // 5. File not found
    res = await executePatchFile(root, { path: 'missing.ts', oldText: 'a', newText: 'b' });
    if (!res.includes('Error: File not found')) throw new Error('Failed test 5: file not found');

    // 6. Path traversal
    res = await executePatchFile(root, { path: '../out.ts', oldText: 'a', newText: 'b' });
    if (!res.includes('Error: Path is outside project workspace')) throw new Error('Failed test 6: path traversal');

    // 7. Absolute path outside
    res = await executePatchFile(root, { path: 'C:\\Windows\\System32\\cmd.exe', oldText: 'a', newText: 'b' });
    if (!res.includes('Error: Path is outside project workspace')) throw new Error('Failed test 7: absolute path');

    console.log('✅ All Task 4 patch_file tests passed!');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

runTests().catch(console.error);
