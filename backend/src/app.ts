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

const corsOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(',').map(o => o.trim()).filter(Boolean)
  : true;

app.use(helmet());
app.use(cors({ origin: corsOrigins }));
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