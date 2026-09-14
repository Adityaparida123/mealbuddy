import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { getStores } from '../lib/resolvers';

const router = Router();

const profileSchema = z.object({
  allergens: z.array(z.string()).default([]),
  dislikes: z.array(z.string()).default([]),
  diet: z.enum(['veg', 'non-veg', 'vegan']).nullable().default(null),
  budget: z.number().int().min(0).nullable().default(null),
});

router.get('/', requireAuth, async (req, res) => {
  const stores = await getStores();
  const p = await stores.users.getFoodProfile(req.user!.id);
  res.json({ profile: p ?? null });
});

router.put('/', requireAuth, async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed.', details: parsed.error.flatten() });
    return;
  }
  const stores = await getStores();
  const p = await stores.users.updateFoodProfile(req.user!.id, parsed.data);
  res.json({ profile: p });
});

export default router;