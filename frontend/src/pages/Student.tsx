import { useState } from 'react';
import { ArrowLeft, RotateCcw, ChefHat, Heart, SlidersHorizontal, LogOut } from 'lucide-react';
import { useMenu } from '../hooks/useMenu';
import { useChat } from '../hooks/useChat';
import { useAuth } from '../hooks/useAuth';
import { useFavorites } from '../hooks/useFavorites';
import { ChatWindow } from '../components/chat/ChatWindow';
import FoodProfileForm from '../components/profile/FoodProfileForm';
import { ErrorBanner } from '../components/common/Status';

export default function Student({ onBack }: { onBack: () => void }) {
  const { menu, loading, error: menuError, refresh } = useMenu();
  const { messages, send, isBusy, resetChat } = useChat();
  const { logout } = useAuth();
  const favorites = useFavorites();
  const [menuOpen, setMenuOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);

  const connected = menu.length > 0 && !menuError;
  const subtitle = menuError
    ? 'Unable to connect to Meal Buddy server.'
    : loading && menu.length === 0
      ? 'Connecting to the live canteen menu…'
      : 'Live menu from the canteen • AI rankings with safety rules';

  const header = (
    <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-2xl">🍱</span>
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">Meal Buddy</h2>
            <p className="flex items-center gap-1 text-xs text-slate-500">
              <span
                className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}
              />
              {subtitle}
            </p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setPrefsOpen(v => !v)}
          className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200"
        >
          <SlidersHorizontal size={13} /> Preferences
        </button>
        <button
          onClick={() => setMenuOpen(v => !v)}
          className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200"
        >
          {menuOpen ? 'Hide menu' : 'Today’s menu'}
        </button>
        <button onClick={resetChat} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Reset conversation">
          <RotateCcw size={16} />
        </button>
        <button onClick={logout} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Log out">
          <LogOut size={16} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen flex-col">
      {header}

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-3 overflow-hidden px-3 py-3 sm:px-4">
        {menuOpen && (
          <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-slate-600">Today's menu</p>
              {favorites.favorites.length > 0 && (
                <p className="text-xs text-slate-400">❤️ {favorites.favorites.length} saved</p>
              )}
            </div>
            {loading && menu.length === 0 ? (
              <p className="text-xs text-slate-400">Loading menu…</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {menu
                  .filter(m => m.available)
                  .map(m => {
                    const saved = favorites.isFavorite(m.id);
                    return (
                      <span
                        key={m.id}
                        className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-xs text-slate-600"
                      >
                        <button
                          onClick={() => favorites.toggle(m)}
                          title={saved ? 'Remove from saved' : 'Save to favorites'}
                          className={saved ? 'text-red-500' : 'text-slate-300 hover:text-red-400'}
                        >
                          <Heart size={11} fill={saved ? 'currentColor' : 'none'} />
                        </button>
                        {m.name} <span className="font-semibold text-orange-600">₹{m.price}</span>
                      </span>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {prefsOpen && (
          <FoodProfileForm onClose={() => setPrefsOpen(false)} />
        )}

        {menuError && <ErrorBanner message={menuError} onRetry={() => refresh()} />}

        <div className="flex-1 overflow-hidden">
          <ChatWindow messages={messages} onSend={send} isBusy={isBusy} header={undefined} />
        </div>
        <p className="text-center text-[11px] leading-relaxed text-slate-400">
          Meal Buddy only recommends items currently on today's canteen menu.
          <span className="mx-1">·</span>Allergy safety is a hard constraint.
          <span className="mx-1">·</span>{' '}
          <span className="inline-flex items-center gap-1">
            <ChefHat size={11} /> Menu managed live by the canteen cook.
          </span>
        </p>
      </div>
    </div>
  );
}