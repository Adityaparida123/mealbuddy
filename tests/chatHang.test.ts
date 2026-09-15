// Chat hang regression tests.
//
// Proves the production hangs are fixed:
//   1. "hello" / "hi" (greeting) short-circuit BEFORE any store/menu/AI work.
//   2. Every /api/chat variant returns 200 (hello, hi, thanks, spicy, sweet,
//      budget) instead of hanging at "Meal Buddy is thinking...".
//   3. Gemini requests carry an AbortController timeout; a hanging upstream
//      resolves fast and falls back to the deterministic engine order.
import { createServer } from 'http';
import app from '../backend/src/app';
import { GeminiProvider } from '../backend/src/services/ai';

let pass = 0;
let fail = 0;
let server: any;
let base: string;

let ok = (name: string, cond: boolean, detail = '') => {
  if (cond) { pass++; console.log(`✓ ${name}`); }
  else { fail++; console.log(`✗ ${name} ${detail}`); }
};

async function req<T = any>(method: string, path: string, body?: any, token?: string): Promise<{ status: number; data: T }> {
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
  return { status: res.status, data };
}

async function main() {
  const tag = Date.now().toString(36);
  const email = `hangstudent_${tag}@mealbuddy.app`;

  server = createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
  const port = server.address().port;
  base = `http://127.0.0.1:${port}`;

  const reg = await req('POST', '/api/auth/register', { name: 'Hang Student', email, password: 'hang12345', role: 'STUDENT' });
  ok('register -> token', reg.status === 201 && Boolean((reg.data as any).token));
  const token = (reg.data as any).token;

  // ── greeting fast-path: no stores/menu/AI, instant 200 ──
  for (const msg of ['hello', 'Hi']) {
    const t0 = Date.now();
    const r = await req('POST', '/api/chat', { message: msg }, token);
    const ms = Date.now() - t0;
    const rep = (r.data as any).recommendation;
    ok(
      `chat "${msg}" -> greeting fast-path 200 (${ms}ms)`,
      r.status === 200 && (r.data as any).kind === 'menu' &&
        rep?.explanation?.includes('in the mood for today') &&
        rep?.best === null && (r.data as any).aiUsed === false,
      `status=${r.status} ms=${ms}`
    );
  }

  // ── general chat / thanks should not hang either ──
  const thanks = await req('POST', '/api/chat', { message: 'thanks' }, token);
  ok('chat "thanks" -> 200 no hang', thanks.status === 200 && Boolean((thanks.data as any).context));

  // ── food variants return 200 and keep the state round-trip ──
  const spicy = await req('POST', '/api/chat', { message: 'I want something spicy' }, token);
  ok('chat spicy -> 200 (+ clarification)', spicy.status === 200 && (spicy.data as any).recommendation?.clarification?.questionId === 'budget');

  const sweet = await req('POST', '/api/chat', { message: 'I want something sweet' }, token);
  ok('chat sweet -> 200', sweet.status === 200 && Boolean((sweet.data as any).context));

  const budget = await req('POST', '/api/chat', { message: 'I only have ₹150' }, token);
  ok('chat budget ₹150 -> 200', budget.status === 200 && Boolean((budget.data as any).context));

  const turn2 = await req('POST', '/api/chat', { message: 'I only have ₹50', context: (spicy.data as any).context }, token);
  ok('chat spicy+₹50 -> Paneer Roll best', turn2.status === 200 && (turn2.data as any).recommendation?.best?.item?.name === 'Paneer Roll');

  // ── AI timeout fallback: a hanging Gemini upstream must not hang the route ──
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GEMINI_API_KEY;
  const originalProvider = process.env.AI_PROVIDER;
  const originalTimeout = process.env.AI_TIMEOUT_MS;
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.AI_PROVIDER = 'gemini';
  process.env.AI_TIMEOUT_MS = '300';
  // Hang ONLY on Gemini; everything else (the HTTP test client) works normally.
  // The stub must honour the AbortSignal so the provider's timeout fires.
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes('generativelanguage.googleapis.com')) {
      const signal = init?.signal;
      return new Promise<Response>((_resolve, reject) => {
        if (signal?.aborted) { reject(signal.reason ?? new DOMException('Aborted', 'AbortError')); return; }
        const onAbort = () => reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
        signal?.addEventListener('abort', onAbort, { once: true });
      });
    }
    return originalFetch(input, init);
  }) as typeof fetch;

  try {
    let t0 = Date.now();
    const r = await req('POST', '/api/chat', { message: 'I want something spicy and I only have ₹50' }, token);
    const ms = Date.now() - t0;
    const rep = (r.data as any).recommendation;
    ok(
      `route with hanging Gemini -> 200 + deterministic fallback (${ms}ms)`,
      r.status === 200 && rep?.best?.item?.name === 'Paneer Roll' && (r.data as any).aiUsed === false,
      `status=${r.status} ms=${ms} best=${rep?.best?.item?.name ?? 'none'} aiUsed=${(r.data as any).aiUsed}`
    );

    // Direct provider-level timeout:
    const provider = new GeminiProvider();
    const prefs = {
      message: 'I want something spicy',
      lowerMessage: 'i want something spicy',
      intent: 'food_recommendation' as const,
      budget: 50,
      time: null,
      diet: null,
      allergens: [],
      cravings: ['spicy'],
      dislikes: [],
      mood: [],
      foodQuery: [],
      wantedFood: null,
      foodRequestLike: false,
      wantsCheaper: false,
      wantsFaster: false,
      wantsVegRefine: false,
      wantsAvailability: false,
      isGreeting: false,
      isGeneralConversation: false,
      isMenuQuery: false,
      hasFoodRequest: true,
      answered: [],
    };
    t0 = Date.now();
    const ai = await provider.recommend({
      menu: [],
      prefs,
      context: { foodQuery: 'I want something spicy', budget: 50, historyLength: 0 },
    });
    const aiMs = Date.now() - t0;
    ok(
      'GeminiProvider.recommend resolves (live:false) on timeout',
      ai.live === false && Array.isArray(ai.rankedIds) && aiMs < 3000,
      `live=${ai.live} ms=${aiMs}`
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = originalKey;
    if (originalProvider === undefined) delete process.env.AI_PROVIDER; else process.env.AI_PROVIDER = originalProvider;
    if (originalTimeout === undefined) delete process.env.AI_TIMEOUT_MS; else process.env.AI_TIMEOUT_MS = originalTimeout;
  }

  await new Promise<void>((r) => server.close(() => r()));
  console.log(`\nchatHang.test.ts: ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error('chatHang test crash', e); process.exit(1); });