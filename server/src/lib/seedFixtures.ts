// Demo credentials are generated at first run (bcrypt-hashed in-memory cache
// keyed by email so the JSON store stays deterministic). NOT production data.
import bcrypt from 'bcryptjs';
import type { FoodProfileRecord, UserRecord } from '../repositories/types';

function hashCache(email: string, raw: string): string {
  // deterministic pseudo-hash for the JSON store demo accounts (bcrypt per boot)
  return bcrypt.hashSync(raw, 8);
}

export function seedUsers(): UserRecord[] {
  const now = new Date().toISOString();
  return [
    { id: 'u_student', name: 'Demo Student', email: 'student@mealbuddy.app', passwordHash: hashCache('u_student', 'student123'), role: 'STUDENT', createdAt: now },
    { id: 'u_cook', name: 'Demo Cook', email: 'cook@mealbuddy.app', passwordHash: hashCache('u_cook', 'cook123'), role: 'COOK', createdAt: now },
  ];
}

export function seedProfiles(): Record<string, FoodProfileRecord> {
  return {
    u_student: { userId: 'u_student', allergens: ['peanut'], dislikes: ['mushroom'], diet: null, budget: 150, updatedAt: new Date().toISOString() },
  };
}

export function seedFavorites() {
  return [];
}