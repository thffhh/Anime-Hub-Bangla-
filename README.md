# Anime Hub Bangla

A Firebase-free starter monorepo for a Bangla-dub anime streaming platform.
The project is structured for a React website, Android wrapper, Express API,
PostgreSQL (Neon), Cloudflare R2 object storage, and pluggable video providers.

> Important: this is a working foundation, not a fully licensed streaming service.
> Real video playback, payment collection, Adsterra reporting, and provider uploads
> require valid provider accounts, credentials, and server-side configuration.
> Only publish content you own or are authorized to distribute.

## Included
- `apps/web`: React + TypeScript + Vite website/admin starter
- `apps/web`: Capacitor configuration for packaging the website as Android
- `apps/api`: Express API with health, anime listing, auth-ready structure and admin routes
- `packages/shared`: shared types
- `database`: PostgreSQL schema
- `docs`: setup, deployment, security, integrations
- `.env.example`: placeholders only; never commit real secrets

## Requirements
- Node.js 20.9+
- npm 10+
- PostgreSQL database (Neon works)
- Git

## Quick start
1. Copy `.env.example` to `apps/api/.env` and set `DATABASE_URL` and a long `JWT_SECRET`.
2. Install dependencies from the repository root: `npm install`
3. Run the database schema in `database/schema.sql` against your PostgreSQL database.
4. Start development: `npm run dev`

The web app runs at `http://localhost:5173`; API at `http://localhost:4000`.

## Android build
After installing Android Studio/Android SDK:
```bash
npm run build
npm run android:add
npm run android:sync
npm run android:open
```
Build the APK from Android Studio. Android packaging needs Android SDK tooling.

## Deployment outline
- Web: Cloudflare Pages (build `apps/web`, output `dist`) or another static host.
- API: Node-compatible host, or adapt endpoints to Cloudflare Workers.
- Database: Neon PostgreSQL.
- Images/files: Cloudflare R2.
- Video: Cloudflare Stream or Bunny Stream, configured through server-side adapters.
See `docs/DEPLOYMENT.md`.

## Security notes
- Never put API keys, database credentials, JWT secrets, payment secrets, or storage keys in frontend code.
- The initial setup intentionally does not ship with a default admin password.
- Create the first Super Admin using the documented secure bootstrap process once authentication is configured.
- Enforce role permissions on the server, not just by hiding UI controls.

## Admin setup
See `docs/ADMIN-SETUP.md` to create the first Super Admin and open `/admin`.


### Video upload and viewing
The public catalogue links to `/anime/<slug>` detail pages. Published episodes appear there and can play Cloudflare Stream videos or manually supplied HTTPS MP4/WebM/HLS/embed URLs. For Cloudflare uploads, configure `CLOUDFLARE_STREAM_ACCOUNT_ID` and `CLOUDFLARE_STREAM_API_TOKEN` in `apps/api/.env`, restart the API, then use Admin → Episodes → Upload video to Cloudflare Stream. After upload completes, click Save. Read `docs/INTEGRATIONS.md` for security and billing notes.

## Premium payment review status

The project includes manual payment-reference submission and admin review for bKash, Nagad, Rocket and SSLCOMMERZ. The admin dashboard also includes revenue summaries, manual Adsterra report import, campaign management, sponsor CRM and authenticated playback-event analytics. This is not live gateway checkout: users submit the amount and transaction ID, and an Admin/Super Admin must independently verify the transaction in the merchant portal before approval activates Premium. See `docs/INTEGRATIONS.md`.


## Reporting and dashboard notes

Adsterra metrics are manually imported from your real publisher report; no automatic Adsterra API connection is claimed. Sponsor values represent contracted deal values, not necessarily cash received. Playback analytics only count authenticated playback events submitted by the client. Re-run the full current `database/schema.sql` when upgrading an older database. See `docs/FEATURE-ROADMAP.md` for what remains before production.


### Community and access-control modules
The latest source includes staff-management endpoints, role/status control, comment moderation, comment reports, ratings/reviews, user notification endpoints, and premium episode playback checks. Run the updated `database/schema.sql` against the PostgreSQL database before starting the updated API.

**Production note:** This remains a starter codebase. Payment gateways, automatic Adsterra sync, Bunny Stream, email/push delivery, Android signing, provider-side signed playback and production security review still need real provider credentials and deployment testing.

## Launch checklist
See [docs/LAUNCH-CHECKLIST-BN.md](docs/LAUNCH-CHECKLIST-BN.md) for the remaining deployment and verification steps in Bangla. Run `npm test` for API smoke checks; these do not replace database and provider integration testing.
