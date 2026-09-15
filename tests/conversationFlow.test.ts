// Conversation-flow regression tests (conversationFlow).
//
// Reproduces the EXACT production conversation that was broken end-to-end:
//   hello → "i want to eat something sweet" → "I have 10 minutes" → "I only have ₹150"
//
// Regression guarantees, all driven through the real HTTP API:
//   1. hello → greeting fast-path, exactly ONE conversational reply.
//   2. "i want to eat something sweet" → FOOD_RECOMMENDATION, craving=sweet, asks budget.
//   3. "I have 10 minutes" → MENU engine continuation: time=10 merged, craving
//      preserved, kind MUST be menu (the old bug returned knowledge because the
//      substring "nut" inside "minutes" hit the allergen RAG row).
//   4. "I only have ₹150" → budget=150 merged, craving/time preserved, kind menu.
//   5. Final recommendation uses craving=sweet + budget=150 + time=10.
//   6. "What allergens are in today's menu?" → kind knowledge (RAG), intent preserved.
//   7. "₹100" while a food conversation is active → budget=100, kind menu (NOT RAG).
//   8. "vegetarian" while a food conversation is active → diet=vegetarian, kind menu.
//   9. Exactly one greeting: greeting replies carry best=null + noSafeMatch falsy,
//      so the client's fallback box cannot duplicate the explanation.
//  10. Later turns with null fields never erase existing state.
import { createServer } from 'http';
import app from '../backend/src/app';

let pass = 0;
let fail = 0;
let server: any;
let base: string;

let ok = (name: string, cond: boolean, detail = '') => {
  if (cond) { pass++; console.log(`✓ ${name}`); }
  else { fail++; console.log(`✗ ${name} ${detail}`); }
};

async function req<T = any>(method: string, path: string, body?: any, token?: string): Promise<{ status: number; data: T; raw: string }> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(base + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data, raw: text };
}

async function chat(message: string, token: string, context?: any): Promise<any> {
  const r = await req('POST', '/api/chat', context ? { message, context } : { message }, token);
  return r.data;
}

