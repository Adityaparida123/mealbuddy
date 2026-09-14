import type { Recommendation } from './recommendation';

export type Role = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  recommendation?: Recommendation | null;
  timestamp: number;
}

export type ConversationIntent = 'food_recommendation' | 'menu_query' | 'general' | 'greeting';

/**
 * Single source of truth for the current chat conversation's state. It is
 * accumulated on every turn: the client merges the backend's returned state
 * with the user's new message (see backend/src/routes/chat.ts), and the same
 * state is sent back on the next request. This is what lets the chatbot
 * remember "craving = spicy" while the user answers "budget = 150" — it never
 * re-asks for information already captured.
 */
export interface ChatContext {
  cravings: string[];
  budget: number | null;
  diet: string | null;
  allergens: string[];
  dislikes: string[];
  time: number | null;
  mood: string[];
  lastRecommendationId: string | null;
  lastBestPrice: number | null;
  lastIntents: string[];
  answered: string[];
  lastQuestion: string | null;
  availability: boolean;
  conversationIntent: ConversationIntent | null;
}

export const emptyContext = (): ChatContext => ({
  cravings: [],
  budget: null,
  diet: null,
  allergens: [],
  dislikes: [],
  time: null,
  mood: [],
  lastRecommendationId: null,
  lastBestPrice: null,
  lastIntents: [],
  answered: [],
  lastQuestion: null,
  availability: false,
  conversationIntent: null,
});