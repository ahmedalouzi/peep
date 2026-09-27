// packages/cloud-build/tests/test-runner.ts
// Custom test runner following the agent package pattern (tsx, no Jest).

import { promises as fs } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { config } from 'dotenv';
import { Pool } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, '../../../.env') });
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL_WORKER = process.env.DATABASE_URL_WORKER
  ?? 'postgres://testuser:testpass@localhost:5432/peep_test';
process.env.DATABASE_URL_API = process.env.DATABASE_URL_API
  ?? 'postgres://testuser:testpass@localhost:5432/peep_test';

const args = process.argv.slice(2);
const unitOnly = args.includes('--unit-only');

// DB-dependent test files (require Postgres to be running)
const DB_DEPENDENT = new Set([
  'job-store.test.ts',
  'reconciler.test.ts',
  'worker-crash-recovery.test.ts',
]);

async function isDbAvailable(): Promise<boolean> {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL_WORKER,
    connectionTimeoutMillis: 2000,
  });
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await pool.end().catch(() => {});
  }
}

async function main() {
  const unitDir  = join(__dirname, 'unit');
  const advDir   = join(__dirname, 'adversarial');

  const unitFiles = (await fs.readdir(unitDir).catch(() => []))
    .filter((f) => f.endsWith('.test.ts'))
    .map((f) => join(unitDir, f));

  const advFiles = unitOnly
    ? []
    : (await fs.readdir(advDir).catch(() => []))
        .filter((f) => f.endsWith('.test.ts'))
        .map((f) => join(advDir, f));

  const allFiles = [...unitFiles, ...advFiles];

  console.log(`\n🚀 cloud-build tests (${allFiles.length} suites${unitOnly ? ' — unit only' : ''})...\n`);

  const dbOnline = await isDbAvailable();
  if (!dbOnline) {
    console.warn('  ⚠️  Postgres unavailable — DB-dependent suites will be skipped.\n');
  }

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const file of allFiles) {
    const basename = file.split(/[\\/]/).pop()!;
    const label = file.replace(__dirname, '').replace(/\\/g, '/');
    console.log(`Suite: ${label}`);

    // Skip DB-dependent tests when Postgres is offline
    if (!dbOnline && DB_DEPENDENT.has(basename)) {
      console.warn(`  🟡 Skipped (Postgres required but offline)\n`);
      skipped++;
      continue;
    }

    try {
      const mod = await import(pathToFileURL(file).href);
      if (typeof mod.default === 'function') {
        await mod.default();
        console.log('  🟢 Passed\n');
        passed++;
      } else {
        console.warn('  ⚠️ No default export function\n');
      }
    } catch (err: any) {
      console.error('  🔴 Failed:', err?.message ?? err, '\n');
      failed++;
    }
  }

  console.log('──────────────────────────────────────');
  console.log(`Results: ${passed} passed, ${failed} failed, ${skipped} skipped.`);
  console.log('──────────────────────────────────────\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
