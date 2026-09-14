import type { Recommendation } from './recommendation';

export type Role = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  recommendation?: Recommendation | null;
  timestamp: number;
}

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
});