import { AuthService } from '../src/models/auth';

export default async function runTests() {
  console.log('  Running P3.15 Production Authentication tests...');
  
  const auth = new AuthService();

  // Test: Sign Up and Login flow
  let session = await auth.signup('test@example.com', 'secure_password_123');
  if (!session || !session.sessionToken || !session.refreshToken) {
    throw new Error('Sign Up failed to return valid tokens');
  }

  let loginSession = await auth.login('test@example.com', 'secure_password_123');
  if (loginSession.sessionToken === session.sessionToken) {
    throw new Error('Login returned the same session token');
  }

  // Test: Password hashing prevents plain text login
  await auth.signup('hash@example.com', 'password123');
  const user = (auth as any).users.get('hash@example.com');
  if (user.passwordHash.includes('password123')) {
    throw new Error('Password stored in plain text');
  }
  if (!user.passwordHash.startsWith('scrypt:')) {
    throw new Error('Password hash missing scrypt prefix');
  }

  // Test: Refresh Token Rotation (RTR) atomic lock & valid refresh
  const rtrSession = await auth.signup('rtr@example.com', 'password123');
  const newRtrSession = await auth.refreshToken(rtrSession.refreshToken);
  if (newRtrSession.sessionToken === rtrSession.sessionToken) {
    throw new Error('RTR did not rotate session token');
  }
  if (newRtrSession.refreshToken === rtrSession.refreshToken) {
    throw new Error('RTR did not rotate refresh token');
  }

  try {
    await auth.refreshToken(rtrSession.refreshToken);
    throw new Error('RTR failed to reject reused token');
  } catch (err: any) {
    if (!err.message.match(/reuse detected/i)) throw err;
  }

  // Test: Refresh Token reuse detection invalidates family
  const reuseSession = await auth.signup('reuse@example.com', 'password123');
  const session2 = await auth.refreshToken(reuseSession.refreshToken);
  
  try {
    await auth.refreshToken(reuseSession.refreshToken);
    throw new Error('Reuse failed to throw');
  } catch (err: any) {
    if (!err.message.match(/reuse detected/i)) throw err;
  }

  try {
    await auth.refreshToken(session2.refreshToken);
    throw new Error('Family not invalidated');
  } catch (err: any) {
    if (!err.message.match(/Invalid refresh token/i)) throw err;
  }
  
  try {
    auth.validateSession(session2.sessionToken);
    throw new Error('Active session not revoked');
  } catch (err: any) {
    if (!err.message.match(/Session not found/i)) throw err;
  }

  // Test: Generic errors do not reveal accounts
  await auth.signup('exists@example.com', 'password123');
  try {
    await auth.signup('exists@example.com', 'password123');
    throw new Error('Signup did not throw');
  } catch (err: any) {
    if (err.message !== 'Registration failed or email already in use.') throw err;
  }
  try {
    await auth.login('exists@example.com', 'wrongpassword');
    throw new Error('Login did not throw');
  } catch (err: any) {
    if (err.message !== 'Invalid email or password.') throw err;
  }

  console.log('  🟢 All P3.15 Production Authentication tests passed.');
}
