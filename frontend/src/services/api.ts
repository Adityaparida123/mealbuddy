// Backend base URL for Meal Buddy.
//
// VITE_API_URL is a PUBLIC build-time variable (a plain HTTPS URL, NOT a
// secret). It is set in the Vercel dashboard as:
//   VITE_API_URL = https://mealbuddy-32kw.onrender.com
//
// The default below keeps the frontend functional even if the Vercel env var
// is temporarily missing. If the frontend is later wired to call the live
// backend, use apiUrl('/api/health') etc. — never build URLs by hand.
export const API_BASE_URL: string = (
  import.meta.env.VITE_API_URL as string | undefined
)?.replace(/\/+$/, '') || 'https://mealbuddy-32kw.onrender.com';

// Build a full URL for a backend route, e.g. apiUrl('/api/health').
export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}