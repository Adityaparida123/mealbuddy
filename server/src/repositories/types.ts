import type { MenuItem } from '../../../src/types/menu';

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'STUDENT' | 'COOK';
  createdAt: string;
}

export interface FoodProfileRecord {
  userId: string;
  allergens: string[];
  dislikes: string[];
  diet: string | null;
  budget: number | null;
  updatedAt: string;
}

export interface FavoriteRecord {
  userId: string;
  menuItemId: string;
  createdAt: string;
}

export interface ConversationRecord {
  id: string;
  userId: string;
  messages: ChatMessageRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageRecord {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface MenuStore {
  listMenu(): Promise<MenuItem[]>;
  getMenuItem(id: string): Promise<MenuItem | null>;
  createMenuItem(item: MenuItem): Promise<MenuItem>;
  updateMenuItem(id: string, patch: Partial<MenuItem>): Promise<MenuItem | null>;
  deleteMenuItem(id: string): Promise<boolean>;
  setAvailability(id: string, available: boolean): Promise<MenuItem | null>;
}

export interface UserStore {
  createUser(u: {
    id: string; name: string; email: string; passwordHash: string; role?: 'STUDENT' | 'COOK';
  }): Promise<UserRecord>;
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  updateFoodProfile(userId: string, patch: Partial<FoodProfileRecord>): Promise<FoodProfileRecord>;
  getFoodProfile(userId: string): Promise<FoodProfileRecord | null>;
  addFavorite(userId: string, menuItemId: string): Promise<void>;
  removeFavorite(userId: string, menuItemId: string): Promise<void>;
  listFavorites(userId: string): Promise<string[]>;
  createConversation(userId: string): Promise<string>;
  addMessage(conversationId: string, msg: ChatMessageRecord): Promise<void>;
  listConversation(conversationId: string): Promise<ConversationRecord | null>;
}