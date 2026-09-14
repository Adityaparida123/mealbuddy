const CHAT_STORAGE_KEY = 'mealbuddy.chat.v1';
const CHAT_STATE_STORAGE_KEY = 'mealbuddy.chat-state.v1';

export function loadChatHistory<T>(): T[] {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as T[];
    }
  } catch {
    /* ignore corrupt storage */
  }
  return [];
}

export function saveChatHistory<T>(messages: T[]): void {
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
  } catch {
    /* storage full – best-effort */
  }
}

/**
 * The conversation state (craving, budget, allergens, answered questions, …)
 * is persisted per-browser alongside the chat history so a page reload does
 * not reset the conversation's memory.
 */
export function loadChatState<T>(): T | null {
  try {
    const raw = localStorage.getItem(CHAT_STATE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed as T;
    }
  } catch {
    /* ignore corrupt storage */
  }
  return null;
}

export function saveChatState<T>(state: T | null): void {
  try {
    if (state == null) {
      localStorage.removeItem(CHAT_STATE_STORAGE_KEY);
    } else {
      localStorage.setItem(CHAT_STATE_STORAGE_KEY, JSON.stringify(state));
    }
  } catch {
    /* storage full – best-effort */
  }
}

export function clearChatStorage(): void {
  try {
    localStorage.removeItem(CHAT_STORAGE_KEY);
    localStorage.removeItem(CHAT_STATE_STORAGE_KEY);
  } catch {
    /* best-effort */
  }
}