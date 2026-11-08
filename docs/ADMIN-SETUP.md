# First Super Admin and admin dashboard

1. Configure PostgreSQL and apply `database/schema.sql`.
2. In `apps/api/.env`, set `DATABASE_URL` and a strong `JWT_SECRET` (32+ characters).
3. Temporarily set `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD` (12+ characters), and optional `SUPER_ADMIN_NAME`.
4. From the repository root run:
   `npm run admin:create -w apps/api`
5. Remove `SUPER_ADMIN_PASSWORD` from `apps/api/.env` after the account is created.
6. Start the project with `npm run dev`.
7. Open `http://localhost:5173/admin` and sign in.

The Super Admin dashboard includes anime draft creation, metadata editing, publishing and episode management. Cloudflare Stream direct upload is available when its server-side credentials and provider configuration are set. Admin API routes enforce role checks.

## Admin API
- `POST /api/auth/login` with `{ "email": "...", "password": "..." }`
- `GET /api/admin/summary`
- `GET /api/admin/anime`
- `POST /api/admin/anime`
- `PUT /api/admin/anime/:id`
- `DELETE /api/admin/anime/:id`
- `GET /api/admin/anime/:id/episodes`
- `POST /api/admin/anime/:id/episodes`
- `DELETE /api/admin/episodes/:id`
- `GET /api/admin/users` (Super Admin/Admin only)

Send `Authorization: Bearer <token>` to protected routes. The token expires after 8 hours. This starter uses localStorage in the admin UI for convenience; for a hardened production deployment, move to secure, HttpOnly, SameSite cookies and add CSRF protection.
