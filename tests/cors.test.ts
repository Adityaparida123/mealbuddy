// CORS preflight + allowlist test (runs the real Express app via tsx).
// Verifies that an OPTIONS preflight from an allowlisted origin returns the
// Access-Control-Allow-Origin header (never '*'), that disallowed origins are
// rejected, and that quote/trailing-slash env values are normalized.
// Deliberately messy env value: a trailing slash on the first origin and
// surrounding quotes on the second. Browsers always send a clean origin, so
// the server must normalize the configured value before comparing.
process.env.CLIENT_ORIGIN = 'https://mealbuddy-three.vercel.app/, "http://localhost:5173"';

import { createServer } from 'http';

let pass = 0;
let fail = 0;
let server: any;
let base: string;

let ok = (name: string, cond: boolean) => {
  if (cond) { pass++; console.log(`✓ ${name}`); }
  else { fail++; console.log(`✗ ${name}`); }
};

async function preflight(origin: string, path = '/api/auth/login') {
  const res = await fetch(base + path, {
    method: 'OPTIONS',
    headers: {
      origin,
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type',
    },
  });
  return {
    status: res.status,
    acao: res.headers.get('access-control-allow-origin'),
    acam: res.headers.get('access-control-allow-methods'),
    acah: res.headers.get('access-control-allow-headers'),
  };
}

async function main() {
  const { default: app } = await import('../backend/src/app');
  server = createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;

  const allowed = await preflight('https://mealbuddy-three.vercel.app');
  ok('OPTIONS /api/auth/login (allowed origin) -> 204', allowed.status === 204);
  ok('Access-Control-Allow-Origin reflects allowed origin', allowed.acao === 'https://mealbuddy-three.vercel.app');
  ok('Access-Control-Allow-Origin is not *', allowed.acao !== '*');
  ok('Access-Control-Allow-Methods includes POST',
    allowed.acam !== null && allowed.acam.toUpperCase().includes('POST'));
  ok('Access-Control-Allow-Headers reflects content-type',
    allowed.acah !== null && allowed.acah.toLowerCase().includes('content-type'));

  const second = await preflight('http://localhost:5173');
  ok('second allowlisted origin works', second.acao === 'http://localhost:5173');

  const denied = await preflight('https://evil.example.com');
  ok('disallowed origin -> no access-control-allow-origin', denied.acao === null);

  // the allowlist values normalized above still resolve the clean browser origin
  const fancy = await preflight('https://mealbuddy-three.vercel.app');
  ok('trailing-slash env value still resolves clean origin', fancy.acao === 'https://mealbuddy-three.vercel.app');
  const quoted = await preflight('http://localhost:5173');
  ok('quoted env value still resolves clean origin', quoted.acao === 'http://localhost:5173');

  const plain = await fetch(base + '/api/health', {
    headers: { origin: 'https://mealbuddy-three.vercel.app' },
  });
  ok('GET /api/health -> 200 + ACAO',
    plain.status === 200 && plain.headers.get('access-control-allow-origin') === 'https://mealbuddy-three.vercel.app');

  await new Promise<void>((r) => server.close(() => r()));
  console.log(`\ncors.test.ts: ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error('cors test crash', e); process.exit(1); });