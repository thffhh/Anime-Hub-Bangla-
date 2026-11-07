# Local setup (beginner friendly)

1. Install Node.js 20+ and Git on your computer or Linux environment.
2. Extract the ZIP and open a terminal in the `Anime-Hub-Bangla` folder.
3. Run `npm install`.
4. Create a PostgreSQL database in Neon (or another PostgreSQL host).
5. Open `database/schema.sql`, copy all SQL, and run it in the database SQL editor.
6. Copy the root `.env.example` to `apps/api/.env`.
7. Fill `DATABASE_URL` and generate a long random `JWT_SECRET`. Leave other provider values blank until those accounts exist.
8. Run `npm run dev`.
9. Open `http://localhost:5173` for the website and `http://localhost:4000/api/health` for API status.

If the API says database is not configured, verify `apps/api/.env` exists and the database URL is correct.


## Cloudflare Stream video uploads

To enable video uploads in the Admin Episode Manager, add `CLOUDFLARE_STREAM_ACCOUNT_ID` and `CLOUDFLARE_STREAM_API_TOKEN` to `apps/api/.env`, then restart the API. Keep the token on the server only. The browser receives a one-time upload URL and uploads the selected file directly to Cloudflare. See `docs/INTEGRATIONS.md` for playback and security limitations.

### User accounts, watch history and membership
After applying the complete `database/schema.sql`, the web app exposes `/account` for registration and login. Authenticated endpoints live under `/api/user`: `/me`, `/favorites`, `/history`, and `/membership`. Registration is open to ordinary USER accounts only; administrative roles must be provisioned by an authorized administrator. Membership requests remain `PENDING` until a trusted payment integration verifies payment and an admin/system activates the membership. Do not manually mark a payment successful based only on a client request.

### Updating an existing database
If you created the database before the latest dashboard update, run the **entire current** `database/schema.sql` again in your PostgreSQL SQL editor. Existing tables are guarded with `IF NOT EXISTS`; new reporting tables and columns will be added. Take a database backup before applying schema changes to a production database.

### Revenue, advertising and sponsor dashboard
The Admin dashboard has revenue summaries, an Adsterra report import form, ad campaign management and a sponsor lead tracker. Adsterra metrics are not fetched automatically: import verified daily values from your publisher dashboard. Sponsor contracted value is not the same as cash collected. Premium totals count approved manual submissions only.

Playback analytics are based on authenticated calls to `POST /api/user/playback-event` with `episodeId`, `eventType` (`PLAY`, `PROGRESS`, or `COMPLETE`) and optional `watchedSeconds`. The player must send these events for the dashboard to have data. The endpoint requires a signed-in user and a published episode.


## Apply later database updates
Whenever you download a newer source ZIP, re-run the complete `database/schema.sql` against the same PostgreSQL database. The script uses `IF NOT EXISTS` / additive column migrations for the current starter schema. Back up production data before schema changes.
