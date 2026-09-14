// Conversation-state tests (chatState).
//
// Proves the two production bugs are fixed at the logic level:
//   1. MOJIBAKE — options/columns in the UI come straight from clarifier
//      strings; they must come out as proper UTF-8 (₹, em dashes).
//   2. STATE LOOP — information gathered across turns (craving, budget, diet,
//      allergies) is merged into a persistent ChatContext and never re-asked.
//
// The turn-loop below mirrors exactly what backend/src/routes/chat.ts does:
//   getRecommendation(message, items, context)   // engine merges prefs into ctx
//   buildContext(engine.prefs, ctx, questionId)  // returns the NEXT state
//   the returned state is sent back by the client on the next request.
//
// So these tests are a faithful replica of the real production path.
import { getRecommendation, extractUserPreferences, type EngineResult } from '../shared/src/engine';
import { emptyContext, type ChatContext } from '../shared/src/types/chat';
import { buildContext } from '../backend/src/routes/chat';
import menu from '../shared/src/data/menu.json';
import type { MenuItem } from '../shared/src/types/menu';

const MENU = menu as MenuItem[];

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

async function turn(message: string, ctx: ChatContext): Promise<{ ctx: ChatContext; engine: EngineResult }> {
  const engine = await getRecommendation(message, MENU, ctx);
  const next = buildContext(engine.prefs, ctx, engine.recommendation.clarification?.questionId ?? null);
  return { ctx: next, engine };
}

function questionId(engine: EngineResult): string | null {
  return engine.recommendation.clarification?.questionId ?? null;
}

function bestName(engine: EngineResult): string | null {
  return engine.recommendation.best?.item.name ?? null;
}

async function scenario(
  label: string,
  steps: {
    user: string;
    expect: 'clarification' | 'recommendation';
    questionId?: string;
    note?: string;
    assert?: (e: EngineResult, c: ChatContext) => boolean;
  }[]
): Promise<void> {
  console.log(`\n── ${label}`);
  let ctx = emptyContext();
  for (const step of steps) {
    const { ctx: next, engine } = await turn(step.user, ctx);
    ctx = next;
    const q = questionId(engine);
    let ok = step.expect === 'clarification'
      ? q != null && (step.questionId ? q === step.questionId : true)
      : q == null && Boolean(engine.recommendation.best);
    if (step.assert) ok = ok && step.assert(engine, ctx) !== false;
    check(
      `[${step.user}] ${step.note ?? ''}`,
      ok,
      `q=${q} best=${bestName(engine) ?? 'none'} budget=${ctx.budget} answered=[${ctx.answered.join(',')}]`
    );
  }
}

async function main(): Promise<void> {
  // ── A — budget captured in turn 2 and never re-asked ──
  await scenario('A: budget from turn 2 carries into the recommendation', [
    { user: "I'm craving something spicy", expect: 'clarification', questionId: 'budget' },
    {
      user: 'I only have ₹150',
      expect: 'clarification',
      questionId: 'diet',
      note: '(NOT craving/budget — state held)',
      assert: (_e, c) => c.budget === 150 && c.cravings.includes('spicy'),
    },
    {
      user: "I'm vegetarian",
      expect: 'recommendation',
      assert: (e, c) =>
        (e.recommendation.best?.item.dietType ?? 'x') !== 'non-veg' &&
        (e.recommendation.best?.item.price ?? 999) <= (c.budget ?? 999),
    },
  ]);

  // ── B — "No budget limit" answers the budget question without a number ──
  await scenario('B: "No budget limit" skips the budget question', [
    { user: "I'm craving something spicy", expect: 'clarification', questionId: 'budget' },
    {
      user: 'No budget limit',
      expect: 'clarification',
      questionId: 'diet',
      note: '(moves on — budget skipped, never re-asked)',
      assert: (_e, c) => c.budget === null && c.answered.includes('budget'),
    },
  ]);

  // ── C — veg + spicy in separate turns narrows straight to a recommendation ──
  await scenario('C: veg-turn + spicy-turn pool of 2 → immediate recommendation', [
    { user: 'I am vegetarian', expect: 'clarification', questionId: 'craving' },
    {
      user: 'I want something spicy and I only have ₹150',
      expect: 'recommendation',
      assert: (e) =>
        (e.recommendation.best?.item.dietType ?? 'x') !== 'non-veg' &&
        (e.recommendation.best?.item.spiceLevel ?? '') === 'spicy' &&
        (e.recommendation.best?.item.price ?? 999) <= 150,
    },
  ]);

  // ── D — quick-reply button payloads path (curl/UI parity) ──
  await scenario('D: button payload "I only have ₹50" → Paneer Roll only', [
    { user: "I'm craving something spicy", expect: 'clarification', questionId: 'budget' },
    {
      user: 'I only have ₹50',
      expect: 'recommendation',
      note: '(pool narrows to 1 spicy item ≤ ₹50)',
      assert: (e) => bestName(e) === 'Paneer Roll' && (e.recommendation.best?.item.price ?? 999) <= 50,
    },
  ]);

  // ── E — every question asked at most once; ends in a recommendation ──
  await scenario('E: 5-turn survival — craving→budget→diet→allergy→recommend', [
    { user: 'recommend', expect: 'clarification', questionId: 'craving' },
    { user: "I'm craving something spicy", expect: 'clarification', questionId: 'budget' },
    { user: 'I only have ₹150', expect: 'clarification', questionId: 'diet' },
    { user: 'Any', expect: 'clarification', questionId: 'allergy' },
    { user: 'I have no food allergies', expect: 'recommendation' },
  ]);

  // ── G — state is idempotent and survives a no-op turn ──
  await scenario('G: repeated informative turn keeps constraints stable', [
    { user: "I'm craving something spicy", expect: 'clarification', questionId: 'budget' },
    { user: 'I only have ₹50', expect: 'recommendation' },
    {
      user: "I'm craving something spicy",
      expect: 'recommendation',
      note: '(re-assert same craving — still constrained by prior budget)',
      assert: (e) => (e.recommendation.best?.item.price ?? 999) <= 50,
    },
  ]);

  // ── UTF-8 regression (production mojibake bug) ──
  console.log('\n── ENCODING + budget pattern regression');
  const cl = (await getRecommendation("I'm craving something spicy", MENU, emptyContext())).recommendation.clarification;
  check(
    'budget option labels start with ₹ (no mojibake)',
    Boolean(cl && cl.options.filter(o => !/no limit/i.test(o.label)).every(o => o.label.startsWith('₹'))),
    JSON.stringify(cl?.options)
  );
  check('₹150 payload parses into budget 150', extractUserPreferences('I only have ₹150').budget === 150);
  check('"my budget is ₹100" parses into budget 100', extractUserPreferences('my budget is ₹100').budget === 100);
  check('"my budget is 100" parses into budget 100', extractUserPreferences('my budget is 100').budget === 100);
  const skipNoLimit = extractUserPreferences('No budget limit');
  check('"No budget limit" is a skip (no budget, marked answered)',
    skipNoLimit.budget === null && skipNoLimit.answered.includes('budget'));

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});