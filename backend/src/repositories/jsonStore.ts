import { writeFileSync, readFileSync, mkdirSync } from 'fs';
import { dirname, join, resolve } from 'path';
import type { MenuItem } from '../../../shared/src/types/menu';
import type { ChatMessageRecord, ConversationRecord, FavoriteRecord, FoodProfileRecord, MenuStore, UserRecord, UserStore } from './types';
import menu from '../../../shared/src/data/menu.json';
import { seedUsers, seedProfiles, seedFavorites } from '../lib/seedFixtures';

const MENU: MenuItem[] = JSON.parse(JSON.stringify(menu));

const DATA_DIR = resolve(process.cwd(), '.data');
mkdirSync(DATA_DIR, { recursive: true });
const DB_FILE = join(DATA_DIR, 'mealbuddy.json');

interface DbShape {
  users: UserRecord[];
  profiles: Record<string, FoodProfileRecord>;
  favorites: FavoriteRecord[];
  conversations: Record<string, ConversationRecord>;
  menu: MenuItem[];
}

function load(): DbShape {
  try {
    const raw = readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.menu)) return parsed as DbShape;
  } catch {
    /* first run */
  }
  return {
    users: seedUsers(),
    profiles: seedProfiles(),
    favorites: seedFavorites(),
    conversations: {},
    menu: MENU,
  };
}

let db: DbShape = load();

function persist(): void {
  try {
    writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (e) {
    console.error('[jsonStore] persist failed', (e as Error).message);
  }
}

export const jsonMenuStore: MenuStore = {
  async listMenu() { return JSON.parse(JSON.stringify(db.menu)); },
  async getMenuItem(id) { return db.menu.find(i => i.id === id) ?? null; },
  async createMenuItem(item) { db.menu.push(item); persist(); return item; },
  async updateMenuItem(id, patch) {
    const i = db.menu.findIndex(x => x.id === id);
    if (i < 0) return null;
    db.menu[i] = { ...db.menu[i], ...patch };
    persist();
    return db.menu[i];
  },
  async deleteMenuItem(id) {
    const before = db.menu.length;
    db.menu = db.menu.filter(i => i.id !== id);
    persist();
    return db.menu.length !== before;
  },
  async setAvailability(id, available) {
    const i = db.menu.findIndex(x => x.id === id);
    if (i < 0) return null;
    db.menu[i] = { ...db.menu[i], available };
    persist();
    return db.menu[i];
  },
};

export const jsonUserStore: UserStore = {
  async createUser(u) {
    const rec: UserRecord = { ...u, role: u.role ?? 'STUDENT', createdAt: new Date().toISOString() };
    db.users.push(rec);
    persist();
    return rec;
  },
  async findByEmail(email) { return db.users.find(u => u.email.toLowerCase() === email.toLowerCase()) ?? null; },
  async findById(id) { return db.users.find(u => u.id === id) ?? null; },
  async updateFoodProfile(userId, patch) {
    db.profiles[userId] = { ...(db.profiles[userId] ?? { userId, allergens: [], dislikes: [], diet: null, budget: null, updatedAt: new Date().toISOString() }), ...patch, userId, updatedAt: new Date().toISOString() };
    persist();
    return db.profiles[userId];
  },
  async getFoodProfile(userId) { return db.profiles[userId] ?? null; },
  async addFavorite(userId, menuItemId) {
    if (!db.favorites.some(f => f.userId === userId && f.menuItemId === menuItemId)) {
      db.favorites.push({ userId, menuItemId, createdAt: new Date().toISOString() });
      persist();
    }
  },
  async removeFavorite(userId, menuItemId) {
    db.favorites = db.favorites.filter(f => !(f.userId === userId && f.menuItemId === menuItemId));
    persist();
  },
  async listFavorites(userId) { return db.favorites.filter(f => f.userId === userId).map(f => f.menuItemId); },
  async createConversation(userId) {
    const id = `c_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    db.conversations[id] = { id, userId, messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    persist();
    return id;
  },
  async addMessage(conversationId, msg) {
    const c = db.conversations[conversationId];
    if (!c) return;
    c.messages.push(msg);
    c.updatedAt = new Date().toISOString();
    persist();
  },
  async listConversation(conversationId) { return db.conversations[conversationId] ?? null; },
};