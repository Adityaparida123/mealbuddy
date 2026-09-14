import type { MenuItem } from '../types/menu';
import type { ExtractedPrefs } from './intent';
import { tokensOf, eqToken } from './intent';

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Category words the system understands. item.category in the dataset is one
 * of Meal / Snack / Dessert / Beverage.
 */
const CATEGORY_ALIASES: Record<string, string[]> = {
  meal: ['meal', 'lunch', 'dinner', 'breakfast', 'thali', 'biryani', 'bowl', 'main'],
  snack: ['snack', 'starter', 'roll', 'sandwich', 'samosa', 'fries', 'side'],
  dessert: ['dessert', 'sweet', 'sweets', 'mithai', 'chikki', 'jamun', 'cake', 'chocolate'],
  beverage: ['beverage', 'drink', 'coffee', 'tea', 'lassi', 'juice', 'soda', 'milk'],
};

function nameTokens(item: MenuItem): string[] {
  return tokensOf(item.name);
}

function itemCategoryToken(item: MenuItem): string {
  return item.category.toLowerCase().trim();
}

function matchesCategoryAlias(item: MenuItem, token: string): boolean {
  const cat = itemCategoryToken(item);
  const catKey = Object.keys(CATEGORY_ALIASES).find(k =>
    CATEGORY_ALIASES[k].some(a => a === cat || cat.includes(a))
  );
  if (!catKey) return false;
  return CATEGORY_ALIASES[catKey].some(a => eqToken(a, token));
}

/**
 * True when any query token matches the item name, category or ingredients at
 * word level (with singular/plural tolerance).
 */
export function matchesFoodQuery(item: MenuItem, tokens: string[]): boolean {
  if (!tokens.length) return false;
  const name = nameTokens(item);
  const cat = tokensOf(itemCategoryToken(item));
  const ing = tokensOf((item.ingredients ?? []).join(' '));
  for (const token of tokens) {
    const t = stripToken(token);
    if (!t || t.length < 2) continue;
    const target = tokensOf(t);
    if (target.length === 0) continue;
    if (matchesCategoryAlias(item, t)) return true;
    if (target.some(tok => name.some(nt => eqToken(nt, tok)))) return true;
    if (target.some(tok => cat.some(ct => eqToken(ct, tok)))) return true;
    if (target.some(tok => ing.some(it => eqToken(it, tok)))) return true;
  }
  return false;
}
/**
 * Strongest kind of match: every significant query token appears in the item
 * name (so "biryani" and "chicken biryani" both match "Chicken Biryani").
 */
export function exactFoodMatch(item: MenuItem, tokens: string[]): boolean {
  const name = nameTokens(item);
  let anyQuery = false;
  for (const token of tokens) {
    const t = stripToken(token);
    if (!t || t.length < 2) continue;
    const target = tokensOf(t);
    if (target.length === 0) continue;
    anyQuery = true;
    const nameHasAll = target.every(tok => name.some(nt => eqToken(nt, tok)));
    if (nameHasAll) return true;
  }
  return anyQuery && false;
}

/**
 * Category-level match: queried food belongs to the item's category.
 */
export function categoryFoodMatch(item: MenuItem, tokens: string[], categoryPool?: string[]): boolean {
  const cat = itemCategoryToken(item);
  if (categoryPool && categoryPool.length > 0) {
    return categoryPool.some(c => eqToken(c, cat));
  }
  for (const token of tokens) {
    const t = stripToken(token);
    if (!t || t.length < 2) continue;
    if (matchesCategoryAlias(item, t)) return true;
  }
  return false;
}

function stripToken(t: string): string {
  return norm(t);
}

