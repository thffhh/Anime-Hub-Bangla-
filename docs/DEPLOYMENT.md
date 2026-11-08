# Deployment plan

## Website
Build with `npm run build -w apps/web`. Publish `apps/web/dist` to Cloudflare Pages or another static host.
Set `VITE_API_URL` at build time to the public API URL.

## API
Deploy `apps/api` to a Node.js-compatible host. Set `DATABASE_URL`, `JWT_SECRET`, `WEB_ORIGIN`, and `NODE_ENV=production`.
Do not deploy the API with development secrets.

## Database
Use Neon PostgreSQL or any managed PostgreSQL service. Apply `database/schema.sql` before first launch.
Back up the database and test restore procedures.

## Android
Build the web app, then use Capacitor commands listed in README. Open the generated Android project in Android Studio and create a signed release build.
The Android wrapper does not bypass content licensing or provider restrictions.

## Vercel login / API routing
The Vercel configurations proxy `/api/*` to the default Render service before the SPA fallback. On `*.vercel.app` domains the frontend uses this same-origin route when `VITE_API_URL` is unset or points to the default Render origin. This avoids browser CORS blocking. Ensure the deployment uses the repository's `vercel.json` for its configured root (both repository root and `apps/web` include one). If using another API, set `VITE_API_URL` to that API origin and allow the exact frontend origin via its server `WEB_ORIGIN`; never use a wildcard for authenticated requests. A custom domain also requires this direct-origin configuration unless explicitly configured for the proxy. Redeploy after changing build-time environment variables. Visit `/api/health` on the Vercel site and verify it returns API JSON, not the SPA HTML. A 502/503 or failed login can still indicate Render, database, or JWT configuration issues.
