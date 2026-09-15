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

// Word-boundary keyword matching. A keyword must start a word (a word is broken
// only by non-word characters), so the allergy keyword "nut" NEVER matches the
// word "minutes" — that false positive used to hijack "I have 10 minutes" into
// the allergen knowledge answer. Suffixes are allowed ("hour" -> "hours",
// "allerg" -> "allergens", "pay" -> "payment").
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function keywordRegex(kw: string): RegExp {
  const tokens = kw.split(/\s+/).filter(Boolean);
  if (tokens.length === 1) {
    return new RegExp(`\\b${escapeRe(tokens[0])}\\w*\\b`, 'i');
  }
  return new RegExp(
    tokens
      .map((t, i) => (i === tokens.length - 1 ? `\\b${escapeRe(t)}\\w*\\b` : `\\b${escapeRe(t)}\\b`))
      .join('\\s+'),
    'i'
  );
}

export function answerKnowledge(query: string): string | null {
  const q = query.toLowerCase();
  const hits = KNOWLEDGE
    .map(r => ({
      r,
      score: r.keywords.reduce((n, kw) => {
        const m = q.match(new RegExp(keywordRegex(kw).source, 'gi'));
        return n + (m ? m.length : 0);
      }, 0),
    }))
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

const INTERROGATIVE_RE =
  /^(what|whats|which|when|where|why|how|who|whose|is|are|can|could|does|do|will|would|should|was|were)\b|(\?$|\?)|\bhow\s+(do|can|does)\s+|(what|when|where|how|which)\s+(is|are|was|were|do|does|have|can)\b|do you (have|accept|take|list)|tell me (about|the)|i want to know|can you (tell|help|list|share)/i;

/**
 * A knowledge question is an EXPLICIT interrogative that also hits the
 * knowledge base. It must be a real question, never a preference fragment:
 *   "What allergens are in today's menu?"  -> true  (RAG)
 *   "How do I avoid dairy?"                 -> true  (RAG)
 *   "when does lunch start?"                -> true  (RAG)
 *   "I have 10 minutes"                     -> false (food continuation)
 *   "₹100" / "vegetarian" / "no dairy"      -> false (food continuation)
 * This is what keeps active food conversations routing to the menu engine —
 * a craving/budget/time/allergy answer to a pending question must NEVER be
 * swallowed by the knowledge gate.
 */
export function isExplicitKnowledgeQuestion(query: string): boolean {
  const lower = query.toLowerCase().trim();
  if (!lower) return false;
  if (!INTERROGATIVE_RE.test(lower)) return false;
  return answerKnowledge(query) !== null;
}
