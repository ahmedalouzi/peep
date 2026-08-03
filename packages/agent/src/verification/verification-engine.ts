import { ProjectIndexer } from '../intelligence/indexer';
import * as path from 'path';

export interface VerificationScope {
  filesToVerify: string[];
  typecheckCommand: string;
  testCommand?: string;
  lintCommand: string;
}

export class VerificationEngine {
  static getTargetedVerificationScope(
    modifiedFiles: string[],
    indexer: ProjectIndexer
  ): VerificationScope {
    const graphBuilder = indexer.getDependencyGraphBuilder();
    
    // Rank 1: Directly modified files
    // Rank 2: Direct dependents (impact radius 1)
    // Rank 3: Broader impact radius (depth 2) if core shared infra is modified
    let depth = 1;
    if (modifiedFiles.some(f => f.includes('/core/') || f.includes('/shared/') || f.includes('utils'))) {
      depth = 2; // Escalate broader impact
    }

    const impactRadius = graphBuilder.getImpactRadius(modifiedFiles, depth);
    const filesToVerify = Array.from(new Set([...modifiedFiles, ...impactRadius]));

    const fileListStr = filesToVerify.join(' ');
    
    // Preferred test command based on indexing
    let testCommand = undefined;
    if (indexer.getIndex().files.some(f => f.endsWith('.test.ts') || f.endsWith('.test.tsx') || f.endsWith('.spec.ts'))) {
      const filesWithTests = filesToVerify.filter(f => {
        const parsed = path.parse(f);
        const testFileName1 = `${parsed.name}.test${parsed.ext}`;
        const testFileName2 = `${parsed.name}.spec${parsed.ext}`;
        return indexer.getIndex().files.some(idxF => idxF.endsWith(testFileName1) || idxF.endsWith(testFileName2));
      });
      if (filesWithTests.length > 0) {
        testCommand = `npm test -- ${filesWithTests.map(f => path.parse(f).name).join(' ')}`;
      }
    }

    return {
      filesToVerify,
      typecheckCommand: 'npm run typecheck', 
      lintCommand: filesToVerify.length > 0 ? `npx eslint ${fileListStr}` : 'npm run lint',
      testCommand
    };
  }

  static isStructuralUIValid(htmlContent: string, requiredTestIds: string[]): boolean {
    const lowerHtml = htmlContent.toLowerCase();
    for (const id of requiredTestIds) {
      if (!lowerHtml.includes(`data-testid="${id.toLowerCase()}"`) && 
          !lowerHtml.includes(`aria-label="${id.toLowerCase()}"`) &&
          !lowerHtml.includes(id.toLowerCase())) {
        return false; // Structural element missing
      }
    }
    return true;
  }
}
