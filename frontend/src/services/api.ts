import type { MenuItem } from '../../../shared/src/types/menu';
import type { Recommendation } from '../../../shared/src/types/recommendation';

// ---------------------------------------------------------------------------
// Centralized Meal Buddy API client.
//
// The single source of the backend base URL:
//   VITE_API_URL  (set in the Vercel dashboard)  →  e.g. https://mealbuddy-32kw.onrender.com
// Falls back to the production Render URL so the app works even when the
// Vercel env var is not set yet.
// ---------------------------------------------------------------------------

export const API_BASE_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ||
  'https://mealbuddy-32kw.onrender.com';

export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

const NETWORK_TEXT = 'Unable to connect to Meal Buddy server.';
const SESSION_TEXT = 'Your session has expired. Please log in again.';
const FORBIDDEN_TEXT = "You don't have permission to perform this action.";
const NOT_FOUND_TEXT = 'Requested resource was not found.';
const SERVER_TEXT = 'Something went wrong on the server.';
const VALIDATION_TEXT = 'Validation failed. Please check your input.';

function errorMessage(status: number, body: unknown, path: string): string {
  const bodyError = (body as { error?: unknown } | null)?.error;
  if (typeof bodyError === 'string' && bodyError) {
    // Login/register 401s carry their own precise message
    // ("Invalid email or password.") — preserve those.
    if (status !== 401 || path === '/api/auth/login' || path === '/api/auth/register') {
      return bodyError;
    }
    return SESSION_TEXT;
  }
  if (status === 0) return NETWORK_TEXT;
  switch (status) {
    case 400:
      return VALIDATION_TEXT;
    case 401:
      return SESSION_TEXT;
    case 403:
      return FORBIDDEN_TEXT;
    case 404:
      return NOT_FOUND_TEXT;
    case 500:
      return SERVER_TEXT;
    default:
      return `Request failed (${status}).`;
  }
}

// ---------------------------------------------------------------------------
// Auth token plumbing (JWT from localStorage, see hooks/useAuth.tsx)
// ---------------------------------------------------------------------------

let tokenGetter: () => string | null = () => null;

export function setAuthTokenGetter(getter: () => string | null): void {
  tokenGetter = getter;
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) ?? {}),
  };
  const token = tokenGetter();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(apiUrl(path), { ...options, headers });
  } catch {
    throw new ApiError(0, NETWORK_TEXT);
  }

  if (res.status === 204) return undefined as T;

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    throw new ApiError(
      res.status,
      errorMessage(res.status, body, path),
      (body as { details?: unknown } | null)?.details
    );
  }
  return body as T;
}

// ---------------------------------------------------------------------------
// Response/request types
// ---------------------------------------------------------------------------

export type UserRole = 'STUDENT' | 'COOK';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt?: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface MeResponse {
  user: AuthUser;
}

export interface MenuListResponse {
  items: MenuItem[];
  count: number;
}

export interface MenuItemResponse {
  item: MenuItem;
}

export type MenuItemCreate = Omit<MenuItem, 'id'>;

export interface FoodProfileInput {
  allergens: string[];
  dislikes: string[];
  diet: 'veg' | 'non-veg' | 'vegan' | null;
  budget: number | null;
}

export interface FoodProfileRecord extends FoodProfileInput {
  userId: string;
  updatedAt?: string;
}

export interface HealthInfo {
  ok: boolean;
  dialect: string;
  connected: boolean;
  uriHost: string | null;
}

export interface ChatHistoryEntry {
  role: 'user' | 'assistant';
  content: string;
}

export type ChatReply =
  | { kind: 'knowledge'; answer: string; recommendation: null; aiUsed: boolean }
  | { kind: 'menu'; recommendation: Recommendation; aiUsed: boolean };

// ---------------------------------------------------------------------------
// Endpoint methods — the ONLY place paths are defined
// ---------------------------------------------------------------------------

export const authApi = {
  register: (input: { name: string; email: string; password: string; role?: UserRole }) =>
    apiRequest<AuthResponse>('/api/auth/register', { method: 'POST', body: JSON.stringify(input) }),

  login: (email: string, password: string) =>
    apiRequest<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () => apiRequest<MeResponse>('/api/auth/me'),
};

export const healthApi = {
  check: () => apiRequest<HealthInfo>('/api/health'),
};

export const menuApi = {
  list: () => apiRequest<MenuListResponse>('/api/menu'),

  create: (input: MenuItemCreate) =>
    apiRequest<MenuItemResponse>('/api/menu', { method: 'POST', body: JSON.stringify(input) }),

  update: (id: string, input: Partial<MenuItem>) =>
    apiRequest<MenuItemResponse>(`/api/menu/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),

  remove: (id: string) =>
    apiRequest<void>(`/api/menu/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  setAvailability: (id: string, available: boolean) =>
    apiRequest<MenuItemResponse>(`/api/menu/${encodeURIComponent(id)}/availability`, {
      method: 'PATCH',
      body: JSON.stringify({ available }),
    }),
};

export const chatApi = {
  send: (message: string, history: ChatHistoryEntry[] = []) =>
    apiRequest<ChatReply>('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message, history }),
    }),
};

export const favoritesApi = {
  list: () => apiRequest<{ favorites: MenuItem[] }>('/api/favorites'),
  add: (menuItemId: string) =>
    apiRequest<{ favorite: string }>(`/api/favorites/${encodeURIComponent(menuItemId)}`, {
      method: 'POST',
    }),
  remove: (menuItemId: string) =>
    apiRequest<void>(`/api/favorites/${encodeURIComponent(menuItemId)}`, { method: 'DELETE' }),
};

export const profileApi = {
  get: () => apiRequest<{ profile: FoodProfileRecord | null }>('/api/food-profile'),
  upsert: (input: FoodProfileInput) =>
    apiRequest<{ profile: FoodProfileRecord }>('/api/food-profile', {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
};