import { Pool } from 'pg';
import { db } from './src/models/db';
import { AuthenticationRouter } from './src/models/auth-router';
import { AuthService } from './src/models/auth';
import { ServerUsageStore } from './src/models/usage-store';
import { ServerBudgetGuard } from './src/models/budget-guard';
import { randomUUID } from 'crypto';

const DB_URL = 'postgres://postgres:postgres@localhost:5432/peep';
process.env.DATABASE_URL = DB_URL;
const pool = new Pool({ connectionString: DB_URL });

async function run() {
  console.log("=== 1. SCHEMA CHECK ===");
  const tables = ['users', 'sessions', 'usage_records', 'rate_limits', 'budgets', 'budget_limits', 'user_budgets', 'budget'];
  
  for (const table of tables) {
    const res = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position;
    `, [table]);
    if (res.rows.length > 0) {
      console.log(`\nTable: ${table}`);
      console.table(res.rows);
    }
  }

  console.log("\n=== 2. AUTH FUNCTIONAL CHECK ===");
  const authRouter = new AuthenticationRouter();
  const testEmail = `test_${Date.now()}@example.com`;
  
  console.log(`Creating user with email: ${testEmail}`);
  const session = await authRouter.signup(testEmail, 'testpassword123');
  console.log('User created and session generated:', session);

  console.log('Validating session...');
  const validatedUserId = await authRouter.validateSession(session.sessionToken);
  console.log(`Validated User ID: ${validatedUserId.userId} (Expected: ${session.userId})`);

  try {
    await authRouter.validateSession('invalid_token_123');
    console.log('Invalid token check: FAILED (did not throw)');
  } catch (err: any) {
    console.log(`Invalid token check: PASSED (threw ${err.message})`);
  }

  console.log("\n=== 3. USAGE/TOKEN ACCOUNTING CHECK ===");
  const usageStore = new ServerUsageStore();
  
  // Simulate usage
  await usageStore.recordUsage({
    userId: session.userId,
    requestId: 'test-req-1',
    modelTier: 'fast',
    resolvedModel: 'gemini-1.5-flash',
    inputTokens: 1500,
    outputTokens: 500,
    totalTokens: 2000,
    estimatedCost: 0.002,
    status: 'success'
  });

  const usageRes = await pool.query(`
    SELECT * FROM usage_records WHERE user_id = $1;
  `, [session.userId]);
  console.log('Usage records for user:', usageRes.rows);

  console.log("\n=== 4. BUDGET/LIMITS CHECK ===");
  const budgetGuard = new ServerBudgetGuard();
  
  // Need to figure out how budget check works and check exact limit.
  // First, check budget.
  try {
    const budgetStatus = await budgetGuard.checkBudget(session.userId);
    console.log('Initial Budget Status:', budgetStatus);
  } catch(err) {
    console.log('Initial Budget Status Error:', err);
  }

  // Insert a lot of usage to exceed limit
  console.log('Inserting $0.10 usage (to trigger limits)...');
  await usageStore.recordUsage({
    userId: session.userId,
    requestId: 'test-req-2',
    modelTier: 'smart',
    resolvedModel: 'gemini-1.5-pro',
    inputTokens: 100000,
    outputTokens: 50000,
    totalTokens: 150000,
    estimatedCost: 0.10, // assuming daily limit is $0.01 for free tier
    status: 'success'
  });

  try {
    await budgetGuard.checkBudget(session.userId);
    console.log('Budget Guard after large usage: ALLOWED (FAIL)');
  } catch (err: any) {
    console.log('Budget Guard after large usage: REJECTED (PASS) ->', err.message);
  }

  console.log("\n=== 5. RATE LIMITING CHECK ===");
  // We need to inspect RateLimiter or constants to output limits.
  console.log("We will skip the programmatic rate limiter check because it is in a different package.");


  await pool.end();
}

run().catch(console.error);
