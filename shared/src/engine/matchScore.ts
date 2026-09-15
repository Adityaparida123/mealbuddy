import type { MenuItem } from '../types/menu';
import type { ExtractedPrefs } from './intent';
import { isAttributeWord } from './intent';
import { preferenceMatcher, matchItemTag, categoryFoodMatch, exactFoodMatch, matchesFoodQuery } from './preferenceMatcher';
import type { MatchResult } from '../types/recommendation';

export interface ScoreDetail {
  food: number; // /40 (exact food / category / craving)
  tag: number; // /25 preference & semantic match
  budget: number; // /15
  diet: number; // /10
  time: number; // /10
}

export const WEIGHTS = {
  food: 40,
  tag: 25,
  budget: 15,
  diet: 10,
  time: 10,
};

function timeFits(item: MenuItem, limit: number | null): boolean {
  if (!limit) return true;
  return item.prepTime !== null && item.prepTime <= limit;
}

function dietFits(item: MenuItem, diet: string | null): boolean {
  if (!diet || diet === 'any') return true;
  const d = diet.toLowerCase();
  if (d === 'vegetarian') return item.dietType !== 'non-veg';
  if (d === 'vegan') return item.dietType === 'vegan';
  if (d === 'non-veg') return item.dietType === 'non-veg';
  if (d === 'gluten-free') return item.glutenFree === true;
  return true;
}

function semanticTokens(prefs: ExtractedPrefs): string[] {
  const set = new Set<string>();
  for (const c of prefs.cravings) if (c.length > 1 && isAttributeWord(c)) set.add(c);
  for (const m of prefs.mood) if (m.length > 1 && isAttributeWord(m)) set.add(m);
  return [...set];
}

export function computeMatchResult(
  item: MenuItem,
  prefs: ExtractedPrefs,
  categoryPool?: string[]
): { detail: ScoreDetail; reasons: string[] } {
  const pm = preferenceMatcher(item, prefs);

  // ── Food / exact match (40) ──
  let food = 0;
  if (pm.exactMatched) {
    food = WEIGHTS.food; // exact requested menu item — strongest priority
  } else if (pm.foodMatched) {
    food = 30; // partial / ingredient-level match to the request
  } else if (prefs.foodQuery.length > 0 && categoryPool && categoryPool.length > 0) {
    if (categoryPool.some(c => c === item.category.toLowerCase())) {
      food = 22; // same category as the requested food
    }
  } else if (prefs.cravings.length > 0 && pm.cravingMatched) {
    food = 12; // taste/craving match
  }

  // ── Preference / semantic match (25) ──
  const sem = semanticTokens(prefs);
  let tag = 0;
  if (sem.length > 0 && pm.tagMatched) {
    tag = Math.round((pm.matchedTagCount / sem.length) * WEIGHTS.tag);
  }

  // ── Budget (15) ──
  const budget = !prefs.budget ? WEIGHTS.budget : item.price <= prefs.budget ? WEIGHTS.budget : 0;

  // ── Diet (10) ──
  const diet = dietFits(item, prefs.diet) ? WEIGHTS.diet : 0;

  // ── Time (10) ──
  const time = timeFits(item, prefs.time) ? WEIGHTS.time : 0;

  const reasons: string[] = [];
  if (pm.exactMatched) reasons.push(`Matches what you asked for (${item.name})`);
  else if (pm.foodMatched) reasons.push('Matches what you asked for');
  else if (food > 0 && categoryPool && categoryPool.length) reasons.push('Same category as your request');
  if (prefs.cravings.length > 0 && (pm.cravingMatched || pm.foodMatched)) reasons.push('Matches your craving');
  if (prefs.budget && item.price <= prefs.budget) reasons.push(`Within your ${formatBudget(prefs.budget)} budget`);
  if (prefs.time && item.prepTime !== null && item.prepTime <= prefs.time) reasons.push(`Ready within ${prefs.time} min`);
  if (prefs.diet && prefs.diet !== 'any' && diet >= WEIGHTS.diet) reasons.push('Matches your diet');
  if (prefs.allergens.length > 0) reasons.push('No listed conflict with your declared allergy');
  if (item.available) reasons.push('Available now');

  return {
    detail: { food, tag, budget, diet, time },
    reasons,
  };
}

function formatBudget(b: number): string {
  return `₹${b}`;
}

export function computeMatchScore(item: MenuItem, prefs: ExtractedPrefs, categoryPool?: string[]): number {
  const { detail } = computeMatchResult(item, prefs, categoryPool);
  return Math.min(
    100,
    Math.max(0, Math.round(detail.food + detail.tag + detail.budget + detail.diet + detail.time))
  );
}

export function buildMatchResult(item: MenuItem, prefs: ExtractedPrefs, categoryPool?: string[]): MatchResult {
  const { detail, reasons } = computeMatchResult(item, prefs, categoryPool);
  return {
    item,
    score: Math.min(
      100,
      Math.max(0, Math.round(detail.food + detail.tag + detail.budget + detail.diet + detail.time))
    ),
    reasons: {
      craving: preferenceMatcher(item, prefs).cravingMatched,
      tag: preferenceMatcher(item, prefs).tagMatched,
      diet: detail.diet >= WEIGHTS.diet,
      budget: detail.budget >= WEIGHTS.budget,
      time: detail.time >= WEIGHTS.time,
    },
  };
}

/**
 * Deterministic ranking used by both the engine and the fallback path.
 * Ties are broken by score desc, then price asc, then name asc — never by
 * arbitrary array order.
 */
export function rankCandidates(items: MenuItem[], prefs: ExtractedPrefs, categoryPool?: string[]): MatchResult[] {
  return items
    .map(item => buildMatchResult(item, prefs, categoryPool))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.item.price !== b.item.price) return a.item.price - b.item.price;
      return a.item.name.localeCompare(b.item.name);
    });
}

export function categoryPoolFromQuery(menu: MenuItem[], foodQuery: string[]): string[] {
  const cats = new Set<string>();
  for (const item of menu) {
    if (matchesFoodQuery(item, foodQuery) || exactFoodMatch(item, foodQuery)) {
      cats.add(item.category.toLowerCase());
    }
  }
  return [...cats];
}

export { matchItemTag };