import { getRecommendation } from '../shared/src/engine';
import { emptyContext } from '../shared/src/types/chat';
import menu from '../shared/src/data/menu.json';
import type { MenuItem } from '../shared/src/types/menu';
import type { ChatContext } from '../shared/src/types/chat';
import type { Recommendation } from '../shared/src/types/recommendation';

const MENU = menu as MenuItem[];

function ctx(overrides: Partial<ChatContext> = {}): ChatContext {
  return { ...emptyContext(), ...overrides };
}

let pass = 0;
let fail = 0;

function check(label: string, ok: boolean, detail = ''): boolean {
  if (ok) {
    pass++;
    console.log(`  ✅ ${label}`);
  } else {
    fail++;
    console.log(`  ❌ ${label} ${detail}`);
  }
  return ok;
}

type Result = {
  recommendation: Recommendation;
  prefs: ReturnType<typeof Object>;
};

let lastCtx: ChatContext = emptyContext();

async function flow(message: string, context: ChatContext = lastCtx): Promise<Result> {
  const { recommendation, prefs } = await getRecommendation(message, MENU, context);
  lastCtx = {
    cravings: prefs.cravings,
    budget: prefs.budget,
    diet: prefs.diet,
    allergens: prefs.allergens,
    time: prefs.time,
    mood: prefs.mood,
    lastRecommendationId: recommendation.best?.item.id ?? null,
    lastBestPrice: recommendation.best?.item.price ?? null,
    lastIntents: [],
    answered: prefs.answered,
    lastQuestion: recommendation.clarification?.questionId ?? null,
  };
  return { recommendation, prefs };
}

async function scenario(
  label: string,
  steps: { user: string; expect: 'clarification' | 'recommendation'; questionId?: string; assert?: (r: Result) => boolean | undefined; note?: string }[]
): Promise<void> {
  console.log(`\n── ${label}`);
  lastCtx = emptyContext();
  for (const step of steps) {
    const r = await flow(step.user);
    const qId = r.recommendation.clarification?.questionId ?? null;
    const hasClar = Boolean(qId);
    const bestName = r.recommendation.best?.item.name ?? 'none';
    const desc = `expect=${step.expect}${step.questionId ? `/${step.questionId}` : ''} got=${hasClar ? `clarification(${qId})` : `recommendation(${bestName})`}`;
    let ok = (step.expect === 'clarification')
      ? hasClar && (step.questionId ? qId === step.questionId : true)
      : !hasClar && Boolean(r.recommendation.best);
    if (step.assert) ok = ok && step.assert(r) !== false;
    check(`[${step.user}] ${step.note ?? ''}`, ok, desc);
  }
}

