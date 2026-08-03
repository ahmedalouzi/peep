import { DesignReasoner } from '../src/design/design-reasoner';
import { DesignReviewer } from '../src/design/design-reviewer';
import { loadDesignManifest, saveDesignManifest } from '../src/design/design-retrieval';
import { saveAgentTaskState, loadAgentTaskState } from '../src/design/task-state';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, rm } from 'node:fs/promises';

export default async function runTests() {
  console.log('  Running Design Intelligence unit tests...');

  // 1. Test Design DNA generation
  const restaurantManifest = DesignReasoner.inferDesignDNA("Build me a restaurant app.");
  if (restaurantManifest.colors.primary !== "#c2410c") {
    throw new Error(`Expected primary orange for restaurant, got: ${restaurantManifest.colors.primary}`);
  }

  const luxuryManifest = DesignReasoner.inferDesignDNA("Build a luxury concierge service.");
  if (luxuryManifest.colors.primary !== "#d97706") {
    throw new Error(`Expected gold primary for luxury, got: ${luxuryManifest.colors.primary}`);
  }

  // 2. Test Manifest Save & Load
  const tmpDir = await mkdtemp(join(tmpdir(), 'peep-design-test-'));
  try {
    await saveDesignManifest(tmpDir, restaurantManifest);
    const loaded = await loadDesignManifest(tmpDir);
    if (!loaded) {
      throw new Error('Failed to load design manifest.');
    }
    if (loaded.brandPersonality !== restaurantManifest.brandPersonality) {
      throw new Error('Loaded brand personality mismatch.');
    }
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }

  // 3. Test Design Reviewer
  const validAppCode = `
import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';

export default function App() {
  return (
    <View style={{ padding: 16 }}>
      <ActivityIndicator size="small" />
      <Text>Loaded successfully!</Text>
      <Text>Error handler: Something went wrong.</Text>
      <Text>Empty state: No items found.</Text>
    </View>
  );
}
`;
  const validFaults = DesignReviewer.evaluateUI(validAppCode, 'App.tsx', restaurantManifest);
  if (validFaults.length > 0) {
    throw new Error(`Expected 0 faults for valid code, got: ${validFaults.length}`);
  }

  const invalidAppCode = `
import React from 'react';
import { View, Text } from 'react-native';

export default function App() {
  return (
    <View style={{ padding: 19, backgroundColor: '#998877' }}>
      <Text>Generic text</Text>
    </View>
  );
}
`;
  const invalidFaults = DesignReviewer.evaluateUI(invalidAppCode, 'App.tsx', restaurantManifest);
  const colorFault = invalidFaults.find(f => f.category === 'color_consistency');
  const spaceFault = invalidFaults.find(f => f.category === 'spacing_scale');
  const loadingFault = invalidFaults.find(f => f.category === 'missing_states');

  if (!colorFault) {
    throw new Error('Expected hardcoded color fault to be detected.');
  }
  if (!spaceFault) {
    throw new Error('Expected spacing scale violation fault to be detected.');
  }
  if (!loadingFault) {
    throw new Error('Expected missing states fault to be detected.');
  }

  // 4. Test Task State Persistence
  const stateDir = await mkdtemp(join(tmpdir(), 'peep-state-test-'));
  try {
    const initialState = {
      taskId: 'test-task-123',
      currentState: 'UNDERSTAND' as const,
      modifiedFiles: ['App.tsx'],
      retryCount: 0,
      lastUpdatedAt: new Date().toISOString()
    };
    await saveAgentTaskState(stateDir, initialState);
    const loaded = await loadAgentTaskState(stateDir);
    if (!loaded) {
      throw new Error('Failed to load task state.');
    }
    if (loaded.currentState !== 'UNDERSTAND') {
      throw new Error('TaskState currentState mismatch.');
    }
  } finally {
    await rm(stateDir, { recursive: true, force: true });
  }

  console.log('  🟢 All Design Intelligence & Task State unit tests passed.');
}
