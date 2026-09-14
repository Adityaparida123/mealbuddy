import { resolveStores } from '../repositories';
import type { ChatMessageRecord, ConversationRecord } from '../repositories/types';

let storesPromise: ReturnType<typeof resolveStores> | null = null;

export function getStores() {
  if (!storesPromise) storesPromise = resolveStores();
  return storesPromise;
}

export function toPublicUser(u: {
  id: string; name: string; email: string; role: string; createdAt?: string;
}) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt ?? u.createdAt };
}

export { resolveStores };
export type { ChatMessageRecord, ConversationRecord };