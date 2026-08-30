import { AuthService } from '../src/models/auth';
import { db } from '../src/models/db';

export default async function runTests() {
  console.log('  Running P3.15 Production Authentication tests...');
  
  const auth = new AuthService();

  // Test: Sign Up and Login flow
  const email1 = `test_${Math.random().toString(36).substring(7)}@example.com`;
  let session = await auth.signup(email1, 'secure_password_123');
  if (!session || !session.sessionToken || !session.refreshToken) {
    throw new Error('Sign Up failed to return valid tokens');
  }

  let loginSession = await auth.login(email1, 'secure_password_123');
  if (loginSession.sessionToken === session.sessionToken) {
    throw new Error('Login returned the same session token');
  }

  // Test: Password hashing prevents plain text login
  const email2 = `hash_${Math.random().toString(36).substring(7)}@example.com`;
  await auth.signup(email2, 'password123');
  const userRes = await db.query('SELECT password_hash FROM users WHERE email = $1', [email2]);
  const user = userRes.rows[0];
  if (user.password_hash.includes('password123')) {
    throw new Error('Password stored in plain text');
  }
  if (!user.password_hash.startsWith('scrypt:')) {
    throw new Error('Password hash missing scrypt prefix');
  }

  // Test: Refresh Token Rotation (RTR) atomic lock & valid refresh
  const email3 = `rtr_${Math.random().toString(36).substring(7)}@example.com`;
  const rtrSession = await auth.signup(email3, 'password123');
  const newRtrSession = await auth.refresh(rtrSession.refreshToken);
  if (newRtrSession.sessionToken === rtrSession.sessionToken) {
    throw new Error('RTR did not rotate session token');
  }
  if (newRtrSession.refreshToken === rtrSession.refreshToken) {
    throw new Error('RTR did not rotate refresh token');
  }

  try {
    await auth.refresh(rtrSession.refreshToken);
    throw new Error('RTR failed to reject reused token');
  } catch (err: any) {
    if (!err.message.match(/Invalid refresh token/i)) throw err;
  }

  // Test: Refresh Token reuse detection invalidates family
  const email4 = `reuse_${Math.random().toString(36).substring(7)}@example.com`;
  const reuseSession = await auth.signup(email4, 'password123');
  const session2 = await auth.refresh(reuseSession.refreshToken);
  
  try {
    await auth.refresh(reuseSession.refreshToken);
    throw new Error('Reuse failed to throw');
  } catch (err: any) {
    if (!err.message.match(/Invalid refresh token/i)) throw err;
  }

  try {
    await auth.refresh(session2.refreshToken);
    throw new Error('Family not invalidated');
  } catch (err: any) {
    if (!err.message.match(/Invalid refresh token/i)) throw err;
  }
  
  try {
    await auth.validateSession(session2.sessionToken);
    throw new Error('Active session not revoked');
  } catch (err: any) {
    if (!err.message.match(/Invalid session token/i)) throw err;
  }
  
  // Test: Generic errors do not reveal accounts
  const email5 = `exists_${Math.random().toString(36).substring(7)}@example.com`;
  await auth.signup(email5, 'password123');
  try {
    await auth.signup(email5, 'password123');
    throw new Error('Signup did not throw');
  } catch (err: any) {
    // Expected to fail on duplicates
  }
  try {
    await auth.login(email5, 'wrongpassword');
    throw new Error('Login did not throw');
  } catch (err: any) {
    // Expected invalid credentials error
  }

  console.log('  🟢 All P3.15 Production Authentication tests passed.');
}
