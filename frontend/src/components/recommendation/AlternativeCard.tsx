import type { MatchResult } from '../../../../shared/src/types/recommendation';
import { formatMoney } from '../../utils/format';
import { Badge } from '../common/ui';

export function AlternativeCard({ result, index }: { result: MatchResult; index: number }) {
  const item = result.item;
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-white px-3 py-2.5">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <span className="text-xs text-slate-400">{index}.</span>
          <span className="truncate">{item.name}</span>
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {item.dietType === 'veg' && <Badge tone="green">Veg</Badge>}
          {item.dietType === 'vegan' && <Badge tone="green">Vegan</Badge>}
          {item.dietType === 'non-veg' && <Badge tone="red">Non-veg</Badge>}
          {item.prepTime != null && <Badge tone="neutral">{item.prepTime} min</Badge>}
          {result.reasons?.budget && <Badge tone="green">Fits budget</Badge>}
        </div>
      </div>
      <div className="text-right">
        <p className="font-bold text-orange-600">{formatMoney(item.price)}</p>
        <p className="text-xs font-medium text-slate-400">{result.score}% match</p>
      </div>
    </div>
  );
}