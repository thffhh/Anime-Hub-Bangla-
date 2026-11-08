const DEFAULT_API = 'https://anime-hub-bangla.onrender.com';
// Some deployments provide the API origin with a trailing /api even though all
// callers already include that prefix. Normalise it to avoid /api/api requests.
const configured = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '').replace(/\/api$/i, '');
const isVercelHost = typeof window !== 'undefined' && window.location.hostname.endsWith('.vercel.app');

// Vercel's /api rewrite proxies our default Render API on the same origin.
// Explicit alternative APIs keep working; non-Vercel builds retain the Render
// fallback. Local development uses the Vite proxy.
export const API = import.meta.env.DEV ? (configured || '')
  : isVercelHost && (!configured || configured === DEFAULT_API) ? ''
  : configured || DEFAULT_API;

export function loginError(error: unknown): string {
  if (error instanceof TypeError) {
    return 'Could not reach the login server. Check your connection and try again. If this persists, the site API or CORS configuration needs attention.';
  }
  return error instanceof Error ? error.message : 'Login failed. Please try again.';
}
