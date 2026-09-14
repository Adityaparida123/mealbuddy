// MongoDB persistence implementing the same MenuStore/UserStore contracts as
// the JSON store, so routes are DB-agnostic. Collections are created lazily and
// seeded from the canonical dataset + demo accounts the first time they connect.
import type { Collection } from 'mongodb';
import type { MenuItem } from '../../../src/types/menu';
import type { ChatMessageRecord, ConversationRecord, FoodProfileRecord, MenuStore, UserRecord, UserStore } from './types';
import menu from '../../../src/data/menu.json';
import { seedUsers, seedProfiles } from '../lib/seedFixtures';
import { getMongoDb } from '../lib/mongo';

const MENU: MenuItem[] = JSON.parse(JSON.stringify(menu)) as MenuItem[];

const COL = {
  menu: 'menuItems',
  users: 'users',
  profiles: 'foodProfiles',
  favorites: 'favorites',
  conversations: 'conversations',
} as const;

function toMenu(doc: any): MenuItem {
  return {
    id: doc.id ?? doc._id?.toString(),
    name: doc.name,
    price: doc.price,
    category: doc.category,
    ingredients: doc.ingredients ?? [],
    allergens: doc.allergens ?? [],
    diet: doc.diet ?? [],
    dietType: doc.dietType ?? null,
    glutenFree: Boolean(doc.glutenFree),
    spiceLevel: doc.spiceLevel ?? null,
    prepTime: doc.prepTime ?? null,
    available: Boolean(doc.available),
    calories: doc.calories ?? null,
    mood: doc.mood ?? [],
    tags: doc.tags ?? [],
  } as MenuItem;
}

function toUser(doc: any): UserRecord {
  return {
    id: doc.id ?? doc._id?.toString(),
    name: doc.name,
    email: doc.email,
    passwordHash: doc.passwordHash,
    role: doc.role ?? 'STUDENT',
    createdAt: doc.createdAt ?? new Date().toISOString(),
  };
}

function toConversation(doc: any): ConversationRecord {
  return {
    id: doc.id ?? doc._id?.toString(),
    userId: doc.userId,
    messages: (doc.messages ?? []).map((m: any) => ({
      role: m.role === 'assistant' ? 'assistant' : ('user' as 'user'),
      content: m.content,
      createdAt: m.createdAt,
    })),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function ensureIndexes(): Promise<void> {
  const db = await getMongoDb();
  if (!db) return;
  await db.collection(COL.users).createIndex({ email: 1 }, { unique: true });
  await db.collection(COL.conversations).createIndex({ id: 1 }, { unique: true });
  await db.collection(COL.favorites).createIndex({ userId: 1, menuItemId: 1 }, { unique: true });
}

async function seedOnce(db: NonNullable<Awaited<ReturnType<typeof getMongoDb>>>): Promise<void> {
  const menuCol = db.collection(COL.menu);
  const userCol = db.collection(COL.users);
  const profCol = db.collection(COL.profiles);

  if ((await menuCol.countDocuments()) === 0) {
    await menuCol.insertMany(MENU.map(m => ({ ...m })));
  }
  if ((await userCol.countDocuments()) === 0) {
    await userCol.insertMany(seedUsers());
  }
  if ((await profCol.countDocuments()) === 0) {
    const profiles = seedProfiles();
    await profCol.insertMany(Object.values(profiles));
  }
}

export async function buildMongoStores(): Promise<{ menu: MenuStore; users: UserStore; dialect: string }> {
  const db = await getMongoDb();
  if (!db) throw new Error('MONGODB_URI set but MongoDB unreachable');

  await ensureIndexes();
  await seedOnce(db);

  const menuCol: Collection<any> = db.collection(COL.menu);
  const userCol: Collection<any> = db.collection(COL.users);
  const profCol: Collection<any> = db.collection(COL.profiles);
  const favCol: Collection<any> = db.collection(COL.favorites);
  const convCol: Collection<any> = db.collection(COL.conversations);

  const menu: MenuStore = {
    async listMenu() {
      const docs = await menuCol.find({}).sort({ id: 1 }).toArray();
      return docs.map(toMenu);
    },
    async getMenuItem(id) {
      const doc = await menuCol.findOne({ id });
      return doc ? toMenu(doc) : null;
    },
    async createMenuItem(item) {
      await menuCol.insertOne({ ...item });
      return item;
    },
    async updateMenuItem(id, patch) {
      const res = await menuCol.findOneAndUpdate(
        { id },
        { $set: { ...patch, id } },
        { returnDocument: 'after' }
      );
      return res ? toMenu(res) : null;
    },
    async deleteMenuItem(id) {
      const res = await menuCol.deleteOne({ id });
      return res.deletedCount > 0;
    },
    async setAvailability(id, available) {
      const res = await menuCol.findOneAndUpdate(
        { id },
        { $set: { available } },
        { returnDocument: 'after' }
      );
      return res ? toMenu(res) : null;
    },
  };

  const users: UserStore = {
    async createUser(u) {
      const rec: UserRecord = { ...u, role: u.role ?? 'STUDENT', createdAt: new Date().toISOString() };
      await userCol.insertOne({ ...rec, email: rec.email.toLowerCase() });
      return rec;
    },
    async findByEmail(email) {
      const doc = await userCol.findOne({ email: email.toLowerCase() });
      return doc ? toUser(doc) : null;
    },
    async findById(id) {
      const doc = await userCol.findOne({ id });
      return doc ? toUser(doc) : null;
    },
    async updateFoodProfile(userId, patch) {
      const base: FoodProfileRecord = {
        userId,
        allergens: [],
        dislikes: [],
        diet: null,
        budget: null,
        updatedAt: new Date().toISOString(),
      };
      const updated = { ...base, ...patch, userId, updatedAt: new Date().toISOString() };
      await profCol.updateOne({ userId }, { $set: updated }, { upsert: true });
      return updated;
    },
    async getFoodProfile(userId) {
      const doc = await profCol.findOne({ userId });
      if (!doc) return null;
      return { userId, allergens: doc.allergens ?? [], dislikes: doc.dislikes ?? [], diet: doc.diet ?? null, budget: doc.budget ?? null, updatedAt: doc.updatedAt };
    },
    async addFavorite(userId, menuItemId) {
      await favCol.updateOne({ userId, menuItemId }, { $setOnInsert: { userId, menuItemId, createdAt: new Date().toISOString() } }, { upsert: true });
    },
    async removeFavorite(userId, menuItemId) {
      await favCol.deleteOne({ userId, menuItemId });
    },
    async listFavorites(userId) {
      const docs = await favCol.find({ userId }).toArray();
      return docs.map(d => d.menuItemId);
    },
    async createConversation(userId) {
      const id = `c_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
      await convCol.insertOne({ id, userId, messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      return id;
    },
    async addMessage(conversationId, msg) {
      const cnv: ChatMessageRecord = { ...msg, createdAt: msg.createdAt ?? new Date().toISOString() };
      await convCol.updateOne(
        { id: conversationId },
        { $push: { messages: cnv } as any, $set: { updatedAt: new Date().toISOString() } }
      );
    },
    async listConversation(conversationId) {
      const doc = await convCol.findOne({ id: conversationId });
      return doc ? toConversation(doc) : null;
    },
  };

  return { menu, users, dialect: 'mongodb' };
}