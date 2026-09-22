// Runner for worker-rls-identity.test.ts (called directly by tsx)
import { run } from './worker-rls-identity.test.ts';
run().then(() => {
  console.log('PASS');
  process.exit(0);
}).catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
