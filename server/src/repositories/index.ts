// Store factory: MongoDB Atlas when MONGODB_URI is set, otherwise local JSON.
import { isMongoConfigured, isJsonForced } from '../lib/mongo';
import { jsonMenuStore, jsonUserStore } from './jsonStore';
import type { MenuStore, UserStore } from './types';

export async function resolveStores(): Promise<{ menu: MenuStore; users: UserStore; dialect: string }> {
  if (isMongoConfigured() && !isJsonForced()) {
    const mongo = await import('./mongoStore');
    return mongo.buildMongoStores();
  }
  return { menu: jsonMenuStore, users: jsonUserStore, dialect: 'json' };
}

export type Stores = { menu: MenuStore; users: UserStore; dialect: string };