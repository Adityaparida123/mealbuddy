import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { authApi, setAuthTokenGetter, type AuthUser, type UserRole } from '../services/api';

// ---------------------------------------------------------------------------
// Auth session.
//
// JWT is stored in localStorage (the backend's existing Bearer-token model has
// no cookie support). Only the session token + minimal public user fields are
// kept — passwords/backend secrets never enter the browser.
// ---------------------------------------------------------------------------

const AUTH_STORAGE_KEY = 'mealbuddy.auth.v1';

interface StoredSession {
  token: string;
  user: AuthUser;
}

function readStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (parsed && typeof parsed.token === 'string' && parsed.user) return parsed;
    return null;
  } catch {
    return null;
  }
}

function persistSession(session: StoredSession | null): void {
  try {
    if (session) localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    /* storage unavailable — best effort */
  }
}

// Every API request reads the freshest token straight from storage.
setAuthTokenGetter(() => readStoredSession()?.token ?? null);

type AuthStatus = 'loading' | 'guest' | 'authed';

interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role: UserRole) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(() => readStoredSession());
  const [status, setStatus] = useState<AuthStatus>(() => (readStoredSession() ? 'loading' : 'guest'));

  // Validate a restored session against the backend on first mount.
  useEffect(() => {
    const stored = readStoredSession();
    if (!stored) {
      setStatus('guest');
      return;
    }
    let active = true;
    authApi
      .me()
      .then(() => {
        if (!active) return;
        setSession(stored);
        setStatus('authed');
      })
      .catch(() => {
        if (!active) return;
        persistSession(null);
        setSession(null);
        setStatus('guest');
      });
    return () => {
      active = false;
    };
  }, []);

  const applySession = useCallback((next: StoredSession) => {
    persistSession(next);
    setSession(next);
    setStatus('authed');
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await authApi.login(email.trim(), password);
      applySession({ token: res.token, user: res.user });
    },
    [applySession]
  );

  const register = useCallback(
    async (name: string, email: string, password: string, role: UserRole) => {
      const res = await authApi.register({ name, email, password, role });
      applySession({ token: res.token, user: res.user });
    },
    [applySession]
  );

  const logout = useCallback(() => {
    persistSession(null);
    setSession(null);
    setStatus('guest');
  }, []);

  return (
    <AuthContext.Provider value={{ user: session?.user ?? null, status, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an <AuthProvider>.');
  return ctx;
}