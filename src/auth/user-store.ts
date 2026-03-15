/**
 * UserStore -- JSON-file-backed user management.
 *
 * Stores users with scrypt-hashed passwords and session tokens.
 * Each user gets isolated agent sessions (separate memory, chat history).
 * Persists to data/users.json.
 */

import { randomUUID, scryptSync, randomBytes, timingSafeEqual } from 'crypto';
import fs from 'fs';
import path from 'path';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  salt: string;
  createdAt: number;
}

export interface UserPublic {
  id: string;
  email: string;
  createdAt: number;
}

export interface Session {
  token: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
}

const DEFAULT_PATH = path.join(process.cwd(), 'data', 'users.json');
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export class UserStore {
  private users: User[] = [];
  private sessions: Map<string, Session> = new Map();
  private readonly filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath ?? DEFAULT_PATH;
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.users = JSON.parse(raw) as User[];
      }
    } catch {
      this.users = [];
    }
  }

  private persist(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.users, null, 2));
    } catch (err) {
      console.error(`[UserStore] Failed to persist: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /** Hash a password with a salt using scrypt. */
  private hashPassword(password: string, salt: string): string {
    return scryptSync(password, salt, 64).toString('hex');
  }

  /** Verify a password against a stored hash using timing-safe comparison. */
  private verifyPassword(password: string, salt: string, storedHash: string): boolean {
    const hash = scryptSync(password, salt, 64);
    const storedBuf = Buffer.from(storedHash, 'hex');
    if (hash.length !== storedBuf.length) return false;
    return timingSafeEqual(hash, storedBuf);
  }

  /** Create a new user. Returns the user or throws if email already exists. */
  signup(email: string, password: string): { user: UserPublic; token: string } {
    const normalized = email.toLowerCase().trim();

    if (!normalized || !password) {
      throw new Error('Email and password are required');
    }
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }
    if (this.users.find(u => u.email === normalized)) {
      throw new Error('Email already registered');
    }

    const salt = randomBytes(16).toString('hex');
    const passwordHash = this.hashPassword(password, salt);

    const user: User = {
      id: randomUUID(),
      email: normalized,
      passwordHash,
      salt,
      createdAt: Date.now(),
    };

    this.users.push(user);
    this.persist();

    const session = this.createSession(user.id);
    return {
      user: { id: user.id, email: user.email, createdAt: user.createdAt },
      token: session.token,
    };
  }

  /** Authenticate a user. Returns user + token or throws on failure. */
  login(email: string, password: string): { user: UserPublic; token: string } {
    const normalized = email.toLowerCase().trim();
    const user = this.users.find(u => u.email === normalized);

    if (!user || !this.verifyPassword(password, user.salt, user.passwordHash)) {
      throw new Error('Invalid email or password');
    }

    const session = this.createSession(user.id);
    return {
      user: { id: user.id, email: user.email, createdAt: user.createdAt },
      token: session.token,
    };
  }

  /** Create a session token for a user. */
  private createSession(userId: string): Session {
    const session: Session = {
      token: randomUUID(),
      userId,
      createdAt: Date.now(),
      expiresAt: Date.now() + SESSION_TTL_MS,
    };
    this.sessions.set(session.token, session);
    return session;
  }

  /** Validate a session token. Returns the user or null. */
  validateToken(token: string): UserPublic | null {
    const session = this.sessions.get(token);
    if (!session) return null;

    // Check expiry
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(token);
      return null;
    }

    const user = this.users.find(u => u.id === session.userId);
    if (!user) return null;

    return { id: user.id, email: user.email, createdAt: user.createdAt };
  }

  /** Invalidate a session token (logout). */
  logout(token: string): void {
    this.sessions.delete(token);
  }

  /** Get user count. */
  getUserCount(): number {
    return this.users.length;
  }
}
