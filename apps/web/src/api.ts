// Development requests are proxied by Vite. Production can point to the
// deployed API via VITE_API_URL at build time.
export const API = (import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? '' : 'https://anime-hub-bangla.onrender.com')).replace(/\/$/, '');
