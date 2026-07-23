import { promises as fs } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const files = await fs.readdir(__dirname);
  const testFiles = files.filter((f) => f.endsWith('.test.ts'));

  console.log(`\n🚀 Running Synkro Unit Tests (${testFiles.length} suites)...\n`);

  let passed = 0;
  let failed = 0;

  for (const file of testFiles) {
    console.log(`Suite: ${file}`);
    try {
      const module = await import(pathToFileURL(join(__dirname, file)).href);
      if (typeof module.default === 'function') {
        await module.default();
        console.log(`  🟢 Passed\n`);
        passed++;
      } else {
        console.log(`  ⚠️ Warning: No default export function\n`);
      }
    } catch (error) {
      console.error(`  🔴 Failed:`, error);
      failed++;
    }
  }

  console.log(`----------------------------------------`);
  console.log(`Results: ${passed} passed, ${failed} failed.`);
  console.log(`----------------------------------------\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
