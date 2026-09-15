import type { ChatContext } from '../types/chat';

export type ChatIntent = 'food_recommendation' | 'menu_query' | 'general' | 'greeting';

// ─────────────────────────── text helpers ───────────────────────────

function strip(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function tokensOf(s: string): string[] {
  return strip(s).split(/\s+/).filter(Boolean);
}

function sing(w: string): string {
  if (w.length <= 3) return w;
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  if (w.endsWith('ves') && w.length > 4) return w.slice(0, -3) + 'f';
  if (w.endsWith('es') && w.length > 4) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

export function eqToken(a: string, b: string): boolean {
  return a === b || sing(a) === b || a === sing(b) || sing(a) === sing(b);
}

// ─────────────────────────── vocabularies ───────────────────────────

const CRAVING_WORDS = [
  'spicy', 'hot', 'spiced', 'peppery', 'garlicky',
  'sweet', 'sugary', 'sour', 'tangy', 'salty',
  'crispy', 'crisp', 'crunchy', 'cheesy', 'creamy', 'juicy', 'smoky', 'buttery',
  'soft', 'cold', 'iced', 'chilled', 'warm', 'fresh',
  'light', 'heavy', 'filling', 'healthy', 'refreshing', 'savory', 'savoury',
  'mild', 'rich',
];

const MOOD_WORDS = [
  'comfort', 'comforting', 'cozy', 'calm', 'relax', 'relaxing',
  'energy', 'energizing', 'indulgent', 'fun', 'satisfying', 'hearty', 'feel-good',
];

const GENERIC_FOOD_WORDS: ReadonlySet<string> = new Set([
  'something', 'anything', 'food', 'meal', 'snack', 'drink', 'beverage', 'dessert', 'starter',
  'breakfast', 'lunch', 'dinner', 'sweet', 'mains', 'sides', 'combo', 'plate', 'dish', 'bite',
]);

/**
 * Semantic craving attributes the recommendation engine actually matches
 * against structured menu fields (tags / mood / spiceLevel / calories /
 * ingredients). `isAttributeWord` is what keeps gravitational fill words like
 * "paneer" or "roll" out of the tag-scoring count: a taste/mood attribute is a
 * dictionary word that map item-to-item semantics, not a specific food.
 */
const ATTRIBUTE_WORDS: ReadonlySet<string> = new Set([
  ...CRAVING_WORDS,
  ...MOOD_WORDS,
  'veg', 'vegetarian', 'vegan', 'non-veg', 'nonveg', 'meat', 'gluten-free', 'glutenfree',
  'spice', 'spices', 'spiced', 'fried', 'substantial', 'sweet', 'savoury', 'boost', 'wake',
]);

export function isAttributeWord(t: string): boolean {
  return ATTRIBUTE_WORDS.has(t.toLowerCase().trim());
}

/**
 * Conversational filler that carries NO food meaning on its own. These words
 * are stripped from intent phrases and never become part of a craving or food
 * query, so "to eat something spicy" normalizes to "spicy" instead of being
 * treated as the requested dish. No entry here is a real food/ingredient word,
 * so stripping is safe (see FOOD_WORDS for the vocabulary that is preserved).
 */
const FILLER_WORDS: ReadonlySet<string> = new Set([
  // verb particles & inflected desire verbs
  'to', 'of', 'eat', 'eating', 'eats', 'have', 'having', 'get', 'getting', 'grab', 'grabbing',
  'order', 'ordering', 'buy', 'taking', 'bring', 'want', 'wanted', 'wants', 'wanting',
  'need', 'needed', 'needs', 'needing', 'would', 'could', 'will', 'should', 'like', 'liked',
  'craving', 'crave', 'cravings', 'craves', 'hungry', 'hungrier', 'feel', 'feeling', 'felt',
  'looking', 'look', 'find', 'recommend', 'suggest', 'recommendation', 'suggestions',
  // budget/time markers that must never leak into a food name
  'under', 'below', 'only', 'within', 'around', 'about', 'max', 'limit', 'budget', 'over',
  'less', 'than', 'more', 'rupee', 'rupees', 'rs',
  // function words
  'me', 'us', 'my', 'your', 'a', 'an', 'the', 'some', 'any', 'i', "i'm", 'im', "i'd", "i'll",
  'just', 'also', 'still', 'really', 'quite', 'very', 'please', 'now', 'today', 'tonight',
]);

const CRAVING_TRIGGER_RE =
  /\b(want|wanted|need|like|crave|craving|hangry|hungry|feel like|would like|i'?d like|looking for|hungry for|wish|order|give me|get me|recommend|suggest|desire)\b/i;

/**
 * A token counts as a "meaningful food token" only when it is neither
 * conversational filler nor a generic noun nor a taste/mood attribute. This is
 * what keeps raw sentence fragments ("to", "eat", "something") out of the food
 * query while still letting real dishes through ("paneer", "noodles", "pizza").
 */
export function isMeaningfulFoodToken(t: string): boolean {
  if (!t || t.length <= 1) return false;
  if (/\d/.test(t)) return false;
  return (
    !NON_FOOD_TOKENS.has(t) &&
    !FILLER_WORDS.has(t) &&
    !GENERIC_FOOD_WORDS.has(t) &&
    !CRAVING_WORDS.includes(t) &&
    !MOOD_WORDS.includes(t)
  );
}

const FOOD_WORDS = [
  'biryani', 'roll', 'dosa', 'thali', 'samosa', 'chikki', 'lassi', 'sandwich',
  'bhature', 'chole', 'curry', 'paneer', 'chicken', 'mutton', 'egg', 'prawn', 'fish',
  'rice', 'dal', 'roti', 'bread', 'coffee', 'tea', 'salad', 'noodles', 'pizza',
  'burger', 'pasta', 'bowl', 'juice', 'chocolate', 'brownie', 'fries', 'cake',
  'toast', 'idli', 'vada', 'pulao', 'khichdi', 'paratha', 'lassi', 'milk', 'butter', 'cheese',
  'quinoa', 'chickpeas', 'veggies', 'fruits', 'masala', 'curd', 'yogurt', 'gulab', 'jamun',
];

const NEG_RE = /(\bno\b|not|n't|never|without|avoid|skip|stop|exclude|don'?t|do not|can'?t|cannot|won'?t|except|instead of|less of)/i;

const NEG_STRONG_RE = /(\bno\b|not|n't|never|without|avoid|skip|don'?t|do not|can'?t|cannot|won'?t|except|instead of)/i;

// ─────────────────────────── allergy aliases ───────────────────────────

const ALLERGY_PATTERNS: { canonical: string; re: RegExp }[] = [
  { canonical: 'nuts', re: /\b(peanuts?|groundnuts?|ground\s+nuts?|tree\s+nuts?|almonds?|walnuts?|cashews?|pistachios?|hazelnuts?|pista|nuts?)\b/i },
  { canonical: 'dairy', re: /\b(dairy|milk|lactose|butter|cheese|paneer|yogurt|yoghurt|curd|ghee|cream)\b/i },
  { canonical: 'egg', re: /\b(eggs?|mayo|mayonnaise|albumen)\b/i },
  { canonical: 'gluten', re: /\b(gluten|wheat)\b/i },
  { canonical: 'soy', re: /\b(soy|soya|soybean|tofu)\b/i },
  { canonical: 'fish', re: /\bfishes?\b/i },
  { canonical: 'shellfish', re: /\b(shellfish|shrimp|prawns?|crabs?|lobster|crayfish)\b/i },
  { canonical: 'sesame', re: /\b(sesame|tahini)\b/i },
  { canonical: 'mustard', re: /\bmustard\b/i },
];

const ALLERGY_TRIGGER_RE = /\b(allergic|allergy|allergies|intolerant|intolerance)\b/i;

// ─────────────────────────── budget / time ───────────────────────────

const TIME_RE = /(\d{1,4})\s*(?:min|mins|minute|minutes)\b/i;

function extractBudget(lower: string): number | null {
  const notTime = '(?!\\s*(?:min|mins|minute|minutes|hour|hr)\\b)';
  const digits = '(\\d{1,5})(?![.,]?\\d)';
  const patterns: RegExp[] = [
    new RegExp(`(?:under|below|less than|at most|at max|max(?:imum)?|within|around|about)\\s*(?:of\\s+)?(?:₹|rs\\.?|inr)?\\s*${digits}${notTime}`, 'i'),
    new RegExp(`(?:under|below|less than|at most|within|around|about)\\s*(?:of\\s+)?${digits}\\s*(?:₹|rs\\.?|rupees|inr)`, 'i'),
    new RegExp(`(?:my\\s+)?budget(?:\\s+(?:is|of|at))?\\s*(?:₹|rs\\.?|inr)?\\s*${digits}${notTime}`, 'i'),
    new RegExp(`(?:₹|rs\\.?|inr)\\s*${digits}${notTime}`, 'i'),
    new RegExp(`(?:only|have|spend|limit|keep it)\\s*(?:₹|rs\\.?|inr)?\\s*${digits}${notTime}`, 'i'),
    new RegExp(`${digits}\\s*(?:₹|rs\\.?|rupees)`, 'i'),
  ];
  for (const re of patterns) {
    const m = lower.match(re);
    if (m) {
      const v = parseInt(m[1], 10);
      if (v > 0 && v < 10000) return v;
    }
  }
  return null;
}

function extractTime(lower: string): number | null {
  const m = lower.match(TIME_RE);
  if (m) {
    const v = parseInt(m[1], 10);
    if (v > 0 && v < 600) return v;
  }
  return null;
}

// ─────────────────────────── clause helpers ───────────────────────────

function splitClauses(lower: string): string[] {
  return lower.split(/\s+but\s+|[.!?,;]/).map(s => s.trim()).filter(Boolean);
}

function isNegative(c: string): boolean {
  return NEG_STRONG_RE.test(c);
}

function hasAnyWord(c: string, words: string[]): string[] {
  const out: string[] = [];
  for (const w of words) {
    if (new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(c)) out.push(w);
  }
  return out;
}

// ─────────────────────────── diet ───────────────────────────

const DIET_RE: { diet: string; re: RegExp }[] = [
  { diet: 'vegan', re: /\bvegan\b/i },
  { diet: 'vegetarian', re: /\bvegetarian\b|\bveg\b|\bveg\s+only\b|\bonly\s+veg\b/i },
  { diet: 'non-veg', re: /\bnon[- ]?veg(?:etarian)?\b|\bmeat(?:y)?\b|\bnon[- ]?vegetarian\b/i },
  { diet: 'gluten-free', re: /\bgluten[- ]?free\b/i },
];

function extractDiet(clauses: string[]): { diet: string | null; wantsVegRefine: boolean } {
  let diet: string | null = null;
  let wantsVegRefine = false;
  for (const c of clauses) {
    if (isNegative(c)) continue;
    if (/no\s+non[- ]?veg|no\s+meat|not\s+non[- ]?veg/i.test(c)) {
      diet = 'vegetarian';
      wantsVegRefine = true;
      continue;
    }
    for (const { diet: d, re } of DIET_RE) {
      if (re.test(c)) {
        diet = d;
        if (d === 'vegetarian') wantsVegRefine = true;
      }
    }
  }
  return { diet, wantsVegRefine };
}

// ─────────────────────────── allergies ───────────────────────────

function extractAllergies(clauses: string[]): string[] {
  const found = new Set<string>();
  for (const c of clauses) {
    const hasTrigger = ALLERGY_TRIGGER_RE.test(c);
    const neg = isNegative(c);
    if (!hasTrigger && !neg) continue;
    for (const { canonical, re } of ALLERGY_PATTERNS) {
      if (re.test(c)) found.add(canonical);
    }
  }
  return [...found];
}

// ─────────────────────────── craving / mood / dislikes ───────────────────────────

function extractTastes(clauses: string[]): { cravings: string[]; dislikes: string[] } {
  const cravings: string[] = [];
  const dislikes: string[] = [];
  for (const c of clauses) {
    if (isNegative(c)) {
      dislikes.push(...hasAnyWord(c, CRAVING_WORDS));
      dislikes.push(...hasAnyWord(c, MOOD_WORDS));
    } else {
      // mood words ("comfort", "energizing") are legitimate cravings too —
      // "I want comfort food" must normalize to craving = comfort.
      cravings.push(...hasAnyWord(c, CRAVING_WORDS));
      cravings.push(...hasAnyWord(c, MOOD_WORDS));
    }
  }
  return { cravings: [...new Set(cravings)], dislikes: [...new Set(dislikes)] };
}

/**
 * Food-name cravings ("I'm craving noodles", "I want paneer"). These are real
 * dishes, so they are preserved (unlike conversational filler) and carried in
 * `cravings` so the state model, the "what are you craving?" answer tracking
 * and the matcher all see them. Only triggered when the user clearly asks for
 * food so a bare mention ("do you sell noodles?") is not misread as a craving.
 */
function extractFoodWordCravings(clauses: string[]): string[] {
  const out: string[] = [];
  const positiveText = clauses.filter(c => !isNegative(c)).join(' ');
  if (!CRAVING_TRIGGER_RE.test(positiveText)) return out;
  for (const fw of FOOD_WORDS) {
    if (new RegExp(`\\b${fw}\\b`, 'i').test(positiveText) && !out.includes(fw)) out.push(fw);
  }
  return out;
}

// ─────────────────────────── food request ───────────────────────────

const FOOD_INTENT_RE =
  /(?:i(?:'d| would|'ll| will)?\s*)?(?:want|crave|could eat|feel like|looking for|need|hungry for|order|eat|have|get|grab|recommend|suggest)\s+(?:the|a|an|some|any|some|something|anything)\s+(.+)$/;

const FOOD_INTENT_PREFIX_RE =
  /(?:i(?:'d| would|'ll| will)?\s*)?(?:want|crave|could eat|feel like|looking for|need|hungry for|order|eat|have|get|grab|recommend|suggest|would like)\s+(.+)$/;

const NON_FOOD_TOKENS: ReadonlySet<string> = new Set([
  ...CRAVING_WORDS,
  ...MOOD_WORDS,
  'something', 'anything', 'any', 'food', 'meal', 'snack', 'drink', 'beverage', 'dessert',
  'please', 'under', 'below', 'cheaper', 'cheap', 'only', 'have', 'within', 'minutes',
  'veg', 'non', 'vegetarian', 'vegan', 'nonveg', 'meat', 'meaty', 'gluten', 'free', 'glutenfree',
  'i', "i'm", 'im', 'm', 'my', 'and', 'with', 'for', 'in', 'at', 'now', 'a', 'an', 'the', 'some', 'but',
]);

function cleanFoodPhrase(phrase: string): string {
  let p = strip(phrase);
  p = p
    .replace(/\b(?:please|now|today|right now|asap|quickly)\b/g, ' ')
    .replace(/\b(?:under|below|less than|at most|around|about|within|only|max|limit|budget)\s*(?:of|is|at)?\s*(?:rs\.?|inr)?\s*\d+/gi, ' ')
    .replace(/\b(?:rs\.?|inr)\s*\d+/gi, ' ')
    .replace(/\d+\s*(?:rs\.?|₹)/gi, ' ')
    .replace(/\d+\s*(?:min|mins|minute|minutes)\b/gi, ' ')
    .replace(/\b(?:and|or|with|but)\b/g, ' ');
  // Drop conversational filler and generic nouns — NEVER food names. This is
  // what turns "to eat something spicy" into "spicy" and "comfort food" into
  // "comfort" instead of treating the raw sentence as the requested dish.
  p = p
    .split(/\s+/)
    .filter(t => t && !FILLER_WORDS.has(t) && !NON_FOOD_TOKENS.has(t) && !GENERIC_FOOD_WORDS.has(t))
    .join(' ');
  p = p.replace(/\s+/g, ' ').trim();
  return p;
}

function extractFoodQuery(clauses: string[]): {
  foodQuery: string[];
  wantedFood: string | null;
  foodRequestLike: boolean;
} {
  const foodTokens: string[] = [];
  let wantedFood: string | null = null;
  let foodRequestLike = false;

  for (const c of clauses) {
    if (isNegative(c)) continue;
    let m = c.match(FOOD_INTENT_RE);
    if (!m) m = c.match(FOOD_INTENT_PREFIX_RE);
    if (!m) continue;
    let phrase = cleanFoodPhrase(m[1]);
    if (!phrase) continue;
    if (/\blike\b/.test(' ' + phrase + ' ')) foodRequestLike = true;
    phrase = phrase.replace(/\blike\b/g, ' ').replace(/\s+/g, ' ').trim();
    if (!phrase) continue;
    // Keep only real dishes — never "to eat something spicy"/"eating something
    // spicy" raw fragments. wantedFood stays null when the user only expressed
    // a taste attribute, so the diagnostics never say "Spicy isn't available".
    const real = tokensOf(phrase).filter(t => isMeaningfulFoodToken(t) && FOOD_WORDS.includes(t));
    if (real.length === 0) continue;
    if (!wantedFood) wantedFood = real.join(' ');
    for (const t of real) {
      if (!foodTokens.includes(t)) foodTokens.push(t);
    }
  }

  // menu/system word scan (catches "Chicken Biryani please", "roll please" etc.)
  // only in clauses that are NOT negated, so "avoid chicken" never becomes a craving
  const positiveText = clauses.filter(c => !isNegative(c)).join(' ');
  for (const fw of FOOD_WORDS) {
    if (new RegExp(`\\b${fw}\\b`, 'i').test(positiveText)) {
      if (!foodTokens.includes(fw)) foodTokens.push(fw);
    }
  }
  for (const g of ['meal', 'snack', 'dessert', 'beverage', 'drink', 'starter']) {
    if (new RegExp(`\\b${g}\\b`, 'i').test(positiveText) && !foodTokens.includes(g)) foodTokens.push(g);
  }

  return { foodQuery: foodTokens, wantedFood, foodRequestLike };
}

// ─────────────────────────── intent classification ───────────────────────────

function extractFoodDislikes(clauses: string[], diet: string | null): string[] {
  const out: string[] = [];
  for (const c of clauses) {
    if (!isNegative(c)) continue;
    const toks = tokensOf(c.replace(/\b(?:no|not|never|without|avoid|don'?t|do|can'?t|cannot|won'?t|except|instead)\b/g, ' '));
    for (const t of toks) {
      if (t.length <= 2) continue;
      if (NON_FOOD_TOKENS.has(t) || GENERIC_FOOD_WORDS.has(t)) continue;
      if (FOOD_WORDS.includes(t)) out.push(t);
    }
    out.push(...hasAnyWord(c, CRAVING_WORDS));
  }
  return [...new Set(out)];
}

export function classifyIntent(
  lower: string,
  prefs: Omit<ExtractedPrefs, 'intent' | 'isGreeting' | 'isGeneralConversation' | 'isMenuQuery'>
): ChatIntent {
  const hasFoodSignal =
    prefs.hasFoodRequest ||
    Boolean(prefs.diet) ||
    prefs.allergens.length > 0 ||
    prefs.budget != null ||
    prefs.time != null ||
    prefs.cravings.length > 0 ||
    prefs.foodQuery.length > 0 ||
    /\b(food|menu|canteen|eat|snack|meal|hungry|craving|drink|beverage|dessert|noodles|biryani|sandwich|coffee|tea|lunch|dinner|canteen)\b/i.test(lower);

  const isMenuQuery =
    /\b(available|menu|what\s+(?:do you have|do we have|can i have|can i get)|what'?s?\s+(?:available|on)|show\s+(?:me\s+)?(?:today'?s\s+)?menu)\b/i.test(lower) &&
    !/want|crave|feel like|hungry for/i.test(lower);

  if (isMenuQuery) return 'menu_query';

  const isGreeting =
    /^(hi|hello|hey|yo|sup|howdy|good morning|good afternoon|good evening|namaste|hola)\b/i.test(lower.trim()) &&
    lower.split(/\s+/).length < 6;

  if (isGreeting && !hasFoodSignal) return 'greeting';

  const isGeneral =
    /\b(who is|who was|what is the|what's the|when|where is|why|how do|how to|define|explain|meaning of|capital of|history of|prime minister|president|weather|news|cricket|movie|song|homework|maths?|science|football)\b/i.test(lower) &&
    !hasFoodSignal;

  if (isGeneral) return 'general';

  if (hasFoodSignal) return 'food_recommendation';

  if (/should i eat|what to eat|recommend|suggest|\bskip\b/i.test(lower)) return 'food_recommendation';

  if (/(^|\s)(who|what|when|where|why|how)\b/.test(lower)) return 'general';

  return 'food_recommendation';
}

// ─────────────────────────── public types ───────────────────────────

export interface ExtractedPrefs {
  message: string;
  lowerMessage: string;
  intent: ChatIntent;
  budget: number | null;
  time: number | null;
  diet: string | null;
  allergens: string[];
  cravings: string[];
  dislikes: string[];
  mood: string[];
  foodQuery: string[];
  wantedFood: string | null;
  foodRequestLike: boolean;
  wantsCheaper: boolean;
  wantsFaster: boolean;
  wantsVegRefine: boolean;
  wantsAvailability: boolean;
  isGreeting: boolean;
  isGeneralConversation: boolean;
  isMenuQuery: boolean;
  hasFoodRequest: boolean;
  answered: string[];
}

// ─────────────────────────── main extraction ───────────────────────────

export function extractUserPreferences(message: string, context?: ChatContext): ExtractedPrefs {
  const normalized = message
    .replace(/[\u2018\u2019\u201A\u00B4]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2013|\u2014/g, ' ');
  const lowerMessage = normalized.toLowerCase();
  const clauses = splitClauses(lowerMessage);

  const budget = extractBudget(lowerMessage);
  const time = extractTime(lowerMessage);
  const { diet, wantsVegRefine } = extractDiet(clauses);

  const allergies = extractAllergies(clauses);
  const { cravings, dislikes: tasteDislikes } = extractTastes(clauses);
  const foodWordCravings = extractFoodWordCravings(clauses);
  const allCravings = [...new Set([...cravings, ...foodWordCravings])];
  const { foodQuery, wantedFood, foodRequestLike } = extractFoodQuery(clauses);

  const foodDislikes = extractFoodDislikes(clauses, diet);
  const dislikes = [...new Set([...tasteDislikes, ...foodDislikes])];

  const mood: string[] = [];
  for (const c of clauses) {
    if (isNegative(c)) continue;
    mood.push(...hasAnyWord(c, MOOD_WORDS));
  }

  const wantsCheaper = /\b(cheaper|cheap(?:er|est)?|less expensive|affordable|lower price|budget|save)\b/i.test(lowerMessage);
  const wantsFaster = /\b(faster|quicker|quick(?:ly)?|hurry|asap|right away|soon)\b/i.test(lowerMessage);
  const wantsAvailability = /\b(what'?s? available|what is available|menu|what do you have|what do we have|available now\?*|list (?:me )?(?:the )?menu)\b/i.test(lowerMessage);

  const hasFoodRequest =
    /\b(want|crave|hungry|eat|food|meal|snack|drink|order|suggest|recommend|something|anything|noodles|biryani|sandwich|lunch|dinner)\b/i.test(lowerMessage) ||
    foodQuery.length > 0 ||
    allCravings.length > 0 ||
    Boolean(diet) ||
    allergies.length > 0 ||
    budget != null ||
    time != null;

  const base = {
    message,
    lowerMessage,
    budget,
    time,
    diet,
    allergens: [],
    cravings: allCravings,
    dislikes,
    mood: [...new Set([...(context?.mood ?? []), ...mood])].slice(-4),
    foodQuery,
    wantedFood,
    foodRequestLike,
    wantsCheaper,
    wantsFaster,
    wantsVegRefine,
    wantsAvailability,
    isGreeting: false,
    isGeneralConversation: false,
    isMenuQuery: false,
    hasFoodRequest,
    answered: [],
  };

  const intent = classifyIntent(lowerMessage, base);

  // ── merge with context ──
  const ctxAllergens = context?.allergens ?? [];
  const mergedAllergens = [...new Set([...ctxAllergens, ...allergies])];
  const ctxDiet = context?.diet ?? null;
  const mergedDiet = diet ?? ctxDiet;
  const ctxBudget = context?.budget ?? null;
  const mergedBudget = budget ?? ctxBudget;
  const ctxTime = context?.time ?? null;
  const mergedTime = time ?? ctxTime;
  const ctxCravings = context?.cravings ?? [];
  const mergedCravings = [...new Set([...ctxCravings, ...allCravings])].slice(-6);
  const ctxDislikes = context?.dislikes ?? [];
  const mergedDislikes = [...new Set([...ctxDislikes, ...dislikes])];
  const ctxMood = context?.mood ?? [];
  const mergedMood = [...new Set([...ctxMood, ...mood])].slice(-4);

  // which questions did THIS message answer?
  const answered: string[] = [];
  if (allCravings.length > 0 || mood.length > 0 || foodQuery.length > 0) answered.push('craving');
  if (budget != null) answered.push('budget');
  if (diet) answered.push('diet');
  if (allergies.length > 0 || /\bno\s+food\s+allergies?\b|\bno\s+allergies?\b|\bno\s+allergen\b/i.test(lowerMessage)) answered.push('allergy');
  if (time != null) answered.push('time');

  // A short, content-free "skip" answer (e.g. "Any", "Everything's fine")
  const skipOnly = /^(?:any|anything|any one|anybody|whatever|skip|no idea|no preference|none|nothing specific|nothing special|don'?t care|do not care|i'?m fine|i'?m easy|i'?m not picky|no constraints|no restrictions|no limit|no allergies?|no diet(?:ary)? preference|no budget|no budget limit|no time limit)\s*[.!]*$/i;
  if (skipOnly.test(lowerMessage.trim())) {
    if (context?.lastQuestion) answered.push(context.lastQuestion);
    else answered.push('craving', 'budget', 'diet', 'allergy', 'time');
  }
  const contextAnswered = context?.answered ?? [];
  const mergedAnswered = [...new Set([...contextAnswered, ...answered])];

  return {
    ...base,
    intent,
    isGreeting: intent === 'greeting',
    isGeneralConversation: intent === 'general',
    isMenuQuery: intent === 'menu_query',
    budget: wantsCheaper && !budget ? ctxBudget : mergedBudget,
    time: wantsFaster && !time ? ctxTime : mergedTime,
    diet: mergedDiet,
    allergens: mergedAllergens,
    cravings: mergedCravings,
    dislikes: mergedDislikes,
    mood: mergedMood,
    answered: mergedAnswered,
  };
}