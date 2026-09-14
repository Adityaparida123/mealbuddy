import type { Clarification } from '../../types/recommendation';

export function QuestionOptions({
  clarification,
  onAnswer,
  disabled,
}: {
  clarification: Clarification;
  onAnswer: (payload: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="ml-10 flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {clarification.options.map(opt => (
          <button
            key={opt.label}
            disabled={disabled}
            onClick={() => onAnswer(opt.payload)}
            className="rounded-full border border-brand-300 bg-white px-3.5 py-2 text-sm font-semibold text-brand-600 shadow-sm transition hover:bg-brand-50 disabled:opacity-50"
          >
            {opt.label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-slate-400">Tap an option, or just type your answer.</p>
    </div>
  );
}