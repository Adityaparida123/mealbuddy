import { ArrowLeft, LogOut, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../common/ui';
import type { UserRole } from '../../services/api';
import AuthPanel from './AuthPanel';

export function AuthScreen({ requiredRole, onBack }: { requiredRole: UserRole; onBack: () => void }) {
  return (
    <div className="min-h-screen bg-orange-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <button onClick={onBack} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <ArrowLeft size={18} />
            </button>
            <span className="text-2xl">🍱</span>
            <h1 className="text-sm font-extrabold text-slate-900">Meal Buddy</h1>
          </div>
          <p className="text-xs text-slate-500">Authentication required</p>
        </div>
      </header>
      <div className="mx-auto max-w-md px-4 py-10">
        <AuthPanel requiredRole={requiredRole} />
      </div>
    </div>
  );
}

export function RoleNotice({
  requiredRole,
  onBack,
}: {
  requiredRole: UserRole;
  onBack: () => void;
}) {
  const { user, logout } = useAuth();
  const label = requiredRole === 'COOK' ? 'canteen cook' : 'student';
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-orange-50 px-4">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 text-center shadow-sm">
        <ShieldAlert size={28} className="mx-auto text-amber-500" />
        <h2 className="mt-3 text-lg font-bold text-slate-900">Wrong role for this area</h2>
        <p className="mt-1 text-sm text-slate-600">
          You're signed in as <span className="font-semibold">{user?.email}</span> ({user?.role}).
          This area is for the {label} experience.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Button variant="secondary" onClick={onBack}>
            <ArrowLeft size={16} /> Back to home
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              logout();
              onBack();
            }}
          >
            <LogOut size={16} /> Log out and switch account
          </Button>
        </div>
      </div>
    </div>
  );
}