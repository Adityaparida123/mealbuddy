import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import { getStores } from '../lib/resolvers';

const router = Router();

const itemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  price: z.number().positive().max(10000),
  category: z.string().trim().min(1).max(60),
  ingredients: z.array(z.string()).default([]),
  allergens: z.array(z.string()).default([]),
  diet: z.array(z.string()).default([]),
  dietType: z.enum(['veg', 'non-veg', 'vegan']).nullable().default(null),
  glutenFree: z.boolean().default(false),
  spiceLevel: z.enum(['mild', 'medium', 'spicy']).nullable().default(null),
  prepTime: z.number().int().min(0).max(240).nullable().default(null),
  available: z.boolean().default(true),
  calories: z.number().int().min(0).nullable().default(null),
  mood: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
});

router.get('/', async (_req, res) => {
  const stores = await getStores();
  const items = await stores.menu.listMenu();
  res.json({ items, count: items.length });
});

router.get('/:id', async (req, res) => {
  const stores = await getStores();
  const item = await stores.menu.getMenuItem(String(req.params.id));
  if (!item) {
    res.status(404).json({ error: 'Menu item not found.' });
    return;
  }
  res.json({ item });
});

router.post('/', requireAuth, requireRole('COOK'), async (req, res) => {
  const stores = await getStores();
  const id = `I${Date.now().toString(36).toUpperCase()}`;
  const item = await stores.menu.createMenuItem({
    id,
    ...req.body,
    ingredients: req.body.ingredients ?? [],
    allergens: req.body.allergens ?? [],
    diet: req.body.diet ?? [],
    mood: req.body.mood ?? [],
    tags: req.body.tags ?? [],
    calories: req.body.calories ?? null,
    prepTime: req.body.prepTime ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  res.status(201).json({ item });
});

router.put('/:id', requireAuth, requireRole('COOK'), async (req, res) => {
  const stores = await getStores();
  const item = await stores.menu.updateMenuItem(String(req.params.id), { ...req.body, updatedAt: new Date().toISOString() });
  if (!item) {
    res.status(404).json({ error: 'Menu item not found.' });
    return;
  }
  res.json({ item });
});

router.delete('/:id', requireAuth, requireRole('COOK'), async (req, res) => {
  const stores = await getStores();
  const ok = await stores.menu.deleteMenuItem(String(req.params.id));
  if (!ok) {
    res.status(404).json({ error: 'Menu item not found.' });
    return;
  }
  res.status(204).end();
});

router.patch('/:id/availability', requireAuth, requireRole('COOK'), async (req, res) => {
  const stores = await getStores();
  const item = await stores.menu.setAvailability(String(req.params.id), Boolean(req.body?.available));
  if (!item) {
    res.status(404).json({ error: 'Menu item not found.' });
    return;
  }
  res.json({ item });
});

export default router;