# 🍱 Meal Buddy

Your AI-powered college canteen assistant.

Two roles:
- **👨‍🎓 Student** — chat naturally with Meal Buddy: tell it what you're craving, your budget, allergies, dietary preferences and prep-time limit, and get explainable recommendations from today's menu.
- **👨‍🍳 Canteen Cook** — manage today's menu: add, edit, delete, change prices/ingredients/allergens, and toggle availability. Students see these changes instantly.

## Hybrid AI architecture

Meal Buddy uses a **hybrid AI recommendation architecture**.

**Deterministic rules enforce safety-critical constraints** — allergies, availability and menu validity are hard gates. An item with an allergy conflict is *removed* from the candidate pool, never merely penalized. The AI can only ever see and recommend items that exist in the current menu and satisfy every hard constraint.

**Gemini handles natural language understanding, craving detection, ranking and explanations.**

This prevents hallucinated food recommendations while preserving a natural, conversational experience. Even when Gemini responds, the app re-validates the final recommendation against the live menu, availability, allergies, diet, budget and preparation time before displaying it.

### Recommendation priority

1. 🛡️ **Allergy safety** (hard gate)
2. 🍔 **What the user actually wants to eat** (craving / requested food)
3. 🍱 **Current menu + availability** (hard gates)
4. 🥗 Dietary preference
5. 💰 Budget (with **Budget Rescue** when the desired item is over budget)
6. ⏱️ Preparation time
7. ⭐ Other preferences

Match scores are computed from real criteria (food/craving match 40%, tag match 25%, budget 15%, diet 10%, time 10%) — never randomly generated.

## Dataset

The menu comes from `canteen_chatbot_dataset (2).xlsx`, sheet **`Menu_Items`** (17 items), normalized to `shared/src/data/menu.json` by `scripts/convert_menu.py`. Fields that the dataset does not support are `null` / `[]` — nothing is fabricated.

```bash
python scripts/convert_menu.py            # regen menu.json from the xlsx (requires openpyxl)
```

## Getting started (local, zero-config)

```bash
npm install              # root scripts + test deps (tsx, typescript, mongodb-memory-server)
npm install --prefix frontend   # React/Vite deps
npm install --prefix backend    # Express/tsx deps
npm run dev:server   # API server -> http://localhost:5000 (uses .data/mealbuddy.json)
npm run dev          # frontend     -> http://localhost:5173
```

No database is required locally: when `MONGODB_URI` is unset the backend falls
back to a JSON file store (`.data/mealbuddy.json`) and still seeds the dataset
menu + demo accounts.
Demo accounts: `student@mealbuddy.app` / `student123` and `cook@mealbuddy.app` / `cook123`.

To use **MongoDB Atlas locally**, copy `backend/.env.example` to `backend/.env`, set
`MONGODB_URI`, then restart the server. `MONGODB_DB=meal_buddy` is the default
database name. No code changes are needed — the same route code backs both
stores.

## Environment variables

| Variable | Side | Required | Description |
| --- | --- | --- | --- |
| `MONGODB_URI` | server | prod | MongoDB Atlas connection string (your Atlas dashboard → Connect → Drivers) for database `meal_buddy`. Empty in dev → local JSON store. |
| `MONGODB_DB` | server | no | Atlas database name. Default `meal_buddy`. |
| `JWT_SECRET` | server | prod | 32+ char secret signing JWTs. Generate: `openssl rand -hex 32`. |
| `JWT_EXPIRES_IN` | server | no | JWT lifetime. Default `7d`. |
| `GEMINI_API_KEY` | server | no* | Gemini API key — **server-side only**, never exposed to the browser. |
| `GEMINI_MODEL` | server | no | Gemini model id. Default `gemini-1.5-flash`. |
| `AI_PROVIDER` | server | no | `gemini` (default) or `vertex`. |
| `VERTEX_PROJECT_ID` / `VERTEX_LOCATION` / `GOOGLE_APPLICATION_CREDENTIALS` | server | no | Optional Vertex AI provider config. |
| `CLIENT_ORIGIN` | server | prod | Comma-separated CORS origins for the API (e.g. the Vercel frontend URL). |
| `PORT` | server | no | Backend port. Default `5000`; Render injects its own. |
| `VITE_API_URL` | browser | prod | Base URL of the deployed backend (e.g. `https://mealbuddy-api.onrender.com`). |
| `VITE_GEMINI_API_KEY` / `VITE_GEMINI_MODEL` | browser | no | *Legacy client-side* Gemini call — only used when running without the backend. Prefer server-side `GEMINI_API_KEY`. |

\* Recommended for the full AI experience (live Gemini reranking). Without a key
the backend uses the deterministic engine + RAG knowledge gate (still fully functional).

> **Security rule:** `MONGODB_URI`, `JWT_SECRET` and `GEMINI_API_KEY` must only
> ever be set on the backend (Render). Never prefix a secret with `VITE_` —
> Vite bundles anything `VITE_`-prefixed into the public JavaScript bundle.

## Production deployment (Vercel + Render + MongoDB Atlas)

The production architecture is a 3-tier stack:

```
Browser (Vercel SPA)  --HTTPS /api/*-->  Express API (Render)  --MongoDB-->  Atlas
              ^                             |  JWT auth (bcrypt + jsonwebtoken)
              └─ VITE_API_URL               └─ Gemini API / Vertex + RAG (server-side)
```

- **Database** — MongoDB Atlas (M0 free tier is fine). Database name: `meal_buddy`.
- **Backend** — Render Web Service (Node), `render.yaml` sets `rootDir: backend`, run with tsx.
- **Frontend** — Vercel, `vercel.json` sets `rootDirectory: frontend`, Vite build output in `dist/`.
- **Secrets** — only in Atlas/Render settings or Vercel dashboard; never in GitHub.

