import { useState } from 'react';
import { Plus } from 'lucide-react';

const ALLERGIES = [
  'peanuts',
  'nuts',
  'dairy',
  'eggs',
  'gluten',
  'soy',
  'shellfish',
];

export function QuickChips({ onSend }: { onSend: (text: string) => void }) {
  const [showAllergy, setShowAllergy] = useState(false);

  const chip =
    'rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-600 transition hover:bg-brand-50';

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-400">
        Quick filters
      </span>
      <button className={chip} onClick={() => onSend('I only have ₹50')}>₹50</button>
      <button className={chip} onClick={() => onSend('I only have ₹100')}>₹100</button>
      <button className={chip} onClick={() => onSend('I only have ₹150')}>₹150</button>
      <button className={chip} onClick={() => onSend('I have 10 minutes')}>10 min</button>
      <button className={chip} onClick={() => onSend('I have 20 minutes')}>20 min</button>
      <button className={chip} onClick={() => onSend('I have 30 minutes')}>30 min</button>
      <button className={chip} onClick={() => onSend("I'm vegetarian")}>Vegetarian</button>
      <button className={chip} onClick={() => onSend("I'm vegan")}>Vegan</button>
      <button
        className={chip}
        onClick={() => setShowAllergy(v => !v)}
      >
        <span className="inline-flex items-center gap-1"><Plus size={12} /> Allergy</span>
      </button>
      {showAllergy && (
        <div className="flex w-full flex-wrap gap-1.5 pt-1">
          {ALLERGIES.map(a => (
            <button
              key={a}
              className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100"
              onClick={() => onSend(`I'm allergic to ${a}`)}
            >
              {a}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}