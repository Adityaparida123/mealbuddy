import { useState } from 'react';
import { Send } from 'lucide-react';

export function ChatInput({
  onSend,
  disabled = false,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState('');

  const submit = () => {
    const v = value.trim();
    if (!v || disabled) return;
    onSend(v);
    setValue('');
  };

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        submit();
      }}
      className="flex items-center gap-2"
    >
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Tell Meal Buddy what you want to eat…"
        className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        disabled={disabled}
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="rounded-xl bg-brand-500 p-3 text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-40"
        aria-label="Send message"
      >
        <Send size={18} />
      </button>
    </form>
  );
}