import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { getStores } from '../lib/resolvers';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const stores = await getStores();
  const ids = await stores.users.listFavorites(req.user!.id);
  const items = (await Promise.all(ids.map(id => stores.menu.getMenuItem(id)))).filter(Boolean);
  res.json({ favorites: items });
});

router.post('/:menuItemId', requireAuth, async (req, res) => {
  const stores = await getStores();
  const item = await stores.menu.getMenuItem(String(req.params.menuItemId));
  if (!item) {
    res.status(404).json({ error: 'Menu item not found.' });
    return;
  }
  await stores.users.addFavorite(req.user!.id, item.id);
  res.status(201).json({ favorite: item.id });
});

router.delete('/:menuItemId', requireAuth, async (req, res) => {
  const stores = await getStores();
  await stores.users.removeFavorite(req.user!.id, String(req.params.menuItemId));
  res.status(204).end();
});

export default router;