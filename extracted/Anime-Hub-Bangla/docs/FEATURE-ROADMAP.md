# Feature status and production roadmap

## Present in this starter source
- React + TypeScript + Vite responsive dark website and Capacitor Android wrapper configuration.
- Express API, PostgreSQL schema, email/password account registration/login and server-side role checks.
- Anime catalogue/detail pages, episode management, watch history, favorites and membership request workflow.
- Cloudflare Stream Direct Creator Upload URL endpoint (requires credentials); player supports Cloudflare iframe and supplied HTTPS media URLs.
- Admin payment review queue for manual transaction verification. This is not gateway checkout.
- Revenue overview from approved payment submissions, confirmed revenue ledger rows, sponsor deal records and imported ad report rows.
- Ad campaign draft/status manager; sponsor/partnership lead CRM.
- Adsterra daily metrics import endpoint/UI. Metrics must be copied from the real Adsterra dashboard/report; no Adsterra API connection is claimed.
- 30-day playback analytics API and dashboard, based only on authenticated playback-event records submitted to `/api/user/playback-event`.
- SQL tables for audit logs, sponsors, daily ad metrics and playback events.

## Requires external accounts or further implementation
- Live bKash/Nagad/Rocket/SSLCOMMERZ checkout, signed provider webhooks, refunds and automated reconciliation.
- Direct Adsterra API integration (if the publisher account/provider offers suitable API access); current import is manual.
- Bunny Stream upload API, signed playback tokens, premium entitlement enforcement, processing webhooks and media deletion sync.
- Complete staff/role management UI, email verification, password reset, MFA, refresh-token rotation and stronger session/cookie design.
- Public anonymous page-view analytics, notification delivery, backups/restore drills, monitoring and full privacy export/deletion workflows.
- Android APK generation/signing and end-to-end QA on physical devices.
- Production deployment and security review with real infrastructure credentials.

Never publish unlicensed anime or use provider keys in browser code. Do not describe demo/sample data as actual revenue or traffic.


## Newly added in the latest source update
- Staff creation and role/status management API (Super Admin only).
- Comment moderation queue and user-submitted comment reports.
- Public comments list with authenticated comment submission (new comments wait for moderation).
- User ratings/reviews with one review per user/title.
- User notifications inbox API and moderation outcome notifications.
- Episode-level Premium flag and server-side playback authorization endpoint.
- Public anime detail payload no longer exposes provider video IDs; playback metadata is returned only after the server checks the episode's premium requirement.

## Still requires external accounts / production work
- Payment gateway checkout and verified webhooks (bKash/Nagad/Rocket/SSLCOMMERZ).
- Adsterra live API connection; CSV/manual import is available only.
- Bunny Stream signed playback/upload implementation.
- Cloudflare Stream signed URL enforcement must be configured in the Cloudflare account before relying on it as DRM/access control.
- Email/SMS/push delivery, password reset and email verification provider.
- Formal security review, rate limiting/WAF, backups, monitoring, accessibility and load testing.
- Android native build, signing key and Play Store release.
