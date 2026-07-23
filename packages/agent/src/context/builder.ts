import type { AgentContextInput } from '../types';
import { FLUTTER_SYSTEM_PROMPT } from '../prompts/flutter-system';

function truncate(text: string, max = 6000): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n... [truncated]`;
}

export function buildAgentContext(input: AgentContextInput): string {
  const parts = [
    FLUTTER_SYSTEM_PROMPT,
    '',
  ];

  if (input.projectPath) {
    parts.push(`Project root: ${input.projectPath}`);
  }

  if (input.treeSummary) {
    parts.push(`Project structure:\n${input.treeSummary}`);
  }

  if (input.pubspec) {
    parts.push('', 'pubspec.yaml:', '```yaml', truncate(input.pubspec, 3000), '```');
  }

  if (input.mainDart) {
    parts.push('', 'lib/main.dart:', '```dart', truncate(input.mainDart, 4000), '```');
  }

  if (input.openFilePath && input.openFileContent) {
    parts.push(
      '',
      `Currently open file: ${input.openFilePath}`,
      '```',
      truncate(input.openFileContent, 4000),
      '```',
    );
  }

  if (input.diagnostics && input.diagnostics.length > 0) {
    parts.push('', 'Recent diagnostics:');
    for (const d of input.diagnostics.slice(0, 12)) {
      parts.push(`- [${d.severity}] ${d.file}:${d.line} — ${d.message}`);
    }
  }
  
  if (input.previewError) {
    parts.push('', 'Active Preview/Build Compilation Error:', '```', input.previewError, '```');
  }

  parts.push('', `User request: ${input.userMessage}`);
  return parts.join('\n');
}
