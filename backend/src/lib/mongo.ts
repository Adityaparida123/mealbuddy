// Lazy MongoDB client + health helper. Importing this file does NOT require a
// running cluster: the local JSON store remains the default and MongoDB is only
// used when MONGODB_URI is explicitly configured.
import { MongoClient, type Db } from 'mongodb';

let client: MongoClient | null = null;
let db: Db | null = null;

export interface DbHealth {
  dialect: 'mongodb' | 'json';
  connected: boolean;
  uriHost: string | null;
}

let dialect: 'mongodb' | 'json' = 'json';

export function isMongoConfigured(): boolean {
  const url = process.env.MONGODB_URI;
  // Accept both schemas; guard against accidental Postgres strings.
  return Boolean(url && /^mongodb(\+srv)?:\/\//i.test(url));
}

export function getDialect(): 'mongodb' | 'json' {
  return dialect;
}

export function setDialect(d: 'mongodb' | 'json'): void {
  dialect = d;
}

export function isJsonForced(): boolean {
  return process.env.DB_BACKEND === 'json';
}

export function parseDbUrl(raw: string): string | null {
  try {
    const u = new URL(raw.replace('mongodb+srv://', 'mongodb://'));
    return u.host || null;
  } catch {
    return null;
  }
}

// Lazily connect to the configured Atlas cluster. Safe to call repeatedly.
export async function getMongoDb(): Promise<Db | null> {
  if (!isMongoConfigured() || isJsonForced()) return null;
  if (db) return db;

  const uri = process.env.MONGODB_URI!;
  client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 8000,
    socketTimeoutMS: 10000,
  });
  try {
    await client.connect();
    const dbName = process.env.MONGODB_DB || new URL(uri.replace('mongodb+srv://', 'mongodb://')).pathname.replace(/^\//, '') || 'mealbuddy';
    db = client.db(dbName || 'mealbuddy');
    dialect = 'mongodb';
    return db;
  } catch (e) {
    console.error('[mongo] connection failed', (e as Error).message);
    await client.close().catch(() => null);
    client = null;
    return null;
  }
}

export async function checkDbHealth(): Promise<DbHealth> {
  if (!isMongoConfigured() || isJsonForced()) {
    return { dialect: 'json', connected: true, uriHost: null };
  }
  const d = await getMongoDb();
  if (!d) return { dialect: 'mongodb', connected: false, uriHost: parseDbUrl(process.env.MONGODB_URI!) };
  try {
    await d.command({ ping: 1 });
    return { dialect: 'mongodb', connected: true, uriHost: parseDbUrl(process.env.MONGODB_URI!) };
  } catch {
    return { dialect: 'mongodb', connected: false, uriHost: parseDbUrl(process.env.MONGODB_URI!) };
  }
}