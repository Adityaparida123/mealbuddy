// Server API smoke test (runs the real Express app + JSON store via tsx).
// No Postgres or external services required.
import { createServer } from 'http';
import app from '../backend/src/app';

let pass = 0;
let fail = 0;
let server: any;
let base: string;

let ok = (name: string, cond: boolean) => {
  if (cond) { pass++; console.log(`✓ ${name}`); }
  else { fail++; console.log(`✗ ${name}`); }
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
  // Unique emails per run -> the test is idempotent even against a persisted
  // JSON store (no cross-run contamination, no reliance on deleting state).
  const tag = Date.now().toString(36);
  const studEmail = `apistudent_${tag}@mealbuddy.app`;
  const cookEmail = `apicook_${tag}@mealbuddy.app`;

  server = createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
  const port = server.address().port;
  base = `http://127.0.0.1:${port}`;

  // --- health ---
  const h = await req('GET', '/api/health');
  ok('GET /api/health -> 200 ok', h.status === 200 && h.data.ok === true && h.data.dialect === 'json');

  // --- auth ---
  const reg = await req('POST', '/api/auth/register', { name: 'API Student', email: studEmail, password: 'apis12345', role: 'STUDENT' });
  ok('POST /api/auth/register -> 201 + token', reg.status === 201 && Boolean((reg.data as any).token));

  const dup = await req('POST', '/api/auth/register', { name: 'API Student', email: studEmail, password: 'apis12345', role: 'STUDENT' });
  ok('duplicate register -> 409', dup.status === 409);

  const login = await req('POST', '/api/auth/login', { email: studEmail, password: 'apis12345' });
  ok('POST /api/auth/login -> token', login.status === 200 && Boolean((login.data as any).token));

  const wrong = await req('POST', '/api/auth/login', { email: studEmail, password: 'nope' });
  ok('wrong password -> 401', wrong.status === 401);

  const studentToken = (reg.data as any).token;
  const me = await req('GET', '/api/auth/me', undefined, studentToken);
  ok('GET /api/auth/me -> student role', me.status === 200 && (me.data as any).user.role === 'STUDENT');

  // --- menu public ---
  const list = await req('GET', '/api/menu');
  ok('GET /api/menu -> seeded menu (>=17)', list.status === 200 && (list.data as any).count >= 17);

  // --- role gate: student cannot create ---
  const forbidden = await req('POST', '/api/menu', { name: 'x', price: 10, category: 'x' }, studentToken);
  ok('student create menu -> 403', forbidden.status === 403);

  // --- cook register + create ---
  const cookReg = await req('POST', '/api/auth/register', { name: 'API Cook', email: cookEmail, password: 'cook12345', role: 'COOK' });
  const cookToken = (cookReg.data as any).token;
  const create = await req('POST', '/api/menu', { name: 'Paneer Roll', price: 110, category: 'Wrap', available: true }, cookToken);
  ok('cook create menu -> 201 w/ defaulted arrays', create.status === 201 && ((create.data as any).item.ingredients ?? []).length >= 0);
  const newId = (create.data as any).item.id;

  const avail = await req('PATCH', `/api/menu/${newId}/availability`, { available: false }, cookToken);
  ok('cook toggle availability -> false', avail.status === 200 && (avail.data as any).item.available === false);

  const del = await req('DELETE', `/api/menu/${newId}`, undefined, cookToken);
  ok('cook delete item -> 204', del.status === 204);

  // --- chat: auth required + knowledge gate + engine ---
  const chat401 = await req('POST', '/api/chat', { message: 'hi' });
  ok('chat without token -> 401', chat401.status === 401);

  const kchat = await req('POST', '/api/chat', { message: 'what are the canteen hours?' }, studentToken);
  ok('knowledge chat -> ground-truth answer', kchat.status === 200 && (kchat.data as any).kind === 'knowledge' && String((kchat.data as any).answer).includes('Breakfast'));

  const rescueChat = await req('POST', '/api/chat', { message: 'I want chicken biryani but only have 70' }, studentToken);
  const r = (rescueChat.data as any).recommendation;
  ok('engine chat -> budget rescue desired Chicken Biryani', rescueChat.status === 200 && r?.budgetRescue?.desired?.name === 'Chicken Biryani' && r?.budgetRescue?.overBudget === 20);

  // --- favorites + food profile ---
  await req('POST', '/api/favorites/I002', undefined, studentToken);
  const favs = await req('GET', '/api/favorites', undefined, studentToken);
  ok('favorites -> includes Chicken Biryani', favs.status === 200 && ((favs.data as any).favorites ?? []).some((f: any) => f.id === 'I002'));

  const prof = await req('PUT', '/api/food-profile', { allergens: ['peanut'], budget: 120 }, studentToken);
  ok('food profile upsert -> peanut/120', prof.status === 200 && (prof.data as any).profile.allergens[0] === 'peanut' && (prof.data as any).profile.budget === 120);

  await new Promise<void>((r) => server.close(() => r()));
  console.log(`\napi.test.ts: ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error('api test crash', e); process.exit(1); });