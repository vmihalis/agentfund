'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { getUser, getToken, login, signup, logout, type AuthUser } from '@/lib/auth';

/**
 * AuthGate wraps the app. Shows login/signup if not authenticated,
 * renders children + user badge when authenticated.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Check for existing session
    const existing = getUser();
    const token = getToken();
    if (existing && token) {
      setUser(existing);
    }
    setLoading(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const result = mode === 'login'
        ? await login(email, password)
        : await signup(email, password);
      setUser(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setEmail('');
    setPassword('');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-cyan-500" />
      </div>
    );
  }

  // Authenticated — render app with user badge
  if (user) {
    return (
      <div>
        {/* User badge - fixed top right */}
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
          <span className="rounded-full bg-gray-800 border border-gray-700 px-3 py-1 text-xs text-gray-400">
            {user.email}
          </span>
          <button
            onClick={handleLogout}
            className="rounded-full bg-gray-800 border border-gray-700 px-3 py-1 text-xs text-gray-500 hover:text-white hover:border-gray-600 transition-colors"
          >
            Logout
          </button>
        </div>
        {children}
      </div>
    );
  }

  // Not authenticated — show login/signup
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white">AgentFund</h1>
          <p className="mt-1 text-sm text-gray-500">
            Autonomous AI Treasury Management
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="rounded-lg border border-gray-800 bg-gray-900 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </h2>

          {error && (
            <div className="rounded bg-red-950/50 border border-red-800/50 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
              placeholder="Min 6 characters"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-500 disabled:opacity-50"
          >
            {submitting ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>

          <p className="text-center text-xs text-gray-500">
            {mode === 'login' ? (
              <>
                No account?{' '}
                <button type="button" onClick={() => { setMode('signup'); setError(''); }} className="text-cyan-400 hover:underline">
                  Create one
                </button>
              </>
            ) : (
              <>
                Have an account?{' '}
                <button type="button" onClick={() => { setMode('login'); setError(''); }} className="text-cyan-400 hover:underline">
                  Sign in
                </button>
              </>
            )}
          </p>
        </form>

        <p className="mt-4 text-center text-[10px] text-gray-600">
          Each account gets isolated agent sessions, memory, and chat history.
        </p>
      </div>
    </div>
  );
}
