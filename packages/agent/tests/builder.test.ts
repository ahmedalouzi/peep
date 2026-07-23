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

  console.log('  Testing buildAgentContext successfully passed!');
}
