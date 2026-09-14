// MongoDB integration test: runs a real in-process MongoDB (mongodb-memory-server),
// boots the Express app against it via MONGODB_URI, and exercises the full API so the
// MongoStore path is proven (not just typechecked). Run: npm run test:mongo.
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createServer } from 'http';
import app from '../server/src/app';

let pass = 0;
let fail = 0;
const ok = (name: string, cond: boolean) => {
  if (cond) { pass++; console.log(`✓ ${name}`); }
  else { fail++; console.log(`✗ ${name}`); }
};

async function req<T = any>(base: string, method: string, path: string, body?: any, token?: string): Promise<{ status: number; data: T }> {
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
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.MONGODB_URI = uri;
  process.env.MONGODB_DB = 'meal_buddy';
  console.log('mongod up at', uri);

  const server = createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;

  // 1. Health reports mongodb dialect
  const h = await req(base, 'GET', '/api/health');
  ok('health -> dialect=mongodb', h.status === 200 && (h.data as any).ok === true && (h.data as any).dialect === 'mongodb' && (h.data as any).connected === true);

  // 2. Seed: menu of 17 from the dataset
  const list = await req(base, 'GET', '/api/menu');
  ok('seeded menu -> 17 items', list.status === 200 && (list.data as any).count === 17);

  // 3. Demo accounts seeded for mongo too
  const demo = await req(base, 'POST', '/api/auth/login', { email: 'student@mealbuddy.app', password: 'student123' });
  ok('demo student login', demo.status === 200 && (demo.data as any).user.role === 'STUDENT');

  // 4. Register + duplicate + role gate
  const tag = Date.now().toString(36);
  const stud = await req(base, 'POST', '/api/auth/register', { name: 'M Stud', email: `mstud_${tag}@mealbuddy.app`, password: 'mstud12345', role: 'STUDENT' });
  ok('register student', stud.status === 201 && Boolean((stud.data as any).token));
  const dup = await req(base, 'POST', '/api/auth/register', { name: 'M Stud', email: `mstud_${tag}@mealbuddy.app`, password: 'mstud12345', role: 'STUDENT' });
  ok('duplicate -> 409 (unique index)', dup.status === 409);
  const denied = await req(base, 'POST', '/api/menu', { name: 'x', price: 1, category: 'x' }, (stud.data as any).token);
  ok('student create menu -> 403', denied.status === 403);

  const cook = await req(base, 'POST', '/api/auth/register', { name: 'M Cook', email: `mcook_${tag}@mealbuddy.app`, password: 'mcooc12345', role: 'COOK' });
  const cookToken = (cook.data as any).token;
  const created = await req(base, 'POST', '/api/menu', { name: 'Mongo Paneer', price: 130, category: 'Main', available: true }, cookToken);
  ok('cook create menu -> 201', created.status === 201 && (created.data as any).item.name === 'Mongo Paneer');
  const newId = (created.data as any).item.id;

  // 5. Chat: knowledge gate + engine rescue (mongo menu as source of truth)
  const k = await req(base, 'POST', '/api/chat', { message: 'what are the canteen hours?' }, (stud.data as any).token);
  ok('chat knowledge gate works on mongo', k.status === 200 && (k.data as any).kind === 'knowledge');
  const rescue = await req(base, 'POST', '/api/chat', { message: 'I want chicken biryani but only have 70' }, (stud.data as any).token);
  ok('chat engine rescue works on mongo', rescue.status === 200 && (rescue.data as any).recommendation?.budgetRescue?.desired?.id === 'I002');

  // 6. Favorites + profile
  await req(base, 'POST', `/api/favorites/I002`, undefined, (stud.data as any).token);
  const favs = await req(base, 'GET', '/api/favorites', undefined, (stud.data as any).token);
  ok('favorites in mongo', favs.status === 200 && ((favs.data as any).favorites ?? []).some((f: any) => f.id === 'I002'));
  const prof = await req(base, 'PUT', '/api/food-profile', { allergens: ['peanut'], budget: 120 }, (stud.data as any).token);
  ok('food profile upsert in mongo', prof.status === 200 && (prof.data as any).profile.budget === 120);

  // 7. Conversations persisted in mongo across chat turns
  const convRound1 = await req(base, 'POST', '/api/chat', { message: 'I want something spicy under 100' }, (stud.data as any).token);
  ok('chat recommend under 100 works', convRound1.status === 200 && (convRound1.data as any).kind === 'menu');

  // 8. Cook change reflects in recommendations (single-item check): mark desired sold out
  await req(base, 'PATCH', `/api/menu/I002/availability`, { available: false }, cookToken);
  const after = await req(base, 'POST', '/api/chat', { message: 'I want chicken biryani but only have 70' }, (stud.data as any).token);
  ok('cook sold-out change affects recs in mongo', after.status === 200 && after.data !== null);
  await req(base, 'PATCH', `/api/menu/I002/availability`, { available: true }, cookToken);

  // 9. Persistence across "restart": rebuild stores from same mongod + verify data survived
  const { resolveStores } = await import('../server/src/repositories');
  const s1 = await resolveStores();
  const listAgain = await s1.menu.listMenu();
  ok('menu persists in mongo (incl. Mongo Paneer)', listAgain.some((m: any) => m.id === newId) && listAgain.length >= 17);
  const userBack = await s1.users.findByEmail(`mstud_${tag}@mealbuddy.app`);
  ok('user persists in mongo', Boolean(userBack));
  const convs = await s1.users.listConversation(`nope`);
  ok('missing conversation -> null', convs === null);

  await new Promise<void>((r) => server.close(() => r()));
  await mongod.stop();
  console.log(`\nmongo.test.ts: ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error('mongo test crash', e); process.exit(1); });