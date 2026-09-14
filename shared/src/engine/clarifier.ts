import type { MenuItem } from '../types/menu';
import type { ChatContext } from '../types/chat';
import type { Clarification, ClarificationOption, QuestionId } from '../types/recommendation';
import type { ExtractedPrefs } from './intent';
import { preferenceMatcher } from './preferenceMatcher';
import { dietFilter } from './dietFilter';
import { timeFilter } from './timeFilter';
import { budgetFilter } from './budgetFilter';
import { itemAllergenTokens } from './allergyFilter';

const ALLERGY_OPTIONS: { canonical: string; label: string }[] = [
  { canonical: 'nuts', label: 'Peanuts / Nuts' },
  { canonical: 'dairy', label: 'Dairy' },
  { canonical: 'egg', label: 'Eggs' },
  { canonical: 'gluten', label: 'Gluten / Wheat' },
  { canonical: 'soy', label: 'Soy' },
  { canonical: 'shellfish', label: 'Shellfish' },
];

const BUDGET_BUCKETS = [50, 100, 150];
const TIME_BUCKETS = [10, 20, 30];

export const RECOMMEND_THRESHOLD = 3;

function option(label: string, payload: string): ClarificationOption {
  return { label, payload };
}

function eliminationBudget(arr: MenuItem[]): number {
  if (arr.length === 0) return 0;
  let best = 0;
  for (const bucket of BUDGET_BUCKETS) {
    const kept = arr.filter(i => i.price <= bucket).length;
    best = Math.max(best, kept);
  }
  return best === arr.length ? 0 : arr.length - best;
}

function eliminationDiet(arr: MenuItem[]): number {
  if (arr.length === 0) return 0;
  const veg = arr.filter(i => i.dietType !== 'non-veg').length;
  const vegan = arr.filter(i => i.dietType === 'vegan').length;
  const nonVeg = arr.filter(i => i.dietType === 'non-veg').length;
  const best = Math.max(veg, vegan, nonVeg);
  return best === arr.length ? 0 : arr.length - best;
}

function eliminationTime(arr: MenuItem[]): number {
  if (arr.length === 0) return 0;
  let best = 0;
  for (const bucket of TIME_BUCKETS) {
    const kept = arr.filter(i => i.prepTime !== null && i.prepTime <= bucket).length;
    best = Math.max(best, kept);
  }
  return best === arr.length ? 0 : arr.length - best;
}

function eliminationAllergy(arr: MenuItem[]): number {
  if (arr.length === 0) return 0;
  let best = 0;
  for (const opt of ALLERGY_OPTIONS) {
    const count = arr.filter(i => itemAllergenTokens(i).has(opt.canonical)).length;
    best = Math.max(best, count);
  }
  return best;
}

function buildCravingQuestion(prefs: ExtractedPrefs, justLearned: string[]): Clarification {
  let text = 'What are you craving?';
  if (justLearned.includes('allergy')) text = "No problem — I've ruled out anything with a listed conflict. What are you craving?";
  else if (justLearned.includes('budget')) text = 'Noted — staying within your budget. What are you craving?';
  else if (justLearned.includes('diet')) text = 'Got it. What are you craving?';
  else if (justLearned.includes('time')) text = "Got it — I'll keep it quick. What are you craving?";

  return {
    questionId: 'craving',
    text,
    options: [
      option('Spicy', "I'm craving something spicy"),
      option('Sweet', "I'm craving something sweet"),
      option('Filling', "I'm craving something filling"),
      option('Light', "I'm craving something light"),
      option('Comfort', 'I want comfort food'),
      option('Healthy', 'I want something healthy'),
      option('Anything', 'Any'),
    ],
  };
}

