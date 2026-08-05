import type { UserSession } from './auth';

export interface IAuthProvider {
  validateSession(sessionToken: string): Promise<{ userId: string; email: string }>;
  signup?(email: string, password: string): Promise<UserSession>;
  login?(email: string, password: string): Promise<UserSession>;
  refresh?(refreshToken: string): Promise<UserSession>;
  logout?(sessionToken: string, refreshToken?: string): Promise<void>;
}
