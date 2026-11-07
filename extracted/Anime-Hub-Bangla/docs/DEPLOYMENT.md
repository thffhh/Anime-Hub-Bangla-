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
