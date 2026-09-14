import { useEffect, useRef } from 'react';
import type { ChatMessage as ChatMessageType } from '../../../../shared/src/types/chat';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { QuickChips } from './QuickChips';

export function ChatWindow({
  messages,
  onSend,
  isBusy,
  header,
}: {
  messages: ChatMessageType[];
  onSend: (text: string) => void;
  isBusy: boolean;
  header: React.ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-orange-50/60 shadow-sm">
      {header}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.map(msg => (
          <ChatMessage key={msg.id} message={msg} onAnswerQuestion={onSend} isBusy={isBusy} />
        ))}
      </div>
      <div className="space-y-2 border-t border-slate-200 bg-white px-3 py-3">
        <QuickChips onSend={onSend} />
        <ChatInput onSend={onSend} disabled={isBusy} />
      </div>
    </div>
  );
}