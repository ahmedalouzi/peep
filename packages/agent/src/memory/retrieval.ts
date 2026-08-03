import type { AgentMemoryStore, AgentMemoryEntry } from './types';

export class MemoryRetrieval {
  constructor(private store: AgentMemoryStore) {}

  retrieveRelevantMemory(query: string): string {
    const q = query.toLowerCase();
    const relevant: AgentMemoryEntry[] = [];

    for (const entry of this.store.entries) {
      const matchKey = entry.key.toLowerCase().includes(q) || q.includes(entry.key.toLowerCase());
      const matchVal = entry.value.toLowerCase().includes(q);
      const matchCategory = q.includes(entry.category.toLowerCase());

      // If it's a very broad query, or specifically matches
      if (matchKey || matchVal || matchCategory || q.includes('architecture') || q.includes('plan')) {
        relevant.push(entry);
      } else if (entry.category === 'conventions' || entry.category === 'preferences') {
        // Always include conventions and preferences for broad behavioral alignment
        relevant.push(entry);
      }
    }

    if (relevant.length === 0) return '';

    // Deduplicate
    const unique = Array.from(new Set(relevant));

    let summary = '[AGENT MEMORY]\nStable project knowledge and conventions:\n';
    
    const byCategory = unique.reduce((acc, entry) => {
      if (!acc[entry.category]) acc[entry.category] = [];
      acc[entry.category].push(entry);
      return acc;
    }, {} as Record<string, AgentMemoryEntry[]>);

    for (const [category, entries] of Object.entries(byCategory)) {
      summary += `\n${category.toUpperCase()}:\n`;
      for (const e of entries) {
        summary += `- ${e.key}: ${e.value}\n`;
      }
    }

    return summary + '\n';
  }
}
