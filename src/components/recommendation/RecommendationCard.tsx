import { Check, Clock, Leaf, Flame, ShieldCheck, X } from 'lucide-react';
import type { MatchResult } from '../../types/recommendation';
import { formatMoney, formatTime } from '../../utils/format';
import { Badge } from '../common/ui';
import { MatchScore } from './MatchScore';

export function RecommendationCard({ result }: { result: MatchResult }) {
  const item = result.item;

  return (
    <div className="overflow-hidden rounded-xl border border-brand-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-brand-50 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-brand-600">
            🏆 Best match
          </span>
          {item.available && (
            <Badge tone="green">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Available now
            </Badge>
          )}
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{item.name}</h3>
            <p className="mt-0.5 text-xs text-slate-500">{item.category}</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-extrabold text-orange-600">{formatMoney(item.price)}</p>
            {item.prepTime != null && (
              <p className="flex items-center justify-end gap-1 text-xs text-slate-500">
                <Clock size={12} /> {formatTime(item.prepTime)}
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {item.dietType === 'veg' && (
            <Badge tone="green">
              <Leaf size={12} /> Veg
            </Badge>
          )}
          {item.dietType === 'vegan' && (
            <Badge tone="green">
              <Leaf size={12} /> Vegan
            </Badge>
          )}
          {item.dietType === 'non-veg' && (
            <Badge tone="red">
              <span>Non-veg</span>
            </Badge>
          )}
          {item.glutenFree && <Badge tone="blue">Gluten-free</Badge>}
          {item.spiceLevel === 'spicy' && (
            <Badge tone="orange">
              <Flame size={12} /> Spicy
            </Badge>
          )}
          {item.calories != null && <Badge tone="neutral">{item.calories} kcal</Badge>}
        </div>

        {item.ingredients.length > 0 && (
          <p className="mt-3 text-xs text-slate-600">
            <span className="font-semibold">Ingredients:</span>{' '}
            {item.ingredients.join(', ')}
          </p>
        )}

        {item.allergens.length > 0 && (
          <p className="mt-1.5 text-xs text-slate-500">
            <span className="font-medium">Allergens:</span>{' '}
            {item.allergens.map(a => a[0].toUpperCase() + a.slice(1)).join(', ')}
          </p>
        )}

        <MatchScore score={result.score} reasons={result.reasons} />

        {result.reasons && (result.reasons.craving || result.reasons.diet || result.reasons.budget || result.reasons.time) && (
          <div className="mt-3 rounded-lg bg-slate-50 p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <ShieldCheck size={13} className="text-green-600" />
              Why this matches
            </div>
            <ul className="mt-1.5 grid gap-1">
              {Object.entries(result.reasons)
                .filter(([k, v]) => v && ['diet', 'budget', 'time'].includes(k))
                .map(([k, v]) =>
                  v ? (
                    <li key={k} className="flex items-center gap-1.5 text-xs text-slate-600">
                      <Check size={13} className="text-green-600" /> {k === 'diet' ? 'Matches your diet' : k === 'budget' ? 'Fits your budget' : 'Ready within your time'}
                    </li>
                  ) : null
                )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export function UnavailableNote({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
      <X size={16} className="mt-0.5 shrink-0" />
      <span>{text}</span>
    </div>
  );
}