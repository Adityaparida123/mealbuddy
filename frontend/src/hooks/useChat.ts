import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage, ChatContext, Role } from '../../../shared/src/types/chat';
import { emptyContext } from '../../../shared/src/types/chat';
import { getRecommendation } from '../../../shared/src/engine';
import type { MenuItem } from '../../../shared/src/types/menu';
import { loadChatHistory, saveChatHistory } from '../services/storage';

const WELCOME =
  "Hi! ðŸ‘‹ I'm Meal Buddy.\n\nTell me what you're craving, your budget, allergies or dietary preferences, and I'll help you find something from today's canteen menu.";

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

// ONE place the welcome message can ever be created: only when there is no
// existing conversation to restore. Runs once, inside a lazy initializer, so
// React StrictMode's double-invocation cannot produce two greetings.
function buildInitialMessages(): ChatMessage[] {
  const history = loadChatHistory<ChatMessage>();
  if (history.length > 0) return history;
  return [createWelcomeMessage()];
}

export function useChat(menu: MenuItem[]) {
  const [messages, setMessages] = useState<ChatMessage[]>(buildInitialMessages);
  const [isBusy, setIsBusy] = useState(false);
  const contextRef = useRef<ChatContext>(emptyContext());

  // Persist whatever the conversation currently is. We never *append* here â€”
  // this only records state that already exists, so a restored conversation is
  // written back verbatim and a fresh one keeps its single welcome message.
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

      try {
        const { recommendation, prefs } = await getRecommendation(trimmed, menu, contextRef.current);

        contextRef.current = {
          cravings: prefs.cravings,
          budget: prefs.budget,
          diet: prefs.diet,
          allergens: prefs.allergens,
          dislikes: prefs.dislikes,
          time: prefs.time,
          mood: prefs.mood,
          lastRecommendationId: recommendation.best?.item.id ?? null,
          lastBestPrice: recommendation.best?.item.price ?? null,
          lastIntents: [],
          answered: prefs.answered,
          lastQuestion: recommendation.clarification?.questionId ?? null,
        };

        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantPendingId
              ? {
                  ...msg,
                  role: 'assistant' as Role,
                  content: recommendation.explanation,
                  recommendation,
                }
              : msg
          )
        );
      } catch (err) {
        const fallbackText = "I couldn't find anything safe right now. Try adjusting your budget or preferences and ask again.";
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantPendingId
              ? { ...msg, role: 'assistant' as Role, content: fallbackText }
              : msg
          )
        );
      } finally {
        setIsBusy(false);
      }
    },
    [menu, isBusy]
  );

  const resetChat = useCallback(() => {
    contextRef.current = emptyContext();
    setMessages([createWelcomeMessage()]);
  }, []);

  return { messages, send, isBusy, resetChat };
}