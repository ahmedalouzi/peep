export interface AgentMemoryEntry {
  id: string;
  category: 'architecture' | 'conventions' | 'design' | 'preferences' | 'decisions';
  key: string;
  value: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentMemoryStore {
  version: number;
  entries: AgentMemoryEntry[];
}
