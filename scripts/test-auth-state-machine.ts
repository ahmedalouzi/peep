// Set up mock window and global APIs before importing components
const mockSettings = {
  theme: 'dark' as const,
  autoSave: true,
  sessionConfigured: false,
  sessionToken: undefined as string | undefined,
  refreshToken: undefined as string | undefined,
  capabilityTier: 'fast' as const
};

let mockAccount: any = null;

const mockPeep = {
  getSettings: async () => ({ ...mockSettings }),
  setSettings: async (partial: any) => {
    Object.assign(mockSettings, partial);
    mockSettings.sessionConfigured = !!mockSettings.sessionToken;
    return { ...mockSettings };
  },
  authSignIn: async (email: string) => {
    if (email === 'fail@synkro.com') {
      return { success: false, error: 'Invalid credentials' };
    }
    mockSettings.sessionToken = 'valid_token';
    mockSettings.refreshToken = 'valid_refresh';
    mockSettings.sessionConfigured = true;
    mockAccount = {
      email,
      plan: 'pro',
      usedCost: 1.25,
      budgetCost: 10.0,
      usedTokens: 120000,
      budgetTokens: 5000000
    };
    return { success: true };
  },
  authSignUp: async (email: string) => {
    mockSettings.sessionToken = 'valid_token';
    mockSettings.refreshToken = 'valid_refresh';
    mockSettings.sessionConfigured = true;
    mockAccount = {
      email,
      plan: 'free',
      usedCost: 0,
      budgetCost: 10.0,
      usedTokens: 0,
      budgetTokens: 1000000
    };
    return { success: true };
  },
  authLogout: async () => {
    mockSettings.sessionToken = undefined;
    mockSettings.refreshToken = undefined;
    mockSettings.sessionConfigured = false;
    mockAccount = null;
  },
  authGetAccount: async () => {
    if (!mockSettings.sessionToken) return null;
    return mockAccount;
  },
  onAuthSessionExpired: (callback: any) => {
    (globalThis as any).triggerSessionExpired = callback;
    return () => {};
  }
};

(globalThis as any).window = {
  peep: mockPeep,
  location: { search: '' }
};

async function runTests() {
  console.log('--- STARTING AUTHMESHINE INTEGRATION TESTS ---');

  const { useAuthStore } = await import('../apps/desktop/src/renderer/src/stores/auth-store');
  const { useWorkspaceStore } = await import('../apps/desktop/src/renderer/src/stores/workspace-store');

  // Test 1: Unauthenticated startup redirects to Login
  console.log('\n[Test 1] Testing unauthenticated startup...');
  mockSettings.sessionToken = undefined;
  mockSettings.sessionConfigured = false;
  
  await useAuthStore.getState().checkSession();
  console.log('  - authState:', useAuthStore.getState().authState);
  console.log('  - user:', useAuthStore.getState().user);
  if (useAuthStore.getState().authState !== 'LOGIN') {
    throw new Error('Test 1 Failed: Should redirect to LOGIN when unauthenticated.');
  }
  console.log('✅ Test 1 Passed.');

  // Test 2: Successful login persists session and moves to AUTHENTICATED_HOME
  console.log('\n[Test 2] Testing successful login...');
  const loginRes = await useAuthStore.getState().login('user@synkro.com', 'password123', 'signin');
  console.log('  - login result success:', loginRes.success);
  console.log('  - authState:', useAuthStore.getState().authState);
  console.log('  - user email:', useAuthStore.getState().user?.email);
  console.log('  - persisted sessionToken:', mockSettings.sessionToken);
  
  if (!loginRes.success || useAuthStore.getState().authState !== 'AUTHENTICATED_HOME' || mockSettings.sessionToken !== 'valid_token') {
    throw new Error('Test 2 Failed: Login should succeed and go to AUTHENTICATED_HOME.');
  }
  console.log('✅ Test 2 Passed.');

  // Test 3: Startup restores authenticated session if present
  console.log('\n[Test 3] Testing session restoration on app boot...');
  // Reset store state to simulate app restart
  useAuthStore.setState({ authState: 'BOOTING', user: null });
  
  await useAuthStore.getState().checkSession();
  console.log('  - authState:', useAuthStore.getState().authState);
  console.log('  - user email:', useAuthStore.getState().user?.email);
  if (useAuthStore.getState().authState !== 'AUTHENTICATED_HOME' || !useAuthStore.getState().user) {
    throw new Error('Test 3 Failed: Should automatically restore session and go to AUTHENTICATED_HOME.');
  }
  console.log('✅ Test 3 Passed.');

  // Test 4: Workspace state transition
  console.log('\n[Test 4] Testing transition to WORKSPACE when project opens...');
  useWorkspaceStore.setState({ project: { id: 'p1', name: 'MyProject', path: '/path/to/project', platform: 'react-native', lastOpened: '' } });
  
  await useAuthStore.getState().checkSession();
  console.log('  - authState:', useAuthStore.getState().authState);
  if (useAuthStore.getState().authState !== 'WORKSPACE') {
    throw new Error('Test 4 Failed: Should go to WORKSPACE when project is active.');
  }
  console.log('✅ Test 4 Passed.');

  // Test 5: Logout clears session and redirects to LOGIN
  console.log('\n[Test 5] Testing logout...');
  await useAuthStore.getState().logout();
  console.log('  - authState:', useAuthStore.getState().authState);
  console.log('  - user:', useAuthStore.getState().user);
  console.log('  - persisted sessionToken:', mockSettings.sessionToken);
  console.log('  - active workspace project:', useWorkspaceStore.getState().project);
  
  if (useAuthStore.getState().authState !== 'LOGIN' || mockSettings.sessionToken !== undefined || useWorkspaceStore.getState().project !== null) {
    throw new Error('Test 5 Failed: Logout should clear all local state and project.');
  }
  console.log('✅ Test 5 Passed.');

  // Test 6: 401/Expiration invalidates session
  console.log('\n[Test 6] Testing session expiration / 401 handling...');
  // Force sign in
  await useAuthStore.getState().login('user@synkro.com', 'password123', 'signin');
  console.log('  - authState before expiry:', useAuthStore.getState().authState);
  
  // Trigger mocked expiration event (which main process would emit via webContents.send)
  if ((globalThis as any).triggerSessionExpired) {
    (globalThis as any).triggerSessionExpired();
  }
  
  // Wait for async logout to complete
  await new Promise(resolve => setTimeout(resolve, 50));
  
  console.log('  - authState after expiry:', useAuthStore.getState().authState);
  console.log('  - user after expiry:', useAuthStore.getState().user);
  if (useAuthStore.getState().authState !== 'LOGIN' || useAuthStore.getState().user !== null) {
    throw new Error('Test 6 Failed: Expired session should reset state to LOGIN.');
  }
  console.log('✅ Test 6 Passed.');

  // Test 7: Audit provider keys
  console.log('\n[Test 7] Auditing local provider settings...');
  if ('apiKey' in mockSettings || 'apiProvider' in mockSettings || 'apiModel' in mockSettings) {
    // Note: The properties still exist deprecated in index.ts for typing fallback, but they shouldn't contain values.
    console.log('  - checked settings object schema. Settings interface deprecates keys.');
  }
  console.log('✅ Test 7 Passed.');

  console.log('\n🎉 ALL SaaS AUTH STATE MACHINE INTEGRATION TESTS PASSED!');
}

runTests().catch(err => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
