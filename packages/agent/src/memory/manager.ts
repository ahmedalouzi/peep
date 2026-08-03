import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type { AgentMemoryStore, AgentMemoryEntry } from './types';

export class MemoryManager {
  private store: AgentMemoryStore;
  private memoryPath: string;

  constructor(projectPath: string) {
    this.memoryPath = path.join(projectPath, '.peep', 'agent-memory.json');
    this.store = { version: 1, entries: [] };
  }

  async loadMemory(): Promise<void> {
    try {
      if (existsSync(this.memoryPath)) {
        const data = await fs.readFile(this.memoryPath, 'utf-8');
        this.store = JSON.parse(data);
      }
    } catch {}
  }

  async saveMemory(): Promise<void> {
    try {
      const peepDir = path.dirname(this.memoryPath);
      if (!existsSync(peepDir)) {
        await fs.mkdir(peepDir, { recursive: true });
      }
      await fs.writeFile(this.memoryPath, JSON.stringify(this.store, null, 2));
    } catch (e) {
      console.error('Failed to save Agent Memory', e);
    }
  }

  getStore(): AgentMemoryStore {
    return this.store;
  }

  async addMemory(category: AgentMemoryEntry['category'], key: string, value: string): Promise<string> {
    const existingIndex = this.store.entries.findIndex(e => e.category === category && e.key === key);
    const now = new Date().toISOString();
    
    if (existingIndex >= 0) {
      this.store.entries[existingIndex].value = value;
      this.store.entries[existingIndex].updatedAt = now;
      await this.saveMemory();
      return `Memory updated: [${category}] ${key} = ${value}`;
    }

    const entry: AgentMemoryEntry = {
      id: randomUUID(),
      category,
      key,
      value,
      createdAt: now,
      updatedAt: now,
    };
    
    this.store.entries.push(entry);
    await this.saveMemory();
    return `Memory added: [${category}] ${key} = ${value}`;
  }

  async updateMemory(idOrKey: string, value: string): Promise<string> {
    const entry = this.store.entries.find(e => e.id === idOrKey || e.key === idOrKey);
    if (!entry) return `Memory not found for: ${idOrKey}`;
    
    entry.value = value;
    entry.updatedAt = new Date().toISOString();
    await this.saveMemory();
    return `Memory updated: [${entry.category}] ${entry.key} = ${value}`;
  }

  async removeMemory(idOrKey: string): Promise<string> {
    const initialLength = this.store.entries.length;
    this.store.entries = this.store.entries.filter(e => e.id !== idOrKey && e.key !== idOrKey);
    
    if (this.store.entries.length < initialLength) {
      await this.saveMemory();
      return `Memory removed: ${idOrKey}`;
    }
    return `Memory not found: ${idOrKey}`;
  }
}
