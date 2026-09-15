import type { ChatMessage as ChatMessageType } from '../../../../shared/src/types/chat';
import { RecommendationCard } from '../recommendation/RecommendationCard';
import { AlternativeCard } from '../recommendation/AlternativeCard';
import { AlertTriangle } from 'lucide-react';
import { QuestionOptions } from './QuestionOptions';

export function ChatMessage({
  message,
  onAnswerQuestion,
  isBusy,
}: {
  message: ChatMessageType;
  onAnswerQuestion?: (payload: string) => void;
  isBusy?: boolean;
}) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-line rounded-2xl rounded-br-sm bg-brand-500 px-4 py-2.5 text-sm text-white shadow-sm">
          {message.content}
        </div>
      </div>
    );
  }

  const rec = message.recommendation;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-base">
          🍱
        </div>
        <div className="max-w-[92%]">
          {message.content === '...' ? (
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-white px-4 py-3 text-sm text-slate-400 shadow-sm">
              <span className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-brand-300" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-brand-300 [animation-delay:120ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-brand-300 [animation-delay:240ms]" />
              </span>
              Meal Buddy is thinking…
            </div>
          ) : (
            <div className="rounded-2xl rounded-bl-sm bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
              <p className="whitespace-pre-line">{message.content}</p>
            </div>
          )}
        </div>
      </div>

      {rec && rec.clarification && (
        <QuestionOptions
          clarification={rec.clarification}
          onAnswer={payload => onAnswerQuestion?.(payload)}
          disabled={Boolean(isBusy)}
        />
      )}

      {rec && rec.best && !rec.clarification && (
        <div className="ml-10 flex flex-col gap-2">
          {rec.budgetRescue?.desired && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <span>
                <strong>{rec.budgetRescue.desired.name}</strong> is{' '}
                {rec.budgetRescue.desired.price} that's over your budget — so it's not
                recommended, but here are safe options that fit:
              </span>
            </div>
          )}
          <RecommendationCard result={rec.best} />
          {rec.alternatives.length > 0 && (
            <div className="mt-1">
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
                Other options
              </p>
              <div className="flex flex-col gap-1.5">
                {rec.alternatives.map((alt, i) => (
                  <AlternativeCard key={alt.item.id} result={alt} index={i + 1} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {rec && rec.noSafeMatch === true && (
        <div className="ml-10 flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 shadow-sm">
          <span className="text-base">😅</span>
          <span>{rec.explanation}</span>
        </div>
      )}
    </div>
  );
}