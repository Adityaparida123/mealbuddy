import { useState } from 'react';
import { ArrowLeft, RotateCcw, ChefHat } from 'lucide-react';
import { useMenu } from '../hooks/useMenu';
import { useChat } from '../hooks/useChat';
import { ChatWindow } from '../components/chat/ChatWindow';
import { isGeminiConfigured } from '../services/gemini';

export default function Student({ onBack }: { onBack: () => void }) {
  const { menu } = useMenu();
  const { messages, send, isBusy, resetChat } = useChat(menu);
  const [menuOpen, setMenuOpen] = useState(false);

  const geminiConfigured = isGeminiConfigured();

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
            <p className="text-xs text-slate-500">
              {geminiConfigured
                ? 'Connected to Gemini AI'
                : 'Deterministic engine (add VITE_GEMINI_API_KEY to enable AI)'}
            </p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setMenuOpen(v => !v)}
          className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200"
        >
          {menuOpen ? 'Hide menu' : 'Today’s menu'}
        </button>
        <button onClick={resetChat} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Reset conversation">
          <RotateCcw size={16} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen flex-col">
      {header}

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-3 overflow-hidden px-3 py-3 sm:px-4">
        {menuOpen && (
          <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            {menu
              .filter(m => m.available)
              .map(m => (
                <span key={m.id} className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-xs text-slate-600">
                  {m.name} <span className="font-semibold text-orange-600">₹{m.price}</span>
                </span>
              ))}
          </div>
        )}
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