### 1. MongoDB Atlas setup

1. Create a cluster (M0 shared, any region).
2. Security → Database Access → add a database user (e.g. `mealbuddy`) with a
   strong password, **read/write** on `meal_buddy`.
3. Security → Network Access → allow the IPs that will connect (or `0.0.0.0/0`
   with Atlas IP restrictions via the Render/Vercel firewall).
4. Database → Connect → "Drivers" → copy the connection string and paste it
   as the value of `MONGODB_URI` (format: `your_mongodb_atlas_connection_string`).
5. On first boot the backend **seeds** the 17-item dataset menu + demo accounts
   into collections: `users`, `menuItems`, `foodProfiles`, `favorites`, `conversations`.

### 2. Backend — Render

1. Push the repo to GitHub.
2. Render dashboard → **New + → Blueprint** → select the repo. Render reads
   `render.yaml` automatically (service `mealbuddy-api`, `rootDir: backend`,
   build `npm install --include=dev && npm run build`, start `npm start`).
   Alternatively: **New + → Web Service** with these settings:
   - **Root directory:** `backend`
   - **Build command:** `npm install --include=dev && npm run build`
   - **Start command:** `npm start`
   - **Health check path:** `/api/health`  ← returns `{ ok: true, dialect: "mongodb" }` when Atlas is reachable
   - **Environment variables** (all secrets as `hElp`: set one at a time):
     `MONGODB_URI`, `MONGODB_DB=meal_buddy`, `JWT_SECRET`, `GEMINI_API_KEY`,
     `AI_PROVIDER=gemini`, `CLIENT_ORIGIN=https://<your-vercel-app>.vercel.app`,
     `NODE_ENV=production` (Render sets `PORT` itself).
3. Note the deployed URL, e.g. `https://mealbuddy-api.onrender.com`.

### 3. Frontend — Vercel

1. Vercel dashboard → **Add New → Project** → import the same GitHub repo.
2. Vercel auto-detects Vite (`vercel.json` pins `framework: vite`,
   `rootDirectory: frontend`, `buildCommand: npm run build`,
   `outputDirectory: dist`).
3. **Environment variable:** `VITE_API_URL=https://mealbuddy-api.onrender.com`
   (the Render backend from step 2). Redeploy after adding it.
4. Update the backend's `CLIENT_ORIGIN` to the final Vercel URL
   (`https://<your-project>.vercel.app`) so CORS allows the browser calls.

### 4. Verify the live stack

After both deployments are green:

- `GET https://mealbuddy-api.onrender.com/api/health` → `{"ok":true,"dialect":"mongodb","connected":true}`.
- `POST /api/auth/register` (student) → `201` + JWT; register a cook with `role:"COOK"`.
- `GET /api/menu` with a **cook** token → CRUD items; a **student** token is `403` on writes.
- `POST /api/chat` with a student token → RAG knowledge answers + engine recommendations;
  set an item sold out as cook → the next chat recommendation reflects it.
- The frontend at the Vercel URL loads and talks to the Render API via `VITE_API_URL`.

### Files that make this work

| File | Purpose |
| --- | --- |
| `render.yaml` | Render Blueprint — backend Web Service (`rootDir: backend`), env mapping, health check. |
| `vercel.json` | Vercel — Vite framework, `rootDirectory: frontend`, build command, `dist/` output. |
| `backend/.env.example` | Server env vars (no real secrets). Copy to `backend/.env` locally. |
| `frontend/.env.example` | Browser (`VITE_*`) env vars (no real secrets). Copy to `frontend/.env` locally. |
| `.gitignore` | `.env`/`.env.*` ignored; secrets never enter git. |

## Persistence

- Initial menu: dataset → `shared/src/data/menu.json` (via `scripts/convert_menu.py`).
- Runtime: Express API persists to **MongoDB Atlas** when `MONGODB_URI` is set
  (collections: `users`, `menuItems`, `foodProfiles`, `favorites`,
  `conversations`), otherwise a local JSON store at `.data/mealbuddy.json`
  (zero-setup local dev).
- Cook edits persist across refreshes; the Student chatbot reads the latest
  state via the API.

## How to run (full stack)

Requires Node 18+ (uses native `fetch` in tests).

1. `npm install` (root) + `npm install --prefix frontend` + `npm install --prefix backend`
2. Terminal A — API server → `npm run dev:server` → http://localhost:5000
3. Terminal B — frontend → `npm run dev` → http://localhost:5173
4. Open **Student** to chat, **Canteen Cook** to manage the menu.

Local state lives in `.data/mealbuddy.json`. To use MongoDB Atlas instead
(production), copy `backend/.env.example` to `backend/.env`, set `MONGODB_URI`
(and optionally `MONGODB_DB=meal_buddy`), then restart the server — no code
changes needed.

### Tests

```bash
npm test            # runs the whole suite: engine + live API (42 checks total)
npm run test:engine # deterministic recommendation engine (26 checks)
npm run test:api    # boots the real Express app and exercises auth/menu/chat/favorites (16 checks)
npm run typecheck   # TypeScript (frontend + backend + shared)
```

## Demo flow for judges

Try these in the Student chat (from the actual dataset menu):
- *"I'm allergic to peanuts"* → Peanut Chikki is never recommended.
- *"I want Chicken Biryani"* → prioritized if available/safe.
- *"I want pizza"* → politely says it isn't on the menu; suggests closest real items.
- *"I only have ₹50"* → items ≤ ₹50 prioritized.
- *"I'm vegetarian"* → non-veg items excluded.
- *"I have 10 minutes"* → items with prep time > 10 min excluded.
- In the Cook dashboard, mark an item **Sold Out** or change its price → the Student assistant reflects the change immediately.