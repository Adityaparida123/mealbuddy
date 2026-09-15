import type { MenuItem } from '../types/menu';
import type { ChatContext } from '../types/chat';
import type { Recommendation, MatchResult, Clarification } from '../types/recommendation';
import { extractUserPreferences, isAttributeWord, isMeaningfulFoodToken, type ExtractedPrefs } from './intent';
import { allergyFilter } from './allergyFilter';
import { availabilityFilter } from './availabilityFilter';
import { dietFilter } from './dietFilter';
import { budgetFilter } from './budgetFilter';
import { timeFilter } from './timeFilter';
import { dislikeFilter, matchesDislike } from './dislikeFilter';
import { rankCandidates, categoryPoolFromQuery } from './matchScore';
import { exactFoodMatch, matchesFoodQuery, matchItemTag } from './preferenceMatcher';
import { rankCandidatesWithGemini } from '../services/gemini';
import { decideClarification } from './clarifier';
import { logStage } from './debug';

export interface EngineResult {
  recommendation: Recommendation;
  prefs: ExtractedPrefs;
  appliedBudget: number | null;
  appliedTime: number | null;
  clarification: Clarification | null;
}

const DISCLAIMER =
  'Allergy checks are based on the canteen ingredient data. There is no listed conflict for the items above, but for severe allergies please confirm ingredients and cross-contamination with canteen staff.';

