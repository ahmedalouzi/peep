// Run wrapper: tsx can't import the default export cleanly without a runner.
// This file imports the test suite and runs it, capturing stdout properly.
import('./build-panel.test.ts').then(m => m.default()).catch(e => {
  console.error(e);
  process.exit(1);
});
