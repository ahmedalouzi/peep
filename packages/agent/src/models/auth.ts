import crypto from 'crypto';
import { promisify } from 'util';
import { db } from './db';
import { randomUUID } from 'node:crypto';

const scryptAsync = promisify(crypto.scrypt);
const randomBytesAsync = promisify(crypto.randomBytes);

export interface UserSession {
  userId: string;
  email: string;
  sessionToken: string;
  refreshToken: string; // only returned on login/refresh
  expiresAt: number; // ms
}

export interface UserAccount {
  id: string;
  email: string;
  passwordHash: string; // format: 'scrypt:salt:hash'
}

import type { IAuthProvider } from './auth-provider';

export class AuthService implements IAuthProvider {
  private readonly WINDOW_MS = 15 * 60 * 1000; // 15 mins
  private readonly MAX_ATTEMPTS = 10;

  constructor() {}

  // --- Password Hashing ---
  private async hashPassword(password: string): Promise<string> {
    const salt = (await randomBytesAsync(16)).toString('hex');
    const hash = (await scryptAsync(password, salt, 64)) as Buffer;
    return `scrypt:${salt}:${hash.toString('hex')}`;
  }

  private async verifyPassword(password: string, storedHash: string): Promise<boolean> {
    const parts = storedHash.split(':');
    if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
    const salt = parts[1];
    const key = parts[2];
    const hash = (await scryptAsync(password, salt, 64)) as Buffer;
    return crypto.timingSafeEqual(Buffer.from(key, 'hex'), hash);
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private validatePasswordRules(password: string): boolean {
    return password.length >= 8;
  }

  // --- Rate Limiter ---
  private async checkRateLimit(key: string): Promise<boolean> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - this.WINDOW_MS);
    
    // Cleanup old records optionally, but we just check window here
    const res = await db.query(
      `SELECT attempts, window_start FROM rate_limits WHERE ip_or_email = $1`,
      [key]
    );

    if (res.rows.length === 0) {
      await db.query(
        `INSERT INTO rate_limits (ip_or_email, attempts, window_start) VALUES ($1, 1, $2)`,
        [key, now]
      );
      return true;
    }

    const record = res.rows[0];
    if (record.window_start < windowStart) {
      await db.query(
        `UPDATE rate_limits SET attempts = 1, window_start = $1 WHERE ip_or_email = $2`,
        [now, key]
      );
      return true;
    }

    if (record.attempts >= this.MAX_ATTEMPTS) {
      return false;
    }

    await db.query(
      `UPDATE rate_limits SET attempts = attempts + 1 WHERE ip_or_email = $1`,
      [key]
    );
    return true;
  }

  // --- Endpoints ---
  async signup(email: string, password: string): Promise<UserSession> {
    if (!(await this.checkRateLimit(`signup:${email}`))) {
      throw new Error('Too many attempts. Please try again later.');
    }

    if (!email || !email.includes('@')) {
      throw new Error('Invalid email address');
    }
    if (!this.validatePasswordRules(password)) {
      throw new Error('Password must be at least 8 characters long');
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      
      const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        throw new Error('Email already registered');
      }

      const hash = await this.hashPassword(password);
      const userId = randomUUID();
      
      await client.query(
        'INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)',
        [userId, email, hash]
      );

      const session = await this.createSessionInternal(client, userId, email);
      await client.query('COMMIT');
      return session;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async login(email: string, password: string): Promise<UserSession> {
    if (!(await this.checkRateLimit(`login:${email}`))) {
      throw new Error('Too many attempts. Please try again later.');
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const userRes = await client.query('SELECT id, email, password_hash FROM users WHERE email = $1', [email]);
      
      if (userRes.rows.length === 0) {
        throw new Error('Invalid email or password');
      }

      const user = userRes.rows[0];
      const isValid = await this.verifyPassword(password, user.password_hash);
      if (!isValid) {
        throw new Error('Invalid email or password');
      }

      const session = await this.createSessionInternal(client, user.id, user.email);
      await client.query('COMMIT');
      return session;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  private async createSessionInternal(client: any, userId: string, email: string): Promise<UserSession> {
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const refreshToken = crypto.randomBytes(32).toString('hex');
    const hashedRefresh = this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    await client.query(
      `INSERT INTO sessions (session_token, refresh_token, user_id, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [sessionToken, hashedRefresh, userId, expiresAt]
    );

    return {
      userId,
      email,
      sessionToken,
      refreshToken,
      expiresAt: expiresAt.getTime()
    };
  }

  async validateSession(sessionToken: string, requestId?: string): Promise<{ userId: string; email: string }> {
    const reqId = requestId || 'UNKNOWN';
    console.log(`[REQ ${reqId}] AuthService.validateSession entered`);
    const res = await db.query(
      `SELECT s.user_id, u.email, s.expires_at 
       FROM sessions s 
       JOIN users u ON s.user_id = u.id 
       WHERE s.session_token = $1`,
      [sessionToken]
    );

    if (res.rows.length === 0) {
      throw new Error('Invalid session token');
    }

    const session = res.rows[0];
    if (new Date(session.expires_at) < new Date()) {
      await db.query('DELETE FROM sessions WHERE session_token = $1', [sessionToken]);
      throw new Error('Session expired');
    }

    return {
      userId: session.user_id,
      email: session.email
    };
  }

  async refresh(refreshToken: string): Promise<UserSession> {
    const hashedRefresh = this.hashToken(refreshToken);
    
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      
      const res = await client.query(
        `SELECT s.session_token, s.user_id, u.email 
         FROM sessions s 
         JOIN users u ON s.user_id = u.id 
         WHERE s.refresh_token = $1 FOR UPDATE`,
        [hashedRefresh]
      );

      if (res.rows.length === 0) {
        throw new Error('Invalid refresh token');
      }

      const oldSession = res.rows[0];
      await client.query('DELETE FROM sessions WHERE session_token = $1', [oldSession.session_token]);

      const session = await this.createSessionInternal(client, oldSession.user_id, oldSession.email);
      await client.query('COMMIT');
      return session;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async logout(sessionToken: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      const hashedRefresh = this.hashToken(refreshToken);
      await db.query('DELETE FROM sessions WHERE refresh_token = $1', [hashedRefresh]);
    } else {
      await db.query('DELETE FROM sessions WHERE session_token = $1', [sessionToken]);
    }
  }
}
