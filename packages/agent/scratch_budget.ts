import { randomUUID } from 'crypto';
import { db } from './src/models/db';
import { ServerBudgetGuard } from './src/models/budget-guard';
import { ServerUsageStore } from './src/models/usage-store';

async function verify() {
  const userId = randomUUID();
  console.log(`\n--- Budget Guard Direct Postgres Verification ---`);
  console.log(`User ID: ${userId}`);

  // 1. Seed user
  await db.query("INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)", [userId, `test-${userId}@example.com`, 'hash']);

  const store = new ServerUsageStore();
  const guard = new ServerBudgetGuard();

  // 2. Insert usage records exceeding the daily limit (Pro limit is $0.50)
  console.log('Inserting $0.495 usage...');
  await store.recordUsage({
    userId,
    requestId: randomUUID(),
    modelTier: 'premium',
    resolvedModel: 'claude-3-5-sonnet',
    inputTokens: 100,
    outputTokens: 200,
    totalTokens: 300,
    estimatedCost: 0.495,
    status: 'success'
  });

  console.log('Checking budget for $0.01 request (total: $0.505, limit: $0.50)...');
  
  await guard.acquireLock(userId);
  try {
    await guard.checkBudget(userId, 'pro', 0.01);
    console.log('❌ FAIL: Request was ALLOWED despite exceeding daily budget!');
  } catch (err: any) {
    if (err.code === 'BUDGET_EXCEEDED') {
      console.log('✅ PASS: Request was REJECTED as expected:', err.message);
    } else {
      console.log('❓ UNKNOWN ERROR:', err);
    }
  } finally {
    guard.releaseLock(userId);
  }

  process.exit(0);
}

verify().catch(e => { console.error('Error:', e); process.exit(1); });
