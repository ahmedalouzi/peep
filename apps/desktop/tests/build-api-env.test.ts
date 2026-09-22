import assert from 'node:assert/strict';
import { shouldUseRealBuildApi } from '../src/renderer/src/services/build-api.ts';

function run() {
  console.log('--- Testing build-api env resolution ---');
  
  // 1. Unset evaluates to false
  assert.equal(shouldUseRealBuildApi(undefined), false, 'Unset should evaluate to false');
  
  // 2. Truthy string regression
  assert.equal(shouldUseRealBuildApi('false'), false, '"false" string MUST evaluate to false');
  
  // 3. True string
  assert.equal(shouldUseRealBuildApi('true'), true, '"true" string should evaluate to true');

  console.log('✅ Env resolution logic verified against genuine imported function.');
}

run();
