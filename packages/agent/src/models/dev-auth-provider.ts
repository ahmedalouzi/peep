import type { IAuthProvider } from './auth-provider';

export class DevelopmentAuthProvider implements IAuthProvider {
  async validateSession(sessionToken: string, requestId?: string): Promise<{ userId: string; email: string }> {
    const reqId = requestId || 'UNKNOWN';
    console.log(`[REQ ${reqId}] DevelopmentAuthProvider.validateSession entered`);
    if (sessionToken === 'dev_test_session') {
      const result = {
        userId: '00000000-0000-0000-0000-000000000000',
        email: 'dev@synkro.com'
      };
      console.log(`[REQ ${reqId}] DevelopmentAuthProvider.validateSession returned`);
      return result;
    }
    throw new Error('Invalid development session token');
  }
}
