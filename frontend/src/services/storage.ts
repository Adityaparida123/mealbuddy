const MENU_STORAGE_KEY = 'mealbuddy.menu.v1';
const CHAT_STORAGE_KEY = 'mealbuddy.chat.v1';

export function loadMenuFromStorage<T>(seed: T): T {
  try {
    const raw = localStorage.getItem(MENU_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as T;
    }
  } catch {
    /* ignore corrupt storage */
  }
  return seed;
}

export function saveMenuToStorage<T>(items: T): void {
  try {
    localStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* storage full – best-effort */
  }
}

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