async function main() {
  const tag = Date.now().toString(36);
  const email = `flowstudent_${tag}@mealbuddy.app`;

  server = createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;

  const reg = await req('POST', '/api/auth/register', { name: 'Flow Student', email, password: 'flow12345', role: 'STUDENT' });
  ok('register -> token', reg.status === 201 && Boolean((reg.data as any).token));
  const token = (reg.data as any).token;

  // ── 1. hello → exactly one conversational reply ──
  const hello = await chat('hello', token);
  const helloRec = hello.recommendation;
  ok(
    'hello -> greeting fast-path (kind menu, intent greeting)',
    hello.kind === 'menu' && hello.context.conversationIntent === 'greeting' &&
      helloRec?.best === null && helloRec?.aiUsed === false,
    JSON.stringify(hello)
  );
  ok('hello -> "in the mood for today" greeting', String(helloRec?.explanation).includes('in the mood for today'));
  ok(
    'hello -> exactly ONE greeting text in the wire payload',
    (JSON.stringify(hello).match(/in the mood for today/g) ?? []).length === 1,
    JSON.stringify(hello)
  );
  ok(
    'hello -> reply is not a noSafeMatch, so no duplicate fallback box',
    helloRec?.noSafeMatch == null,
    JSON.stringify(helloRec)
  );

  // ── 2. craving opens a food conversation, budget asked ──
  const sweet = await chat('i want to eat something sweet', token);
  ok(
    'sweet -> food_recommendation, craving=[sweet], asks budget',
    sweet.kind === 'menu' &&
      sweet.context.conversationIntent === 'food_recommendation' &&
      (sweet.context.cravings ?? []).includes('sweet') &&
      sweet.recommendation?.clarification?.questionId === 'budget',
    JSON.stringify(sweet)
  );

  // ── 3. "I have 10 minutes" MUST continue the food conversation (NOT RAG) ──
  const minutes = await chat('I have 10 minutes', token, sweet.context);
  ok(
    '10 minutes -> kind menu (NOT knowledge), time merged, craving kept',
    minutes.kind === 'menu' &&
      minutes.context.conversationIntent === 'food_recommendation' &&
      minutes.context.time === 10 &&
      (minutes.context.cravings ?? []).includes('sweet'),
    JSON.stringify(minutes)
  );
  ok('10 minutes -> budget still not answered (flow continues)', minutes.recommendation?.clarification?.questionId !== 'budget');

  // ── 4. "I only have ₹150" merges budget, keeps craving + time ──
  const rupees = await chat('I only have ₹150', token, minutes.context);
  ok(
    '₹150 -> kind menu (NOT knowledge), budget=150, craving+time preserved',
    rupees.kind === 'menu' &&
      rupees.context.budget === 150 &&
      rupees.context.time === 10 &&
      (rupees.context.cravings ?? []).includes('sweet'),
    JSON.stringify(rupees)
  );
  ok(
    '₹150 -> answered includes craving/time/budget',
    ['craving', 'time', 'budget'].every(q => (rupees.context.answered ?? []).includes(q)),
    JSON.stringify(rupees.context.answered)
  );

  // ── 5. finish the flow: recommendation uses sweet + ₹150 + 10 min ──
  const veggy = await chat('I\'m vegetarian', token, rupees.context);
  const fb = veggy.recommendation?.best?.item;
  ok(
    'vegetarian turn -> recommendation (Peanut Chikki) within sweet + budget 150 + time 10',
    veggy.kind === 'menu' &&
      Boolean(fb) && fb.name === 'Peanut Chikki' &&
      (fb.mood ?? []).includes('sweet') &&
      fb.price <= 150 && fb.prepTime != null && fb.prepTime <= 10,
    JSON.stringify(fb ?? veggy.recommendation)
  );

  // ── 6. explicit knowledge question still routes to RAG ──
  const allergensQ = await chat('What allergens are in today\'s menu?', token);
  ok(
    'What allergens are in today\'s menu? -> kind knowledge (RAG)',
    allergensQ.kind === 'knowledge' && typeof allergensQ.answer === 'string' && allergensQ.answer.length > 0,
    JSON.stringify(allergensQ)
  );
  const hoursQ = await chat('when is dinner?', token);
  ok('when is dinner? -> kind knowledge (RAG)', hoursQ.kind === 'knowledge', JSON.stringify(hoursQ));

  // ── 7. "₹100" during an active food conversation → budget, NOT RAG ──
  const spicy = await chat("I'm craving something spicy", token);
  const hundred = await chat('₹100', token, spicy.context);
  ok(
    '₹100 while food active -> budget=100, kind menu (NOT knowledge)',
    hundred.kind === 'menu' && hundred.context.budget === 100 &&
      (hundred.context.cravings ?? []).includes('spicy'),
    JSON.stringify(hundred)
  );

  // ── 8. "vegetarian" during an active food conversation → diet, NOT RAG ──
  const sweet2 = await chat('i want to eat something sweet', token);
  const veg = await chat('I\'m vegetarian', token, sweet2.context);
  ok(
    'vegetarian while food active -> diet=vegetarian, kind menu (NOT knowledge)',
    veg.kind === 'menu' && veg.context.diet === 'vegetarian' &&
      (veg.context.cravings ?? []).includes('sweet'),
    JSON.stringify(veg)
  );

  // ── 9. greeting reply contract prevents a duplicate fallback box ──
  ok(
    'greeting carries best=null + noSafeMatch falsy (single render path)',
    hello.kind === 'menu' && hello.recommendation?.best === null && hello.recommendation?.noSafeMatch == null,
    JSON.stringify(hello.recommendation)
  );
  const gone = await chat('I only have ₹5 and I want something spicy', token);
  ok(
    'genuine no-match still flagged noSafeMatch (fallback box path preserved)',
    gone.kind === 'menu' && gone.recommendation?.noSafeMatch === true && gone.recommendation?.best === null,
    JSON.stringify(gone?.recommendation)
  );

  // ── 10. null fields never erase existing state ──
  const nullTurn = await chat('hello', token, { ...sweet.context, budget: 150, time: 10 });
  ok(
    'null-rich later turn keeps prior craving/budget/time',
    (nullTurn.context.cravings ?? []).includes('sweet') && nullTurn.context.budget === 150 && nullTurn.context.time === 10,
    JSON.stringify(nullTurn.context)
  );

  await new Promise<void>((r) => server.close(() => r()));
  console.log(`\nconversationFlow.test.ts: ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error('conversationFlow test crash', e); process.exit(1); });