const DIET_LABELS: Record<string, string> = {
  vegetarian: 'vegetarian',
  vegan: 'vegan',
  'non-veg': 'non-vegetarian',
  'gluten-free': 'gluten-free',
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Human-friendly label for a semantic craving ("spicy" -> "spicy food",
 * ["spicy", "comfort"] -> "spicy and comfort food") used when no menu item
 * actually carries the requested attribute.
 */
function cravingFoodLabel(terms: string[]): string {
  const unique = [...new Set(terms)];
  if (unique.length === 0) return 'food';
  const list = unique.length > 1
    ? `${unique.slice(0, -1).join(', ')} and ${unique[unique.length - 1]}`
    : unique[0];
  return `${list} food`;
}

// ─────────────────────────── hard-rule validation ───────────────────────────

/**
 * Every recommended item must satisfy ALL hard rules against the LIVE menu:
 * id exists, currently available, no allergy conflict, no stated diet conflict,
 * within the applied budget, within the time limit, and not explicitly disliked.
 */
function passesHardRules(
  item: MenuItem,
  menu: MenuItem[],
  prefs: ExtractedPrefs,
  appliedBudget: number | null,
  appliedTime: number | null
): boolean {
  if (!item) return false;
  const live = menu.find(m => m.id === item.id);
  if (!live) return false;
  if (!live.available) return false;
  if (prefs.allergens.length > 0 && allergyFilter([live], prefs.allergens).length === 0) return false;
  if (prefs.diet && prefs.diet !== 'any' && dietFilter([live], prefs.diet).length === 0) return false;
  if (appliedTime && timeFilter([live], appliedTime).length === 0) return false;
  if (appliedBudget && live.price > appliedBudget) return false;
  if (prefs.dislikes.some(d => matchesDislike(live, d))) return false;
  return true;
}

function toMatch(item: MenuItem, prefs: ExtractedPrefs, categoryPool: string[]): MatchResult {
  return rankCandidates([item], prefs, categoryPool)[0];
}

// ─────────────────────────── intent-based responses ───────────────────────────

function simpleResult(explanation: string, prefs: ExtractedPrefs): EngineResult {
  return {
    recommendation: { best: null, alternatives: [], explanation, aiUsed: false },
    prefs,
    appliedBudget: prefs.budget,
    appliedTime: prefs.time,
    clarification: null,
  };
}

function greetingResult(prefs: ExtractedPrefs): EngineResult {
  return simpleResult(
    "Hey! 👋 What are you in the mood for today?",
    prefs
  );
}

function generalResult(prefs: ExtractedPrefs): EngineResult {
  return simpleResult(
    "I'm Meal Buddy, your college canteen assistant — I focus on getting you food from today's menu. I can help you pick something to eat, check what's available, or respect your budget and allergies. Try me!",
    prefs
  );
}

function menuQueryResult(menu: MenuItem[], prefs: ExtractedPrefs): EngineResult {
  const available = availabilityFilter(menu);
  if (available.length === 0) {
    return simpleResult("Sorry, there's nothing available on the canteen menu right now.", prefs);
  }
  const lines = available
    .slice()
    .sort((a, b) => a.price - b.price)
    .map(m => `• ${m.name} — ₹${m.price}${m.prepTime != null ? ` (${m.prepTime} min)` : ''}`)
    .join('\n');
  return simpleResult(`Here's what's ready on today's canteen menu:\n\n${lines}`, prefs);
}

// ─────────────────────────── requested-food diagnostics ───────────────────────────

function describeRequestedState(label: string, menu: MenuItem[], prefs: ExtractedPrefs): string | null {
  const token = label.toLowerCase();
  const menuHits = menu.filter(m => matchesFoodQuery(m, [token]));
  if (menuHits.length === 0) {
    return `"${capitalize(label)}" isn't currently available on the canteen menu.`;
  }
  const availableHits = menuHits.filter(m => m.available);
  if (availableHits.length === 0) {
    return `"${capitalize(label)}" is currently sold out.`;
  }
  let safe = availableHits;
  if (prefs.allergens.length > 0) safe = allergyFilter(safe, prefs.allergens);
  if (safe.length === 0 && prefs.allergens.length > 0) {
    return `"${capitalize(label)}" contains an ingredient on your allergy list, so it's been excluded for you.`;
  }
  if (prefs.diet && prefs.diet !== 'any') safe = dietFilter(safe, prefs.diet);
  if (safe.length === 0 && prefs.diet && prefs.diet !== 'any') {
    return `"${capitalize(label)}" doesn't come in a ${DIET_LABELS[prefs.diet] ?? prefs.diet} option, so it's been excluded for you.`;
  }
  return null;
}

// ─────────────────────────── main recommendation pipeline ───────────────────────────

function makeNoMatch(explanation: string, prefs: ExtractedPrefs, appliedBudget: number | null, appliedTime: number | null): EngineResult {
  return {
    recommendation: { best: null, alternatives: [], explanation, aiUsed: false },
    prefs,
    appliedBudget,
    appliedTime,
    clarification: null,
  };
}

function requestedBudgetRescue(
  pool: MenuItem[],
  prefs: ExtractedPrefs,
  appliedBudget: number
): Recommendation['budgetRescue'] {
  if (prefs.foodQuery.length === 0) return null;
  // Prefer the STRONGEST signal: all significant query tokens present in the
  // item NAME (e.g. "chicken" + "biryani" => Chicken Biryani). Only fall back to
  // the broader category/ingredient matcher when no single item carries the full
  // query on its own, otherwise a lone category token ("biryani" ~ meal/category)
  // would match the whole category and the rescue would never fire.
  const strong = pool.filter(i => exactFoodMatch(i, prefs.foodQuery));
  const wanted = strong.length > 0 ? strong : pool.filter(i => matchesFoodQuery(i, prefs.foodQuery));
  if (wanted.length === 0) return null;
  const requested = wanted.sort((a, b) => a.price - b.price)[0];
  if (requested.price > appliedBudget) {
    return { desired: requested, overBudget: requested.price - appliedBudget };
  }
  return null;
}

async function recommend(
  userMessage: string,
  menu: MenuItem[],
  prefs: ExtractedPrefs,
  context: ChatContext
): Promise<EngineResult> {
  const appliedTime = prefs.time;
  logStage('menu items', menu.length);

  // ── 1. Availability ──
  let pool = availabilityFilter(menu);
  logStage(`availability: ${menu.length} -> ${pool.length} (removed ${menu.length - pool.length})`);

  // ── 2. Allergy (hard) ──
  if (prefs.allergens.length > 0) {
    const before = pool.length;
    pool = allergyFilter(pool, prefs.allergens);
    logStage(`allergy: ${before} -> ${pool.length} (removed ${before - pool.length})`);
  }
  if (pool.length === 0) {
    return makeNoMatch('Sorry, there is nothing available right now that is safe for your allergies.', prefs, prefs.budget, appliedTime);
  }

  // ── 3. Dislikes (hard) ──
  if (prefs.dislikes.length > 0) {
    const removed = pool.filter(i => prefs.dislikes.some(d => matchesDislike(i, d))).map(i => i.name);
    const before = pool.length;
    pool = dislikeFilter(pool, prefs.dislikes);
    logStage(`dislike: ${before} -> ${pool.length} (removed ${before - pool.length})`, removed);
    if (!pool.length) {
      return makeNoMatch('Nothing on today’s menu works once I exclude what you said you don’t want.', prefs, prefs.budget, appliedTime);
    }
  }

  // ── 4. Diet (hard, strict — never silently relaxed) ──
  if (prefs.diet && prefs.diet !== 'any') {
    const before = pool.length;
    const applied = dietFilter(pool, prefs.diet);
    logStage(`diet(${prefs.diet}): ${before} -> ${applied.length} (removed ${before - applied.length})`);
    if (applied.length === 0) {
      return makeNoMatch(
        `There are no ${DIET_LABELS[prefs.diet] ?? prefs.diet} options on today’s menu that also pass your other constraints.`,
        prefs,
        prefs.budget,
        appliedTime
      );
    }
    pool = applied;
  }

  // ── 5. Time (hard) ──
  if (prefs.time) {
    const before = pool.length;
    const applied = timeFilter(pool, prefs.time);
    logStage(`time(${prefs.time}): ${before} -> ${applied.length} (removed ${before - applied.length})`);
    if (applied.length === 0) {
      return makeNoMatch(`Nothing on today’s menu can be ready within ${prefs.time} minutes right now.`, prefs, prefs.budget, appliedTime);
    }
    pool = applied;
  }

  // ── 6. Effective budget (handles "make it cheaper" refinements) ──
  let appliedBudget = prefs.budget;
  if (prefs.wantsCheaper && context.lastBestPrice != null) {
    appliedBudget = context.lastBestPrice - 1;
    if (prefs.budget != null) appliedBudget = Math.min(appliedBudget, prefs.budget);
    if (appliedBudget < 1) appliedBudget = 1;
  }
  logStage('appliedBudget', appliedBudget);

  // ── 7. Adaptive clarifying question (before final recommendation) ──
  const clarification = decideClarification(prefs, pool, context);
  if (clarification) {
    return {
      recommendation: { best: null, alternatives: [], explanation: clarification.text, aiUsed: false, clarification },
      prefs,
      appliedBudget,
      appliedTime,
      clarification,
    };
  }

  // ── 8. Budget rescue + hard budget filter ──
  let budgetRescue: Recommendation['budgetRescue'] = null;
  if (appliedBudget) {
    if (prefs.foodQuery.length > 0) {
      budgetRescue = requestedBudgetRescue(pool, prefs, appliedBudget);
    }
    const before = pool.length;
    const within = budgetFilter(pool, appliedBudget);
    logStage(`budget(${appliedBudget}): ${before} -> ${within.length} (removed ${before - within.length})`);
    if (within.length === 0) {
      const d = budgetRescue?.desired;
      const msg = d
        ? `${d.name} is ₹${d.price}, which is ₹${budgetRescue!.overBudget} over your ₹${appliedBudget} budget. No other item fits within ₹${appliedBudget} right now — try relaxing the budget or asking for a different dish.`
        : `Nothing on today’s menu fits within ₹${appliedBudget} right now. The cheapest available option is ${pool.slice().sort((a, b) => a.price - b.price)[0].name} at ₹${pool.slice().sort((a, b) => a.price - b.price)[0].price}.`;
      return {
        recommendation: {
          best: null,
          alternatives: [],
          explanation: msg,
          aiUsed: false,
          budgetRescue,
        },
        prefs,
        appliedBudget,
        appliedTime,
        clarification: null,
      };
    }
    pool = within;
  }

  // ── 9. Requested-food diagnostics for the message ──
  // Only REAL dish names ("chicken biryani", "pizza") produce a "not available"
  // diagnostic. A taste attribute ("spicy", "comfort") is never a requested
  // dish, so it must never be echoed as "Spicy isn't available on the menu" —
  // it is matched semantically against tags/mood/spiceLevel instead.
  const requestedLabel = prefs.wantedFood ?? (prefs.foodQuery.filter(isMeaningfulFoodToken).join(' ') || null);
  const requestedUnavailable = requestedLabel ? describeRequestedState(requestedLabel, menu, prefs) : null;

  // ── 10. Deterministic ranking (covers fallback and category credit) ──
  const categoryPool = prefs.foodQuery.length > 0 ? categoryPoolFromQuery(menu, prefs.foodQuery) : [];
  const ranked = rankCandidates(pool, prefs, categoryPool);
  let best = ranked[0] ?? null;
  let alternatives = ranked.slice(1, 5);
  logStage('final valid candidates', pool.length, pool.map(i => `${i.id}:${i.name}`));

  const cravingTerms = prefs.cravings.filter(t => isAttributeWord(t));
  const cravingMiss = cravingTerms.length > 0 && !pool.some(item => cravingTerms.some(t => matchItemTag(item, t)));

  // ── 11. Gemini ranking (valid candidates only) ──
  let aiUsed = false;
  let explanation = '';
  const ai = await rankCandidatesWithGemini({ userMessage, candidates: pool, prefs });
  if (ai && ai.bestId) {
    const candidateBest = pool.find(c => c.id === ai.bestId);
    if (candidateBest && passesHardRules(candidateBest, menu, prefs, appliedBudget, appliedTime)) {
      best = toMatch(candidateBest, prefs, categoryPool);
      aiUsed = true;
      const aiAlts = ai.alternativeIds
        .map(id => pool.find(c => c.id === id))
        .filter((x): x is MenuItem => Boolean(x))
        .filter(x => x.id !== best!.item.id)
        .map(x => toMatch(x, prefs, categoryPool))
        .filter(m => passesHardRules(m.item, menu, prefs, appliedBudget, appliedTime));
      if (aiAlts.length > 0) alternatives = aiAlts;
      explanation = ai.explanation || '';
      logStage('gemini selected ids', [ai.bestId, ...ai.alternativeIds], 'pre-validated');
      logStage('gemini validated ids', [best.item.id, ...alternatives.map(a => a.item.id)]);
    }
  }

  // ── 12. Final message ──
  let message: string;
  if (budgetRescue && budgetRescue.desired) {
    const d = budgetRescue.desired;
    message = aiUsed && explanation
      ? explanation
      : `${d.name} is ₹${d.price}, which is ₹${budgetRescue.overBudget} over your ₹${appliedBudget} budget. Here are safe options within your budget:`;
  } else if (requestedUnavailable) {
    message = requestedUnavailable;
    message += best ? ' The closest safe options from today’s menu:' : '';
  } else if (cravingMiss && best) {
    message = `I couldn't find a menu item matching your craving for ${cravingFoodLabel(cravingTerms)}. Here are the closest safe options from today's menu.`;
  } else if (aiUsed && explanation) {
    message = explanation;
  } else if (prefs.wantsAvailability) {
    message = 'Here’s what’s ready on today’s canteen menu right now:';
  } else {
    message = 'Here is the best match from today’s menu.';
  }

  if (prefs.allergens.length > 0) {
    message = `${message}\n\n${DISCLAIMER}`;
  }

  const recommendation: Recommendation = {
    best,
    alternatives,
    explanation: message,
    aiUsed,
    budgetRescue,
    requestedUnavailable,
  };
  return {
    recommendation,
    prefs,
    appliedBudget,
    appliedTime,
    clarification: null,
  };
}

// ─────────────────────────── entry point ───────────────────────────

export async function getRecommendation(
  userMessage: string,
  menu: MenuItem[],
  context: ChatContext
): Promise<EngineResult> {
  const prefs = extractUserPreferences(userMessage, context);
  logStage('prefs', {
    intent: prefs.intent,
    foodQuery: prefs.foodQuery,
    wantedFood: prefs.wantedFood,
    craving: prefs.cravings,
    budget: prefs.budget,
    diet: prefs.diet,
    allergens: prefs.allergens,
    dislikes: prefs.dislikes,
    time: prefs.time,
    answered: prefs.answered,
  });

  if (prefs.intent === 'greeting') return greetingResult(prefs);
  if (prefs.intent === 'general') return generalResult(prefs);
  if (prefs.intent === 'menu_query') return menuQueryResult(menu, prefs);

  return recommend(userMessage, menu, prefs, context);
}