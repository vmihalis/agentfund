/**
 * Auth helpers for the dashboard.
 * Stores token in localStorage, attaches to all API requests.
 */

const TOKEN_KEY = 'agentfund_token';
const USER_KEY = 'agentfund_user';

export interface AuthUser {
  id: string;
  email: string;
  createdAt: number;
}

/** Get stored auth token. */
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

/** Get stored user. */
export function getUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

/** Store auth data after login/signup. */
function storeAuth(user: AuthUser, token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/** Clear auth data on logout. */
export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/** Sign up a new user. */
export async function signup(email: string, password: string): Promise<{ user: AuthUser; token: string }> {
  const res = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Signup failed');
  storeAuth(data.user, data.token);
  return data;
}

/** Log in an existing user. */
export async function login(email: string, password: string): Promise<{ user: AuthUser; token: string }> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  storeAuth(data.user, data.token);
  return data;
}

/** Log out. */
export async function logout(): Promise<void> {
  const token = getToken();
  if (token) {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
  clearAuth();
}

/** Make an authenticated fetch. Attaches Bearer token automatically. */
export async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(url, { ...init, headers });
}
