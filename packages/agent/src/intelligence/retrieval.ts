import type { ProjectIndex } from './types';
import { isSecretFile } from './dependency-graph';
import * as fs from 'fs';
import * as path from 'path';

export interface RetrievalDiagnostic {
  file: string;
  reason: string;
  relevanceScore: number;
}

export interface RetrievalResult {
  summary: string;
  filesRead: string[];
  diagnostic: RetrievalDiagnostic[];
  contextBudgetUsed: number;
}

export class ProjectRetrieval {
  constructor(private index: ProjectIndex, private projectPath: string) {}

  retrieveRelevantContext(query: string, maxChars = 200000): RetrievalResult {
    const q = query.toLowerCase();
    
    const diagnostics: Record<string, RetrievalDiagnostic> = {};
    const addDiagnostic = (file: string, reason: string, score: number) => {
      if (isSecretFile(file)) return;
      if (!diagnostics[file] || diagnostics[file].relevanceScore < score) {
        diagnostics[file] = { file, reason, relevanceScore: score };
      }
    };

    // 1. Keyword matching
    if (q.includes('nav') || q.includes('route') || q.includes('screen') || q.includes('page')) {
      for (const route of this.index.routes) addDiagnostic(route.file, 'Route/Navigation Match', 90);
    }

    for (const screen of this.index.screens) {
      if (q.includes(screen.name.toLowerCase()) || q.includes(screen.file.toLowerCase())) {
        addDiagnostic(screen.file, `Screen Name Match: ${screen.name}`, 100);
      }
    }

    for (const component of this.index.components) {
      if (q.includes(component.name.toLowerCase())) {
        addDiagnostic(component.file, `Component Name Match: ${component.name}`, 80);
      }
    }

    if (q.includes('api') || q.includes('service') || q.includes('backend') || q.includes('data')) {
      for (const service of this.index.services) addDiagnostic(service.file, 'Service/API Match', 85);
    }

    for (const file of this.index.files) {
      if (file.toLowerCase().includes(q)) {
        addDiagnostic(file, `File Name Match: ${file}`, 60);
      }
    }

    if (q.includes('theme') || q.includes('color') || q.includes('style') || q.includes('design')) {
      for (const file of this.index.theme.files) addDiagnostic(file, 'Theme/Style Match', 70);
    }

    if (q.includes('state') || q.includes('store') || q.includes('provider') || q.includes('riverpod') || q.includes('redux')) {
      for (const file of this.index.stateManagement.files) addDiagnostic(file, 'State Management Match', 95);
    }

    // Default files if nothing matched explicitly
    if (Object.keys(diagnostics).length === 0) {
      this.index.entryPoints.slice(0, 3).forEach(f => addDiagnostic(f, 'Fallback: Entry point', 50));
      this.index.screens.slice(0, 2).forEach(s => addDiagnostic(s.file, 'Fallback: Top screen', 40));
    }

    // 2. Expand using Dependency Graph
    if (this.index.graph) {
      const initialFiles = Object.keys(diagnostics);
      for (const file of initialFiles) {
        const score = diagnostics[file].relevanceScore;
        
        // Add imports (dependencies)
        const imports = this.index.graph.imports[file] || [];
        for (const imp of imports) {
          addDiagnostic(imp, `Imported by ${file}`, score - 15);
        }
        
        // Add dependents (files that use this file)
        const dependents = this.index.graph.dependents[file] || [];
        for (const dep of dependents) {
          addDiagnostic(dep, `Used by ${dep}`, score - 20);
        }
      }
    }

    // 3. Sort by relevance
    const sortedDiagnostics = Object.values(diagnostics)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    // 4. Build Context String & Read Files within Budget
    let summary = '[PROJECT INTELLIGENCE RETRIEVAL]\n';
    summary += `Framework: ${this.index.framework}\n`;
    if (this.index.stateManagement.type !== 'unknown') {
      summary += `State Management: ${this.index.stateManagement.type}\n`;
    }

    let budgetUsed = summary.length;
    const filesRead: string[] = [];

    for (const diag of sortedDiagnostics) {
      if (budgetUsed >= maxChars) break;

      const fullPath = path.join(this.projectPath, diag.file);
      if (!fs.existsSync(fullPath)) continue;

      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const fileHeader = `\n\n--- FILE: ${diag.file} (Relevance: ${diag.relevanceScore}, Reason: ${diag.reason}) ---\n`;
        
        const charsAvailable = maxChars - budgetUsed;
        const totalAddition = fileHeader.length + content.length;

        if (totalAddition <= charsAvailable) {
          summary += fileHeader + content;
          budgetUsed += totalAddition;
          filesRead.push(diag.file);
        } else if (charsAvailable > 500) {
          // Truncate file if it's large and we're at the end of the budget
          const truncatedContent = content.substring(0, charsAvailable - fileHeader.length - 100) + '\n...[TRUNCATED DUE TO CONTEXT LIMIT]';
          summary += fileHeader + truncatedContent;
          budgetUsed += fileHeader.length + truncatedContent.length;
          filesRead.push(diag.file);
          break;
        }
      } catch (e) {
        // Skip on read error
      }
    }

    return {
      summary,
      filesRead,
      diagnostic: sortedDiagnostics,
      contextBudgetUsed: budgetUsed
    };
  }
}
