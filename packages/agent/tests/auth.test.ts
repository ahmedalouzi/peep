import { AuthService } from '../src/models/auth';
import { BackendAIGateway } from '../src/models/backend-gateway';

export default async function runTests() {
  console.log('  Running AuthService & Session unit tests...');

  const auth = new AuthService();

  // Test 1: Successful Login
  const session = await auth.login('user@example.com', 'hash-password-123');
  if (typeof session.sessionToken !== 'string' || session.sessionToken.length !== 64) {
    throw new Error('login failed to return a valid session token format');
  }

  // Test 2: Invalid Login Credentials
  try {
    await auth.login('user@example.com', 'wrong-pass');
    throw new Error('login did not reject invalid password');
  } catch (err: any) {
    if (err.message !== 'Invalid email or password.') throw err;
  }

  // Test 3: Session Validation (Valid Token)
  const validated = auth.validateSession(session.sessionToken);
  if (validated.userId !== 'user-1') {
    throw new Error('session validation returned incorrect user identity');
  }

  // Test 4: Token Revocation / Logout
  await auth.logout(session.sessionToken);
  try {
    auth.validateSession(session.sessionToken);
    throw new Error('validateSession did not reject logged out/revoked token');
  } catch (err: any) {
    if (err.message !== 'Session not found') throw err;
  }

  // Test 5: Expired Token Check
  const session2 = await auth.login('user@example.com', 'hash-password-123');
  // @ts-ignore
  auth.sessions.get(session2.sessionToken)!.expiresAt = Date.now() - 1000; // Force expire 1s in the past
  try {
    auth.validateSession(session2.sessionToken);
    throw new Error('validateSession did not reject expired session token');
  } catch (err: any) {
    if (err.message !== 'Session expired') throw err;
  }

  // Test 6: Gateway Authorization integration
  const gateway = new BackendAIGateway();
  const { MockOpenAIAdapter } = await import('../src/models/backend-gateway');
  (gateway as any).adapters.set('google', new MockOpenAIAdapter());
  const session3 = await gateway.authService.login('user@example.com', 'hash-password-123');
  
  const headers = {
    'authorization': `Bearer ${session3.sessionToken}`,
    'x-request-id': 'req-test'
  };
  const body = { tier: 'fast', prompt: 'test' };
  
  const res = await gateway.handleRequest('POST', '/v1/ai/generate', headers, body);
  if (res.status !== 200) {
    throw new Error(`Gateway failed to authorize valid active session. Status: ${res.status}`);
  }

  console.log('  🟢 All AuthService & Session unit tests passed.');
}
