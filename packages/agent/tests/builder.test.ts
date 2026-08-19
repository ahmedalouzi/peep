import { buildAgentContext } from '../src/context/builder';

export default async function run() {
  console.log('  Testing buildAgentContext with previewError...');

  // Test case 1: context without error
  const contextWithoutError = buildAgentContext({
    userMessage: 'Hello world',
  });
  if (contextWithoutError.includes('Active Preview/Build Compilation Error')) {
    throw new Error('Expected context to NOT contain error block when previewError is missing');
  }

  // Test case 2: context with previewError
  const mockError = 'Target of URI does not exist: package:flutter/material.dart';
  const contextWithError = buildAgentContext({
    userMessage: 'Fix the build please',
    previewError: mockError,
  });

  if (!contextWithError.includes('Active Preview/Build Compilation Error')) {
    throw new Error('Expected context to contain the compilation error block title');
  }

  if (!contextWithError.includes(mockError)) {
    throw new Error('Expected context to include the exact mock error message');
  }

  console.log('  Testing buildAgentContext with selectedCode...');

  // Test case 3: Selection in foo.ts stores filePath = foo.ts, and retains start/end lines
  const contextWithSelection = buildAgentContext({
    userMessage: 'Fix this',
    openFilePath: 'bar.ts', // User switched tabs to bar.ts
    selectedCode: {
      text: 'const x = 42;',
      startLine: 10,
      endLine: 12,
      filePath: 'foo.ts' // Originated from foo.ts
    }
  });

  if (!contextWithSelection.includes('Selected Code (File: foo.ts, Lines: 10-12):')) {
    throw new Error('Expected context to label the selection with its own filePath (foo.ts), not the openFilePath (bar.ts)');
  }
  if (!contextWithSelection.includes('const x = 42;')) {
    throw new Error('Expected context to include the exact selected text');
  }

  // Test case 4: No selection produces no selected-code context
  const contextNoSelection = buildAgentContext({
    userMessage: 'Hello',
    openFilePath: 'foo.ts',
  });

  if (contextNoSelection.includes('Selected Code')) {
    throw new Error('Expected no Selected Code block when selectedCode is undefined');
  }

  console.log('  Testing buildAgentContext successfully passed!');
}
