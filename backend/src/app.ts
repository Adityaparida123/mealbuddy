import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { checkDbHealth } from './lib/mongo';
import authRoutes from './routes/auth';
import menuRoutes from './routes/menu';
import chatRoutes from './routes/chat';
import favoritesRoutes from './routes/favorites';
import foodProfileRoutes from './routes/foodProfile';

const app = express();

// Normalize each allowlisted origin: trim whitespace, strip surrounding
// quotes, and drop trailing slashes. The `cors` package compares origins
// byte-for-byte, so an env value like "https://app.vercel.app/" (with a
// trailing slash or quotes) silently fails every preflight — this makes it
// tolerant of those classic mistakes without loosening CORS.
const normalizeOrigin = (o: string) => o.trim().replace(/^["']+|["']+$/g, '').replace(/\/+$/, '');
const corsOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(',').map(normalizeOrigin).filter(Boolean)
  : true;

app.use(helmet());
app.use(cors({ origin: corsOrigins }));
if (Array.isArray(corsOrigins)) {
  console.log(`[mealbuddy] CORS allowlist: ${corsOrigins.map(o => JSON.stringify(o)).join(', ')}`);
}

// Guarantee UTF-8 on every response (res.json already sets charset=utf-8;
// this keeps it explicit through proxies and for all error paths).
app.use((_req, res, next) => {
  res.set('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.use(express.json({ limit: '256kb' }));
app.use(morgan('tiny'));

app.get('/api/health', async (_req, res) => {
  const health = await checkDbHealth();
  res.json({ ok: true, ...health });
});

app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/food-profile', foodProfileRoutes);

app.use('/api/version', (_req, res) => {
  res.json({ app: 'mealbuddy', version: '1.0.0', engine: 'deterministic+v2' });
});

// Not found handler for /api/*
app.use((req, res, _next) => {
  if (req.path.startsWith('/api')) {
    res.status(404).json({ error: 'Not found.' });
    return;
  }
  res.status(404).json({ error: 'Not found.' });
});

export default app;