function buildQuestion(questionId: QuestionId, prefs: ExtractedPrefs): Clarification {
  switch (questionId) {
    case 'budget':
      return {
        questionId,
        text: "What's your budget?",
        options: [
          option('₹50', 'I only have ₹50'),
          option('₹100', 'I only have ₹100'),
          option('₹150', 'I only have ₹150'),
          option('No limit', 'No budget limit'),
        ],
      };
    case 'diet':
      return {
        questionId,
        text: 'Any dietary preference?',
        options: [
          option('Vegetarian', "I'm vegetarian"),
          option('Non-Vegetarian', "I'm non-vegetarian"),
          option('Vegan', "I'm vegan"),
          option('Anything', 'No dietary preference'),
        ],
      };
    case 'allergy':
      return {
        questionId,
        text: 'Any food allergies I should check?',
        options: [
          ...ALLERGY_OPTIONS.map(a => option(a.label, `I'm allergic to ${a.label.toLowerCase()}`)),
          option('None', 'I have no food allergies'),
        ],
      };
    case 'time':
      return {
        questionId,
        text: 'How much time do you have?',
        options: [
          option('10 min', 'I have 10 minutes'),
          option('20 min', 'I have 20 minutes'),
          option('30 min', 'I have 30 minutes'),
          option('No rush', 'No time limit'),
        ],
      };
    default:
      return buildCravingQuestion(prefs, []);
  }
}

/**
 * Adaptive follow-up. Asks at most ONE question, only when it actually helps
 * shrink the pool — never a rigid questionnaire. Allergy is asked before the
 * final recommendation because it is a hard safety constraint.
 */
export function decideClarification(
  prefs: ExtractedPrefs,
  safe: MenuItem[],
  context: ChatContext
): Clarification | null {
  if (prefs.wantsAvailability) return null;
  if (prefs.intent !== 'food_recommendation') return null;
  if (prefs.foodQuery.length > 0 && prefs.foodQuery.some(t => t.length > 2)) return null;
  if (safe.length === 0) return null;

  let pool = safe.filter(item => {
    const pm = preferenceMatcher(item, prefs);
    return pm.foodMatched || pm.cravingMatched || pm.tagMatched;
  });
  if (pool.length === 0) pool = safe;

  pool = dietFilter(pool, prefs.diet);
  pool = timeFilter(pool, prefs.time);
  pool = budgetFilter(pool, prefs.budget);

  if (pool.length <= RECOMMEND_THRESHOLD) return null;

  const answered = new Set(prefs.answered);
  const cravingKnown = prefs.cravings.length > 0 || prefs.mood.length > 0 || prefs.foodQuery.length > 0;

  // Safety-first: never re-ask the exact question the student just ignored.
  const lastQ = context.lastQuestion;
  const skipLast = (id: QuestionId) => answered.has(id) || lastQ === id;

  if (!cravingKnown && !answered.has('craving')) {
    return buildCravingQuestion(prefs, []);
  }

  const justLearned: string[] = [];
  if (context.allergens.length === 0 && prefs.allergens.length > 0) justLearned.push('allergy');
  if (context.budget == null && prefs.budget != null) justLearned.push('budget');
  if (context.diet == null && prefs.diet != null) justLearned.push('diet');
  if (context.time == null && prefs.time != null) justLearned.push('time');

  // Natural ladder in fixed order: craving → budget → diet → time → allergy.
  // Budget and diet are the natural next steps whenever they are still unknown
  // (budget also commonly needs a rescue); time and allergy are only asked when
  // they would meaningfully narrow the pool. The pool-size gate above already
  // returns null (→ recommend) once only a few items survive, so we never
  // over-question.
  const ladder: { id: QuestionId; unknown: boolean; helps: boolean }[] = [
    { id: 'budget', unknown: prefs.budget == null, helps: true },
    { id: 'diet', unknown: !prefs.diet, helps: true },
    { id: 'time', unknown: prefs.time == null, helps: eliminationTime(pool) > 0 },
    { id: 'allergy', unknown: prefs.allergens.length === 0, helps: eliminationAllergy(pool) > 0 },
  ];

  for (const step of ladder) {
    if (!step.unknown || skipLast(step.id)) continue;
    if (!step.helps) continue;
    return buildQuestion(step.id, prefs);
  }

  return null;
}

