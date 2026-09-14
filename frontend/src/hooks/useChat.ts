import { useCallback, useEffect, useState } from 'react';
import type { ChatMessage, Role } from '../../../shared/src/types/chat';
import { ApiError, chatApi } from '../services/api';
import { loadChatHistory, saveChatHistory } from '../services/storage';

const WELCOME =
  "Hi! 👋 I'm Meal Buddy.\n\nTell me what you're craving, your budget, allergies or dietary preferences, and I'll help you find something from today's canteen menu.";

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createWelcomeMessage(): ChatMessage {
  return {
    id: makeId(),
    role: 'assistant' as Role,
    content: WELCOME,
    timestamp: Date.now(),
  };
}

// One place the welcome message can ever be created: only when there is no
// existing conversation to restore. Runs once, inside a lazy initializer.
function buildInitialMessages(): ChatMessage[] {
  const history = loadChatHistory<ChatMessage>();
  if (history.length > 0) return history;
  return [createWelcomeMessage()];
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(buildInitialMessages);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Chat history is a per-browser convenience (a local draft of the user's own
  // conversation) — the source of truth for recommendations is the backend.
  useEffect(() => {
    saveChatHistory(messages);
  }, [messages]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isBusy) return;

      const userMsg: ChatMessage = {
        id: makeId(),
        role: 'user',
        content: trimmed,
        timestamp: Date.now(),
      };

      const assistantPendingId = makeId();
      setMessages(prev => [
        ...prev,
        userMsg,
        {
          id: assistantPendingId,
          role: 'assistant' as Role,
          content: '...',
          timestamp: Date.now(),
        },
      ]);
      setIsBusy(true);
      setError(null);

      try {
        const reply = await chatApi.send(trimmed);

        if (reply.kind === 'knowledge') {
          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantPendingId
                ? { ...msg, role: 'assistant' as Role, content: reply.answer }
                : msg
            )
          );
        } else {
          const rec = reply.recommendation;
          const content = rec?.explanation
            ? rec.explanation
            : rec?.clarification
              ? rec.clarification.text
              : rec?.best
                ? "Here is the best match from today's menu."
                : "I couldn't find anything safe right now. Try adjusting your budget or preferences and ask again.";
          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantPendingId
                ? { ...msg, role: 'assistant' as Role, content, recommendation: rec ?? null }
                : msg
            )
          );
        }
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : 'Unable to connect to Meal Buddy server.';
        setError(message);
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantPendingId
              ? { ...msg, role: 'assistant' as Role, content: message }
              : msg
          )
        );
      } finally {
        setIsBusy(false);
      }
    },
    [isBusy]
  );

  const resetChat = useCallback(() => {
    setError(null);
    setMessages([createWelcomeMessage()]);
  }, []);

  return { messages, send, isBusy, resetChat, error };
}