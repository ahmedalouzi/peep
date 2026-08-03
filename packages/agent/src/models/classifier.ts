import type { TaskClassification } from './types';
import type { ChatMessage } from '../types';

export class TaskClassifier {
  /**
   * Extremely fast heuristic-based classifier for the current agent iteration step.
   * This determines what model should handle the current sequence of messages.
   */
  static classify(messages: ChatMessage[], isInitialPlanning: boolean): TaskClassification {
    if (isInitialPlanning) {
      return { category: 'architecture_planning', complexity: 'high' };
    }

    // Examine recent messages (last 3-5)
    const recent = messages.slice(-5);
    const recentContent = recent.map(m => m.content || '').join(' ').toLowerCase();

    // Error patterns
    if (recentContent.includes('error:') || recentContent.includes('exception') || recentContent.includes('failed to compile')) {
      if (recentContent.includes('build failed') || recentContent.includes('compile error')) {
        return { category: 'build_error_analysis', complexity: 'high' };
      }
      return { category: 'runtime_error_analysis', complexity: 'high' };
    }

    // Tool execution patterns
    const recentToolCalls = recent.filter(m => m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0);
    if (recentToolCalls.length > 0) {
      const lastTools = recentToolCalls[recentToolCalls.length - 1].tool_calls || [];
      const hasEdits = lastTools.some(t => t.function.name === 'propose_file_edit' || t.function.name === 'multi_replace_file_content');
      if (hasEdits) {
        if (lastTools.length > 2) return { category: 'multi_file_refactor', complexity: 'high' };
        return { category: 'code_generation', complexity: 'medium' };
      }

      const hasSearch = lastTools.some(t => t.function.name === 'search_files' || t.function.name === 'search_content' || t.function.name === 'list_dir');
      if (hasSearch) {
        return { category: 'code_search', complexity: 'low' };
      }
    }

    // Fallback
    return { category: 'project_exploration', complexity: 'low' };
  }
}
