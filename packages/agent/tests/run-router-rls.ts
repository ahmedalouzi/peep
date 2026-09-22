// Runner for router-rls-identity.test.ts (called directly by tsx)
import { run } from './router-rls-identity.test.ts';

run().catch(err => {
  console.error(err);
  process.exit(1);
});
