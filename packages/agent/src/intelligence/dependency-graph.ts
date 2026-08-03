import * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';
import type { DependencyGraph } from '@peep/shared';

const SECRET_PATTERNS = [
  /\.env(\..*)?$/i,
  /\.pem$/i,
  /\.key$/i,
  /id_rsa/i,
  /credentials\.json$/i,
  /secrets?\./i,
  /token/i,
  /password/i,
];

export function isSecretFile(filePath: string): boolean {
  const base = path.basename(filePath);
  return SECRET_PATTERNS.some((pattern) => pattern.test(base));
}

export class DependencyGraphBuilder {
  private graph: DependencyGraph;
  private projectPath: string;

  constructor(projectPath: string, existingGraph?: DependencyGraph) {
    this.projectPath = projectPath;
    this.graph = existingGraph || {
      imports: {},
      exports: {},
      dependents: {},
      fileHashes: {},
      unresolved: {},
      lastIndexedAt: new Date().toISOString(),
    };
  }

  getGraph(): DependencyGraph {
    return this.graph;
  }

  parseFile(filePath: string, content: string): { imports: string[]; exports: string[] } {
    if (isSecretFile(filePath)) {
      return { imports: [], exports: [] };
    }

    try {
      return this.parseWithAST(filePath, content);
    } catch {
      // Fallback to regex if AST parsing fails
      return this.parseWithRegex(content);
    }
  }

  private parseWithAST(filePath: string, content: string): { imports: string[]; exports: string[] } {
    const importedPaths: string[] = [];
    const exportedSymbols: string[] = [];

    const scriptKind = filePath.endsWith('.tsx')
      ? ts.ScriptKind.TSX
      : filePath.endsWith('.jsx')
      ? ts.ScriptKind.JSX
      : filePath.endsWith('.ts')
      ? ts.ScriptKind.TS
      : ts.ScriptKind.JS;

    const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, scriptKind);

    const visit = (node: ts.Node) => {
      // ES Import
      if (ts.isImportDeclaration(node)) {
        if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
          importedPaths.push(node.moduleSpecifier.text);
        }
      }
      // Export Declaration (export { foo } from './bar' or export const foo = ...)
      else if (ts.isExportDeclaration(node)) {
        if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
          importedPaths.push(node.moduleSpecifier.text);
        }
        if (node.exportClause && ts.isNamedExports(node.exportClause)) {
          for (const specifier of node.exportClause.elements) {
            exportedSymbols.push(specifier.name.text);
          }
        }
      }
      // Export Function / Class / Const
      else if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) {
        if (node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
          if (node.name?.text) exportedSymbols.push(node.name.text);
        }
      } else if (ts.isVariableStatement(node)) {
        if (node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
          for (const declaration of node.declarationList.declarations) {
            if (ts.isIdentifier(declaration.name)) {
              exportedSymbols.push(declaration.name.text);
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return { imports: Array.from(new Set(importedPaths)), exports: Array.from(new Set(exportedSymbols)) };
  }

  private parseWithRegex(content: string): { imports: string[]; exports: string[] } {
    const imports: string[] = [];
    const exports: string[] = [];

    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    const exportRegex = /export\s+(?:const|function|class|type|interface|var|let)\s+([a-zA-Z0-9_$]+)/g;
    while ((match = exportRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }

    return { imports: Array.from(new Set(imports)), exports: Array.from(new Set(exports)) };
  }

  resolveImportPath(fromFile: string, importSpecifier: string): string | null {
    // Skip built-in / third-party npm packages unless relative or aliased
    if (!importSpecifier.startsWith('.') && !importSpecifier.startsWith('@/') && !importSpecifier.startsWith('~/')) {
      return null;
    }

    let resolvedDir = path.dirname(fromFile);
    let target = importSpecifier;

    // Handle TS Path Aliases (@/ or ~/)
    if (target.startsWith('@/') || target.startsWith('~/')) {
      resolvedDir = path.join(this.projectPath, 'src');
      target = target.substring(2);
    }

    const rawPath = path.resolve(resolvedDir, target);

    const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.d.ts', '/index.ts', '/index.tsx', '/index.js'];
    for (const ext of extensions) {
      const candidate = rawPath + ext;
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return path.relative(this.projectPath, candidate).replace(/\\/g, '/');
      }
    }

    return null; // Unresolved import
  }

  updateFileGraph(filePath: string, content: string): void {
    const relFile = path.relative(this.projectPath, filePath).replace(/\\/g, '/');
    if (isSecretFile(relFile)) return;

    const { imports, exports } = this.parseFile(filePath, content);
    const resolvedImports: string[] = [];
    const unresolvedImports: string[] = [];

    for (const imp of imports) {
      const resolved = this.resolveImportPath(filePath, imp);
      if (resolved) {
        resolvedImports.push(resolved);
      } else if (imp.startsWith('.')) {
        unresolvedImports.push(imp);
      }
    }

    this.graph.imports[relFile] = resolvedImports;
    this.graph.exports[relFile] = exports;
    this.graph.unresolved[relFile] = unresolvedImports;

    // Rebuild reverse dependency map
    this.rebuildDependents();
  }

  removeFile(filePath: string): void {
    const relFile = path.relative(this.projectPath, filePath).replace(/\\/g, '/');
    delete this.graph.imports[relFile];
    delete this.graph.exports[relFile];
    delete this.graph.unresolved[relFile];
    delete this.graph.fileHashes[relFile];
    this.rebuildDependents();
  }

  private rebuildDependents(): void {
    const dependents: Record<string, string[]> = {};
    for (const [file, importList] of Object.entries(this.graph.imports)) {
      for (const importedFile of importList) {
        if (!dependents[importedFile]) dependents[importedFile] = [];
        if (!dependents[importedFile].includes(file)) {
          dependents[importedFile].push(file);
        }
      }
    }
    this.graph.dependents = dependents;
  }

  getImpactRadius(targetFiles: string[], maxDepth = 2): string[] {
    const impact = new Set<string>();
    const queue: Array<{ file: string; depth: number }> = targetFiles.map((f) => ({
      file: f.replace(/\\/g, '/'),
      depth: 0,
    }));
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current.file)) continue;
      visited.add(current.file);

      if (current.depth > 0) {
        impact.add(current.file);
      }

      if (current.depth < maxDepth) {
        const directDependents = this.graph.dependents[current.file] || [];
        for (const dep of directDependents) {
          if (!visited.has(dep)) {
            queue.push({ file: dep, depth: current.depth + 1 });
          }
        }
      }
    }

    return Array.from(impact);
  }
}
