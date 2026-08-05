import type { IAuthProvider } from './auth-provider';
import { AuthService } from './auth';
import { DevelopmentAuthProvider } from './dev-auth-provider';

export class AuthenticationRouter implements IAuthProvider {
  private productionProvider = new AuthService();
  private devProvider = new DevelopmentAuthProvider();

  private getProvider(): IAuthProvider {
    if (
      process.env.NODE_ENV !== 'production' &&
      process.env.SYNKRO_DEV_AUTH_BYPASS === 'true'
    ) {
      return this.devProvider;
    }
    return this.productionProvider;
  }

  async validateSession(sessionToken: string): Promise<{ userId: string; email: string }> {
    return this.getProvider().validateSession(sessionToken);
  }
  
  async signup(email: string, password: string) {
    return this.productionProvider.signup(email, password);
  }
  
  async login(email: string, password: string) {
    return this.productionProvider.login(email, password);
  }
  
  async refresh(refreshToken: string) {
    return this.productionProvider.refresh(refreshToken);
  }
  
  async logout(sessionToken: string, refreshToken?: string) {
    return this.productionProvider.logout(sessionToken, refreshToken);
  }
}
