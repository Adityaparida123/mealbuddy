import 'dotenv/config';
import { getStores } from './lib/resolvers';
import { env, envInt } from './lib/env';
import { isMongoConfigured } from './lib/mongo';

const PORT = envInt('PORT', 5000);

async function start() {
  const stores = await getStores();

  if (!isMongoConfigured()) {
    console.log('[mealbuddy] JSON store active (no MONGODB_URI). Persisting to .data/mealbuddy.json');
    console.log('[mealbuddy] Demo accounts: student@mealbuddy.app / student123  |  cook@mealbuddy.app / cook123');
  } else {
    console.log('[mealbuddy] MongoDB Atlas store active (MONGODB_URI set).');
  }

  const { default: app } = await import('./app');

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[mealbuddy] API listening on http://0.0.0.0:${PORT} (dialect=${stores.dialect})`);
  });
}

start().catch(e => {
  console.error('[mealbuddy] fatal startup error', e);
  process.exit(1);
});