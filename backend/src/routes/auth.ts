import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { signToken } from '../lib/auth';
import { hashPassword, verifyPassword } from '../lib/password';
import { getStores } from '../lib/resolvers';

const router = Router();

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(200),
  password: z.string().min(6).max(200),
  role: z.enum(['STUDENT', 'COOK']).default('STUDENT'),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed.', details: parsed.error.flatten() });
    return;
  }
  const { name, email, password, role } = parsed.data;
  const stores = await getStores();
  const existing = await stores.users.findByEmail(email);
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }
  const passwordHash = await hashPassword(password);
  const user = await stores.users.createUser({
    id: `u_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e4)}`,
    name,
    email,
    passwordHash,
    role: role === 'COOK' ? 'COOK' : 'STUDENT',
  });
  const token = signToken({ sub: user.id, role: user.role, name: user.name, email: user.email });
  res.status(201).json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt },
  });
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed.', details: parsed.error.flatten() });
    return;
  }
  const { email, password } = parsed.data;
  const stores = await getStores();
  const user = await stores.users.findByEmail(email);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }
  const token = signToken({ sub: user.id, role: user.role, name: user.name, email: user.email });
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt },
  });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;