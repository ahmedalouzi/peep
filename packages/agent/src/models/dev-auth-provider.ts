import type { IAuthProvider } from './auth-provider';

export class DevelopmentAuthProvider implements IAuthProvider {
  async validateSession(sessionToken: string): Promise<{ userId: string; email: string }> {
    if (sessionToken === 'dev_test_session') {
      return {
        userId: 'dev-test-user-id',
        email: 'dev@synkro.com'
      };
    }
    throw new Error('Invalid development session token');
  }
}