function matchItemTag(item: MenuItem, token: string): boolean {
  const t = token.toLowerCase().trim();
  if (!t || t.length < 2) return false;
  const name = item.name.toLowerCase();
  const ing = item.ingredients.join(' ').toLowerCase();
  const tags = item.tags.map(x => x.toLowerCase());

  // tag-based: exact word tags
  if (tags.some(tag => eqToken(tag, t) || tag.includes(t) || t.includes(tag))) return true;

  if (t === 'spicy' || t === 'hot' || t === 'spice' || t === 'spices' || t === 'spiced') {
    if (item.spiceLevel === 'spicy' || item.mood.includes('spicy') || /\b(spices|chilli|chili|pepper|masala|garam)\b/.test(ing)) return true;
  }
  if (t === 'sweet' || t === 'sugary') {
    return item.mood.includes('sweet') || /\b(sugar|jaggery|syrup|khoya)\b/.test(ing) || item.category === 'Dessert';
  }
  if (t === 'light' || t === 'healthy' || t === 'fresh' || t === 'refreshing') {
    if (item.mood.includes('light') || item.mood.includes('fresh') || item.mood.includes('refreshing')) return true;
    if ((t === 'light' || t === 'healthy' || t === 'refreshing') && item.calories !== null && item.calories <= 220) return true;
  }
  if (t === 'filling' || t === 'heavy' || t === 'substantial' || t === 'hearty') {
    return item.calories !== null && item.calories >= 400;
  }
  if (t === 'crispy' || t === 'crunchy' || t === 'fried' || t === 'crisp') {
    return /\b(fried|crispy|bhature)\b/.test(ing) || name.includes('fried');
  }
  if (t === 'cold' || t === 'chilled' || t === 'iced') {
    return name.includes('cold') || name.includes('lassi') || item.category === 'Beverage';
  }
  if (t === 'creamy' || t === 'cheesy') {
    return /\b(cream|paneer|milk|cheese|butter|yogurt)\b/.test(ing);
  }
  if (t === 'cozy' || t === 'comfort' || t === 'comforting') return item.mood.includes('comfort');
  if (t === 'energizing' || t === 'energy' || t === 'boost' || t === 'wake') {
    return item.mood.includes('energizing') || name.includes('coffee') || name.includes('tea');
  }
  if (t === 'warm' || t === 'hot drink') return /\b(tea|coffee)\b/.test(ing);
  if (t === 'veg' || t === 'vegetarian') return item.dietType !== 'non-veg';
  if (t === 'vegan') return item.dietType === 'vegan';
  if (t === 'non-veg' || t === 'nonveg' || t === 'meat') return item.dietType === 'non-veg';
  if (t === 'gluten-free' || t === 'glutenfree') return item.glutenFree === true;
  if (t === 'salty') return /\b(salt|salty)\b/.test(ing);
  if (t === 'sour' || t === 'tangy') return /\b(curd|tamarind|lemon|lime|amchur)\b/.test(ing) || name.includes('lassi');
  if (t === 'juicy') return /\b(fruits|fruit|chicken|prawns?)\b/.test(ing);
  if (t === 'smoky') return ing.includes('smok') || item.spiceLevel === 'spicy';
  if (t === 'rich') return item.calories !== null && item.calories >= 350;
  if (t === 'chilled' || t === 'cold') return name.includes('cold') || name.includes('lassi') || item.category === 'Beverage';
  return false;
}

export interface PreferenceMatch {
  foodMatched: boolean;
  exactMatched: boolean;
  cravingMatched: boolean;
  tagMatched: boolean;
  matchedTagCount: number;
}

export function preferenceMatcher(item: MenuItem, prefs: ExtractedPrefs): PreferenceMatch {
  const foodMatched = matchesFoodQuery(item, prefs.foodQuery);
  const exactMatched = exactFoodMatch(item, prefs.foodQuery);
  const cravingTokens = prefs.cravings.filter(c => matchItemTag(item, c));
  const moodTokens = prefs.mood.filter(m => matchItemTag(item, m));
  const tagTokens = new Set([...prefs.cravings, ...prefs.mood]);
  let matchedTags = 0;
  let totalTags = 0;
  for (const token of tagTokens) {
    totalTags += 1;
    if (matchItemTag(item, String(token))) matchedTags += 1;
  }
  return {
    foodMatched,
    exactMatched,
    cravingMatched: cravingTokens.length > 0 || moodTokens.length > 0,
    tagMatched: matchedTags > 0,
    matchedTagCount: matchedTags,
  };
}

export { matchItemTag };
