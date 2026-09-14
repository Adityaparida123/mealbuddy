import { useState, type FormEvent } from 'react';
import { LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../common/ui';
import { ApiError, type UserRole } from '../../services/api';

type Mode = 'login' | 'register';

export default function AuthPanel({ requiredRole }: { requiredRole: UserRole }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>(requiredRole);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isCookArea = requiredRole === 'COOK';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(name.trim(), email.trim(), password, role);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to connect to Meal Buddy server.');
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="text-center">
        <h2 className="text-lg font-bold text-slate-900">
          {isCookArea ? '👨‍🍳 Canteen Cook sign in' : '👨‍🎓 Student sign in'}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Sign in with your Meal Buddy account to continue.
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-sm font-semibold">
        {(['login', 'register'] as Mode[]).map(m => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`rounded-md px-3 py-1.5 transition ${
              mode === m ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {m === 'login' ? 'Log in' : 'Create account'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        {mode === 'register' && (
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Full name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              required
              minLength={2}
              placeholder="Your name"
              className={inputCls}
            />
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            placeholder="you@college.edu"
            className={inputCls}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
            placeholder="At least 6 characters"
            className={inputCls}
          />
        </div>

        {mode === 'register' && (
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">I am a…</label>
            <select value={role} onChange={e => setRole(e.target.value as UserRole)} className={inputCls}>
              <option value="STUDENT">Student</option>
              <option value="COOK">Canteen Cook</option>
            </select>
          </div>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>
        )}

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : mode === 'login' ? (
            <>
              <LogIn size={16} /> Log in
            </>
          ) : (
            <>
              <UserPlus size={16} /> Create account
            </>
          )}
        </Button>
      </form>

      <p className="mt-4 text-center text-xs text-slate-400">
        Demo account · {isCookArea ? 'cook@mealbuddy.app / cook123' : 'student@mealbuddy.app / student123'}
      </p>
    </div>
  );
}