async function main(): Promise<void> {
  // ── Dynamic conversation: the example flow ──
  await scenario('EXAMPLE FLOW (dynamic questions)', [
    { user: "I'm hungry", expect: 'clarification', questionId: 'craving' },
    { user: 'I want something spicy', expect: 'clarification', questionId: 'budget' },
    { user: 'I only have ₹100', expect: 'clarification', questionId: 'diet' },
    {
      user: "I'm vegetarian",
      expect: 'recommendation',
      assert: ({ recommendation }) =>
        recommendation.best?.item.dietType !== 'non-veg' &&
        recommendation.best?.item.spiceLevel === 'spicy' &&
        (recommendation.best?.item.price ?? 0) <= 100,
    },
  ]);

  // ── TEST 1 — allergy is a hard exclusion at every step ──
  await scenario('TEST 1 allergy safety (nuts)', [
    { user: 'I am allergic to peanuts', expect: 'clarification', questionId: 'craving' },
    { user: 'I want something spicy', expect: 'clarification', questionId: 'budget' },
    {
      user: 'I only have ₹50',
      expect: 'recommendation',
      assert: ({ recommendation }) =>
        recommendation.best?.item.id !== 'I017' && // no Peanut Chikki
        (recommendation.best?.item.price ?? 0) <= 50 &&
        recommendation.best?.item.spiceLevel === 'spicy',
    },
  ]);

  // TEST 1b — everything already in one message
  await scenario('TEST 1b allergy in one message', [
    {
      user: "I'm craving something sweet under ₹30 and I'm allergic to peanuts",
      expect: 'recommendation',
      note: '(Gulab Jamun only survivor)',
      assert: ({ recommendation }) => recommendation.best?.item.name === 'Gulab Jamun',
    },
  ]);

  // ── TEST 2 — exact craving prioritized —─
  await scenario('TEST 2 exact food craving', [
    { user: 'I want Chicken Biryani', expect: 'recommendation', assert: ({ recommendation }) => recommendation.best?.item.id === 'I002' },
  ]);

  // ── TEST 3 — no hallucination for non-existent food —─
  await scenario('TEST 3 pizza not on menu', [
    {
      user: 'I want pizza',
      expect: 'recommendation',
      assert: ({ recommendation }) =>
        !recommendation.best?.item.name.toLowerCase().includes('pizza') &&
        /isn't currently available/.test(recommendation.explanation),
    },
  ]);

  // ── TEST 4 — budget respected once chosen ──
  await scenario('TEST 4 budget 50', [
    { user: 'I only have ₹50', expect: 'clarification', questionId: 'craving' },
    { user: "I'm craving something filling", expect: 'recommendation', assert: ({ recommendation }) => (recommendation.best?.item.price ?? 0) <= 50 },
  ]);

  // ── TEST 5 — vegetarian honors diet —─
  await scenario('TEST 5 vegetarian', [
    { user: "I'm vegetarian", expect: 'clarification', questionId: 'craving' },
    {
      user: 'I want something spicy',
      expect: 'recommendation',
      assert: ({ recommendation }) => recommendation.best?.item.dietType !== 'non-veg',
    },
  ]);

  // ── TEST 6 — time limit honored where data exists —─
  await scenario('TEST 6 time 10 min', [
    { user: 'I have 10 minutes', expect: 'clarification', questionId: 'craving' },
    {
      user: 'I want something spicy',
      expect: 'recommendation',
      assert: ({ recommendation }) => {
        const t = recommendation.best?.item.prepTime;
        return t === null || (t !== undefined && t <= 10);
      },
    },
  ]);

  // ── TEST 7 — cook marks item sold out ──
  console.log('\n── TEST 7 sold out chicken');
  const soldOutMenu = MENU.map(m => (m.id === 'I002' ? { ...m, available: false } : m));
  const t7 = await getRecommendation('I want Chicken Biryani', soldOutMenu, emptyContext());
  check('sold-out item never recommended', t7.recommendation.best?.item.id !== 'I002', `best=${t7.recommendation.best?.item.name ?? 'none'}`);
  check('sold-out message shown', /sold out/i.test(t7.recommendation.explanation), t7.recommendation.explanation.split('\n')[0]);

  // ── TEST 8 — cook price change read live —─
  console.log('\n── TEST 8 cook price change');
  const changedMenu = MENU.map(m => (m.id === 'I008' ? { ...m, price: 40 } : m));
  const t8 = await getRecommendation('I want Gulab Jamun', changedMenu, emptyContext());
  check('price change reflected', t8.recommendation.best?.item.price === 40, `price=${t8.recommendation.best?.item.price}`);

  // ── TEST 9 — conversation context + refinement —─
  await scenario('TEST 9 context & refinements', [
    { user: 'I want something spicy under ₹100 and I’m vegetarian', expect: 'recommendation' },
    {
      user: 'something cheaper',
      expect: 'recommendation',
      assert: ({ recommendation }) => (recommendation.best?.item.price ?? 999) < 65,
    },
    {
      user: 'Vegetarian only',
      expect: 'recommendation',
      assert: ({ recommendation }) => recommendation.best?.item.dietType !== 'non-veg',
    },
  ]);

  // ── TEST 10 — budget rescue —─
  await scenario('TEST 10 budget rescue', [
    {
      user: 'I want Chicken Biryani but I only have ₹70',
      expect: 'recommendation',
      assert: ({ recommendation }) =>
        recommendation.budgetRescue?.desired?.id === 'I002' &&
        recommendation.budgetRescue.overBudget > 0 &&
        recommendation.best?.item.id !== 'I002',
    },
  ]);

  // ── TEST 11 — too few candidates → recommend (rule 14) ──
  await scenario('TEST 11 few candidates recommend', [
    {
      user: "I'm craving something sweet under ₹30",
      expect: 'recommendation',
      assert: ({ recommendation }) => (recommendation.best?.item.price ?? 0) <= 30 && recommendation.best?.item.mood.includes('sweet'),
    },
  ]);

  // ── TEST 12 — skip answers move to next question ──
  await scenario('TEST 12 skip answer', [
    { user: "I'm hungry", expect: 'clarification', questionId: 'craving' },
    { user: 'Any', expect: 'clarification', questionId: 'budget' },
  ]);

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});