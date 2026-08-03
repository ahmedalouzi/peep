import { ProjectIndexer } from '../intelligence/indexer';
import * as path from 'path';

export class TestGenerator {
  static shouldGenerateTest(
    filePath: string,
    fileContent: string,
    indexer: ProjectIndexer,
    userRequestedTests: boolean
  ): boolean {
    if (userRequestedTests) return true;

    // Phase 4 Test Generation Policy:
    // Generate a smoke test only when:
    // - the task is behaviorally testable,
    // - no suitable existing test exists,
    // - the project has an established test framework,
    // - generating the test follows existing project conventions.
    
    const hasTestFramework = indexer.getIndex().files.some(f => f.endsWith('.test.ts') || f.endsWith('.test.tsx') || f.endsWith('.spec.ts'));
    if (!hasTestFramework) return false;

    // Check if test already exists
    const parsed = path.parse(filePath);
    const testFileName1 = `${parsed.name}.test${parsed.ext}`;
    const testFileName2 = `${parsed.name}.spec${parsed.ext}`;
    if (indexer.getIndex().files.some(f => f.endsWith(testFileName1) || f.endsWith(testFileName2))) {
      return false; // Test exists
    }

    // Only generate for components/services, not simple types or config
    if (filePath.includes('/components/') || filePath.includes('/services/') || fileContent.includes('export function') || fileContent.includes('export const') || fileContent.includes('export default')) {
      return true;
    }

    return false;
  }
}
