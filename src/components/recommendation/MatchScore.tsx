import type { MatchReasons } from '../../types/recommendation';

export function MatchScore({ score, reasons }: { score: number; reasons?: MatchReasons }) {
  const width = Math.max(score >= 0 ? score : 0, 0);

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="text-amber-500">★</span> Match
        </span>
        <span className="font-semibold text-slate-700">{score}%</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}