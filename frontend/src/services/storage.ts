const CHAT_STORAGE_KEY = 'mealbuddy.chat.v1';

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