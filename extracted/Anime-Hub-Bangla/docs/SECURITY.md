# Production security checklist

This ZIP is a development foundation. Before public launch:
- Implement registration/login, password hashing with Argon2id or bcrypt, email verification, password reset, secure sessions/JWT rotation, CSRF protection where applicable, rate limiting and abuse controls.
- Add server-side role/permission middleware to every admin endpoint. Never rely on frontend route hiding.
- Bootstrap the first Super Admin through a one-time server-side command or protected setup flow. Do not use a hard-coded default password.
- Validate and sanitize every input; use parameterized SQL; add upload MIME/size validation and malware scanning.
- Store all credentials in host environment variables or a secret manager.
- Enable HTTPS, secure cookies, strict CORS, security headers, audit logs and monitoring.
- Keep payment and video-provider webhooks signature-verified and idempotent.
- Do not expose private video URLs or provider API tokens to the browser.
- Only upload/distribute content with documented rights. Store territory, platform, audio, and license expiry metadata before enabling publication.

## Payment review

User-submitted transaction references are unverified claims. They remain pending and do not unlock Premium. Only Super Admin/Admin can review submissions. Admins must independently verify the transaction in the merchant dashboard before approval. Never approve based only on a user screenshot, browser redirect, or client-provided status. Do not collect PINs or OTPs.


## New access controls
- Staff account creation and role/status changes are restricted to the Super Admin API role.
- Comments are pending moderation by default; moderators/admins can publish, hide or remove them.
- Reports are queued for moderator review.
- Premium episodes are checked by `/api/episodes/:id/playback`; a valid active MONTHLY/YEARLY membership is required.
- Public anime detail responses omit provider video IDs. The client requests playback metadata from the authorization endpoint.
- This is application-level access control, not DRM. Configure signed playback URLs at the video provider and do not use public direct file URLs for premium content.
