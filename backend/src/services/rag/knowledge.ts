// Lightweight, deterministic RAG knowledge gate. Answers come from a static
// knowledge base of canteen facts. If nothing matches, returns null and the
// caller falls back to the menu engine; in live-AI mode the provider may
// elaborate, but grounding stays deterministic.
export interface KnowledgeRow {
  topic: string;
  keywords: string[];
  answer: string;
}

export const KNOWLEDGE: KnowledgeRow[] = [
  {
    topic: 'hours',
    keywords: ['hour', 'timing', 'open', 'close', 'time', 'when', 'breakfast', 'lunch', 'dinner'],
    answer: 'MealBuddy canteen hours: Breakfast 08:00-10:30, Lunch 11:30-14:30, Snacks 16:00-17:30, Dinner 19:00-21:00.',
  },
  {
    topic: 'location',
    keywords: ['where', 'located', 'location', 'building', 'block'],
    answer: 'The MealBuddy food court is in the Academic Block, ground floor, near the library entrance.',
  },
  {
    topic: 'payment',
    keywords: ['pay', 'payment', 'card', 'cash', 'upi', 'wallet'],
    answer: 'We accept UPI, debit/credit cards, and the campus meal card. Cash is not accepted.',
  },
  {
    topic: 'allergy-safety',
    keywords: ['allerg', 'allergy', 'nut', 'peanut', 'gluten', 'dairy', 'safe'],
    answer: 'Every menu item lists its allergens and dietary flags. Nut, peanut, dairy, egg and gluten items are clearly tagged and cross-contamination is avoided in prep.',
  },
  {
    topic: 'customization',
    keywords: ['custom', 'change', 'less spicy', 'no onion', 'no garlic', 'extra'],
    answer: 'Most cooked-to-order items can be customized (spice level, on/off onion-garlic) at the counter — just ask.',
  },
  {
    topic: 'reward',
    keywords: ['reward', 'discount', 'coupon', 'offer', 'free'],
    answer: 'Weekly student rewards: 10% off on veg days, a free Masala Dosa on your 10th order. Offers are shown on the Student dashboard.',
  },
];

export function answerKnowledge(query: string): string | null {
  const q = query.toLowerCase();
  const hits = KNOWLEDGE
    .map(r => ({ r, score: r.keywords.filter(k => q.includes(k)).length }))
    .filter(h => h.score > 0)
    .sort((a, b) => b.score - a.score);
  if (hits.length === 0) return null;
  return hits[0].r.answer;
}

export interface RagOutcome {
  kind: 'knowledge' | 'engine' | 'none';
  answer?: string;
}

export function gateRag(query: string): RagOutcome {
  const k = answerKnowledge(query);
  if (k) return { kind: 'knowledge', answer: k };
  return { kind: 'none' };
}