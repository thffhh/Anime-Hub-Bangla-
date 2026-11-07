
import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireAuth, requireRoles } from '../auth.js';

const router = Router();

const contentRoles = [
  'SUPER_ADMIN',
  'ADMIN',
  'CONTENT_MANAGER'
] as const;

const animeSchema = z.object({
  slug: z.string().min(2).max(160).regex(/^[a-z0-9-]+$/),
  title: z.string().min(1).max(200),
  originalTitle: z.string().max(200).optional().nullable(),
  synopsis: z.string().max(10000).optional().nullable(),
  posterUrl: z.string().url().optional().nullable(),
  bannerUrl: z.string().url().optional().nullable(),
  releaseYear: z.number().int().min(1900).max(2200).optional().nullable(),
  status: z.enum(['ONGOING', 'COMPLETED', 'UPCOMING', 'HIATUS']).default('UPCOMING'),
  contentType: z.enum(['LICENSED', 'ORIGINAL', 'PARTNER']).optional(),
  genres: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  published: z.boolean().default(false)
});

const episodeSchema = z.object({
  episodeNumber: z.number().int().min(1),
  title: z.string().min(1).max(200),
  synopsis: z.string().max(5000).optional().nullable(),
  runtimeSeconds: z.number().int().min(1).optional().nullable(),
  thumbnailUrl: z.string().url().optional().nullable(),
  videoProvider: z.enum(['cloudflare-stream', 'bunny', 'manual']).default('manual'),
  providerVideoId: z.string().max(500).optional().nullable(),
  published: z.boolean().default(false),
  isPremium: z.boolean().default(false),
  releaseAt: z.string().datetime().optional().nullable()
});

router.use(requireAuth);

async function saveGenres(client: any, animeId: string, genres: string[]) {
  await client.query(
    'DELETE FROM public.anime_genres WHERE anime_id = $1',
    [animeId]
  );

  for (const rawName of genres) {
    const name = rawName.trim();
    if (!name) continue;

    let result = await client.query(
      'SELECT id FROM public.genres WHERE LOWER(name) = LOWER($1) LIMIT 1',
      [name]
    );

    if (!result.rowCount) {
      result = await client.query(
        'INSERT INTO public.genres(name) VALUES($1) RETURNING id',
        [name]
      );
    }

    await client.query(
      `INSERT INTO public.anime_genres(anime_id, genre_id)
       VALUES($1, $2) ON CONFLICT DO NOTHING`,
      [animeId, result.rows[0].id]
    );
  }
}

// Cloudflare direct upload URL
router.post('/video/cloudflare-upload-url', requireRoles(...contentRoles), async (_req, res) => {
  const accountId =
    process.env.CLOUDFLARE_STREAM_ACCOUNT_ID ||
    process.env.CLOUDFLARE_ACCOUNT_ID;

  const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN;

  if (!accountId || !apiToken) {
    return res.status(503).json({
      error: 'Cloudflare Stream is not configured.'
    });
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          maxDurationSeconds: 7200,
          requireSignedURLs: false
        })
      }
    );

    const payload = await response.json() as {
      success?: boolean;
      errors?: Array<{ message?: string }>;
      result?: { uploadURL?: string; uid?: string };
    };

    if (
      !response.ok ||
      !payload.success ||
      !payload.result?.uploadURL ||
      !payload.result?.uid
    ) {
      return res.status(502).json({
        error: payload.errors?.[0]?.message || 'Cloudflare upload failed'
      });
    }

    res.json({
      uploadURL: payload.result.uploadURL,
      videoId: payload.result.uid
    });
  } catch (error) {
    console.error(error);
    res.status(502).json({ error: 'Could not connect to Cloudflare Stream' });
  }
});

// Dashboard summary
router.get('/summary', requireRoles(
  ...contentRoles,
  'ADVERTISEMENT_MANAGER',
  'ANALYST'
), async (_req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });

  try {
    const [anime, episodes, users] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS count FROM public.anime'),
      pool.query('SELECT COUNT(*)::int AS count FROM public.episodes'),
      pool.query('SELECT COUNT(*)::int AS count FROM public.users')
    ]);

    res.json({
      anime: anime.rows[0].count,
      episodes: episodes.rows[0].count,
      users: users.rows[0].count
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not load dashboard summary' });
  }
});

// Get anime list - FIXED FOR NEON DATABASE
router.get('/anime', requireRoles(...contentRoles, 'ANALYST'), async (_req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });

  try {
    const result = await pool.query(`
      SELECT
        a.id,
        a.slug,
        a.title,
        a.original_title AS "originalTitle",
        a.synopsis,
        a.poster_url AS "posterUrl",
        a.banner_url AS "bannerUrl",
        a.release_year AS "releaseYear",
        a.status,
        a.is_published AS published,
        a.is_premium AS "isPremium",
        COALESCE(
          ARRAY_AGG(DISTINCT g.name)
          FILTER (WHERE g.name IS NOT NULL),
          ARRAY[]::varchar[]
        ) AS genres
      FROM public.anime a
      LEFT JOIN public.anime_genres ag ON ag.anime_id = a.id
      LEFT JOIN public.genres g ON g.id = ag.genre_id
      GROUP BY a.id
      ORDER BY a.created_at DESC
      LIMIT 500
    `);

    res.json({ data: result.rows });
  } catch (error) {
    console.error('Admin anime list failed:', error);
    res.status(500).json({ error: 'Could not load anime' });
  }
});

// Create anime - FIXED
router.post('/anime', requireRoles(...contentRoles), async (req, res) => {
  const parsed = animeSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid anime data',
      details: parsed.error.flatten()
    });
  }

  if (!pool) return res.status(503).json({ error: 'Database not configured' });

  const a = parsed.data;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(`
      INSERT INTO public.anime (
        slug,
        title,
        original_title,
        synopsis,
        poster_url,
        banner_url,
        release_year,
        status,
        is_published
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING id, slug, title, is_published AS published
    `, [
      a.slug,
      a.title,
      a.originalTitle ?? null,
      a.synopsis ?? null,
      a.posterUrl ?? null,
      a.bannerUrl ?? null,
      a.releaseYear ?? null,
      a.status,
      a.published
    ]);

    await saveGenres(client, result.rows[0].id, a.genres);

    await client.query('COMMIT');

    res.status(201).json({ data: result.rows[0] });
  } catch (error: any) {
    await client.query('ROLLBACK');

    if (error?.code === '23505') {
      return res.status(409).json({ error: 'This slug is already in use' });
    }

    console.error('Create anime failed:', error);
    res.status(500).json({ error: 'Could not create anime' });
  } finally {
    client.release();
  }
});

// Update anime - FIXED
router.put('/anime/:id', requireRoles(...contentRoles), async (req, res) => {
  const parsed = animeSchema.partial().safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid anime data',
      details: parsed.error.flatten()
    });
  }

  if (!pool) return res.status(503).json({ error: 'Database not configured' });

  const a = parsed.data;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(`
      UPDATE public.anime SET
        slug = COALESCE($2, slug),
        title = COALESCE($3, title),
        original_title = COALESCE($4, original_title),
        synopsis = COALESCE($5, synopsis),
        poster_url = COALESCE($6, poster_url),
        banner_url = COALESCE($7, banner_url),
        release_year = COALESCE($8, release_year),
        status = COALESCE($9, status),
        is_published = COALESCE($10, is_published),
        updated_at = now()
      WHERE id = $1
      RETURNING id, slug, title, is_published AS published
    `, [
      req.params.id,
      a.slug ?? null,
      a.title ?? null,
      a.originalTitle ?? null,
      a.synopsis ?? null,
      a.posterUrl ?? null,
      a.bannerUrl ?? null,
      a.releaseYear ?? null,
      a.status ?? null,
      a.published ?? null
    ]);

    if (!result.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Anime not found' });
    }

    if (a.genres !== undefined) {
      await saveGenres(client, req.params.id, a.genres);
    }

    await client.query('COMMIT');

    res.json({ data: result.rows[0] });
  } catch (error: any) {
    await client.query('ROLLBACK');

    if (error?.code === '23505') {
      return res.status(409).json({ error: 'This slug is already in use' });
    }

    console.error('Update anime failed:', error);
    res.status(500).json({ error: 'Could not update anime' });
  } finally {
    client.release();
  }
});

// Delete anime
router.delete('/anime/:id', requireRoles('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });

  try {
    const result = await pool.query(
      'DELETE FROM public.anime WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: 'Anime not found' });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not delete anime' });
  }
});

// Episode list
router.get('/anime/:id/episodes', requireRoles(...contentRoles, 'ANALYST'), async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });

  try {
    const result = await pool.query(
      'SELECT * FROM public.episodes WHERE anime_id = $1 ORDER BY episode_number',
      [req.params.id]
    );

    res.json({ data: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not load episodes' });
  }
});

// Create episode
router.post('/anime/:id/episodes', requireRoles(...contentRoles), async (req, res) => {
  const parsed = episodeSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid episode data',
      details: parsed.error.flatten()
    });
  }

  if (!pool) return res.status(503).json({ error: 'Database not configured' });

  const e = parsed.data;

  try {
    const result = await pool.query(`
      INSERT INTO public.episodes (
        anime_id,
        episode_number,
        title,
        synopsis,
        runtime_seconds,
        thumbnail_url,
        video_provider,
        provider_video_id,
        published,
        is_premium,
        release_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *
    `, [
      req.params.id,
      e.episodeNumber,
      e.title,
      e.synopsis ?? null,
      e.runtimeSeconds ?? null,
      e.thumbnailUrl ?? null,
      e.videoProvider,
      e.providerVideoId ?? null,
      e.published,
      e.isPremium,
      e.releaseAt ?? null
    ]);

    res.status(201).json({ data: result.rows[0] });
  } catch (error: any) {
    if (error?.code === '23503') {
      return res.status(404).json({ error: 'Anime not found' });
    }
    if (error?.code === '23505') {
      return res.status(409).json({ error: 'Episode number already exists' });
    }

    console.error(error);
    res.status(500).json({ error: 'Could not create episode' });
  }
});

// Update episode
router.put('/episodes/:id', requireRoles(...contentRoles), async (req, res) => {
  const parsed = episodeSchema.partial().safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid episode data' });
  }

  if (!pool) return res.status(503).json({ error: 'Database not configured' });

  const e = parsed.data;

  try {
    const result = await pool.query(`
      UPDATE public.episodes SET
        episode_number = COALESCE($2, episode_number),
        title = COALESCE($3, title),
        synopsis = COALESCE($4, synopsis),
        runtime_seconds = COALESCE($5, runtime_seconds),
        thumbnail_url = COALESCE($6, thumbnail_url),
        video_provider = COALESCE($7, video_provider),
        provider_video_id = COALESCE($8, provider_video_id),
        published = COALESCE($9, published),
        is_premium = COALESCE($10, is_premium),
        release_at = COALESCE($11, release_at)
      WHERE id = $1
      RETURNING *
    `, [
      req.params.id,
      e.episodeNumber ?? null,
      e.title ?? null,
      e.synopsis ?? null,
      e.runtimeSeconds ?? null,
      e.thumbnailUrl ?? null,
      e.videoProvider ?? null,
      e.providerVideoId ?? null,
      e.published ?? null,
      e.isPremium ?? null,
      e.releaseAt ?? null
    ]);

    if (!result.rowCount) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not update episode' });
  }
});

// Delete episode
router.delete('/episodes/:id', requireRoles(
  'SUPER_ADMIN',
  'ADMIN',
  'CONTENT_MANAGER'
), async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });

  try {
    const result = await pool.query(
      'DELETE FROM public.episodes WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not delete episode' });
  }
});

// Users
router.get('/users', requireRoles('SUPER_ADMIN', 'ADMIN'), async (_req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });

  try {
    const result = await pool.query(`
      SELECT id, email, display_name, role, status, created_at
      FROM public.users
      ORDER BY created_at DESC
      LIMIT 500
    `);

    res.json({ data: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not load users' });
  }
});

// Payment queue
router.get('/payments', requireRoles('SUPER_ADMIN', 'ADMIN'), async (_req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });

  try {
    const result = await pool.query(`
      SELECT
        p.id,
        p.user_id AS "userId",
        u.email,
        u.display_name AS "displayName",
        p.membership_id AS "membershipId",
        p.plan,
        p.payment_method AS "paymentMethod",
        p.transaction_reference AS "transactionReference",
        p.amount_bdt AS "amountBdt",
        p.status,
        p.admin_note AS "adminNote",
        p.created_at AS "createdAt"
      FROM public.payment_submissions p
      JOIN public.users u ON u.id = p.user_id
      ORDER BY CASE WHEN p.status = 'PENDING' THEN 0 ELSE 1 END,
        p.created_at DESC
      LIMIT 500
    `);

    res.json({ data: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not load payment queue' });
  }
});

// Review payment
router.post('/payments/:id/review', requireRoles('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const parsed = z.object({
    decision: z.enum(['APPROVE', 'REJECT']),
    note: z.string().trim().max(500).optional()
  }).safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: 'Choose APPROVE or REJECT' });
  }

  if (!pool) return res.status(503).json({ error: 'Database not configured' });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const found = await client.query(`
      SELECT id, user_id, membership_id, plan, status
      FROM public.payment_submissions
      WHERE id = $1
      FOR UPDATE
    `, [req.params.id]);

    if (!found.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Payment not found' });
    }

    const payment = found.rows[0];

    if (payment.status !== 'PENDING') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Payment already reviewed' });
    }

    const approved = parsed.data.decision === 'APPROVE';
    const status = approved ? 'APPROVED' : 'REJECTED';
    const auth = (req as any).auth;

    await client.query(`
      UPDATE public.payment_submissions
      SET status = $2, reviewed_by = $3, reviewed_at = now(), admin_note = $4
      WHERE id = $1
    `, [req.params.id, status, auth.userId, parsed.data.note || null]);

    if (approved) {
      await client.query(`
        UPDATE public.memberships
        SET status = 'EXPIRED'
        WHERE user_id = $1 AND status = 'ACTIVE'
      `, [payment.user_id]);

      await client.query(`
        UPDATE public.memberships
        SET status = 'ACTIVE',
          starts_at = now(),
          ends_at = CASE
            WHEN plan = 'MONTHLY' THEN now() + interval '1 month'
            ELSE now() + interval '1 year'
          END
        WHERE id = $1
      `, [payment.membership_id]);
    } else {
      await client.query(
        `UPDATE public.memberships SET status = 'FAILED' WHERE id = $1`,
        [payment.membership_id]
      );
    }

    await client.query(`
      INSERT INTO public.notifications(user_id, title, body, href)
      VALUES($1, $2, $3, '/account')
    `, [
      payment.user_id,
      approved ? 'Premium membership activated' : 'Payment submission rejected',
      approved
        ? 'Your premium membership is now active.'
        : 'Your payment could not be verified.'
    ]);

    await client.query(`
      INSERT INTO public.audit_logs(actor_user_id, action, entity_type, entity_id, metadata)
      VALUES($1, $2, 'payment_submission', $3, $4::jsonb)
    `, [
      auth.userId,
      `PAYMENT_${status}`,
      req.params.id,
      JSON.stringify({ membershipId: payment.membership_id })
    ]);

    await client.query('COMMIT');

    res.json({ ok: true, status, membershipActivated: approved });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Could not review payment' });
  } finally {
    client.release();
  }
});

// Revenue
router.get('/revenue', requireRoles(
  'SUPER_ADMIN',
  'ADMIN',
  'ADVERTISEMENT_MANAGER',
  'COLLABORATION_MANAGER',
  'ANALYST'
), async (_req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });

  try {
    const [manual, ads, sponsors, premium] = await Promise.all([
      pool.query(`
        SELECT source, currency,
          COALESCE(SUM(amount), 0)::numeric(12,2) AS amount
        FROM public.revenue_entries
        WHERE status = 'CONFIRMED'
        GROUP BY source, currency
      `),
      pool.query(`
        SELECT provider, currency,
          COALESCE(SUM(revenue), 0)::numeric(12,2) AS amount,
          COALESCE(SUM(impressions), 0)::bigint AS impressions,
          COALESCE(SUM(clicks), 0)::bigint AS clicks
        FROM public.ad_metrics_daily
        GROUP BY provider, currency
      `),
      pool.query(`
        SELECT COUNT(*)::int AS count,
          COALESCE(SUM(amount_bdt) FILTER (
            WHERE status IN ('ACTIVE', 'COMPLETED')
          ), 0)::numeric(12,2) AS contracted_bdt
        FROM public.sponsors
      `),
      pool.query(`
        SELECT COUNT(*)::int AS count,
          COALESCE(SUM(amount_bdt), 0)::numeric(12,2) AS amount_bdt
        FROM public.payment_submissions
        WHERE status = 'APPROVED'
      `)
    ]);

    res.json({
      manual: manual.rows,
      ads: ads.rows,
      sponsors: sponsors.rows[0],
      premium: premium.rows[0],
      note: 'Ad metrics depend on the last verified import.'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not load revenue data' });
  }
});

// Analytics
router.get('/analytics', requireRoles('SUPER_ADMIN', 'ADMIN', 'ANALYST'), async (_req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });

  try {
    const [daily, top, totals] = await Promise.all([
      pool.query(`
        SELECT date_trunc('day', created_at)::date AS day,
          COUNT(*) FILTER (WHERE event_type = 'PLAY')::int AS plays,
          COUNT(*) FILTER (WHERE event_type = 'COMPLETE')::int AS completions,
          COALESCE(SUM(watched_seconds), 0)::bigint AS watched_seconds
        FROM public.playback_events
        WHERE created_at >= now() - interval '30 days'
        GROUP BY 1 ORDER BY 1
      `),
      pool.query(`
        SELECT a.title,
          COUNT(*) FILTER (WHERE e.event_type = 'PLAY')::int AS plays
        FROM public.playback_events e
        JOIN public.anime a ON a.id = e.anime_id
        WHERE e.created_at >= now() - interval '30 days'
        GROUP BY a.title ORDER BY plays DESC LIMIT 10
      `),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE event_type = 'PLAY')::int AS plays,
          COUNT(*) FILTER (WHERE event_type = 'COMPLETE')::int AS completions,
          COUNT(DISTINCT user_id)::int AS active_viewers
        FROM public.playback_events
        WHERE created_at >= now() - interval '30 days'
      `)
    ]);

    res.json({
      daily: daily.rows,
      topAnime: top.rows,
      totals: totals.rows[0],
      period: '30 days'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not load analytics' });
  }
});

// Campaigns
const campaignSchema = z.object({
  provider: z.enum(['ADSTERRA', 'CUSTOM']),
  name: z.string().trim().min(2).max(160),
  placement: z.string().trim().min(2).max(100),
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ENDED']).default('DRAFT'),
  adCode: z.string().max(12000).optional().nullable(),
  targetUrl: z.string().url().optional().nullable(),
  notes: z.string().max(2000).optional().nullable()
});

router.get('/campaigns', requireRoles('SUPER_ADMIN', 'ADMIN', 'ADVERTISEMENT_MANAGER'), async (_req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });

  try {
    const result = await pool.query(`
      SELECT id, provider, name, placement, status,
        ad_code AS "adCode", target_url AS "targetUrl",
        notes, starts_at AS "startsAt", ends_at AS "endsAt",
        created_at AS "createdAt"
      FROM public.ad_campaigns
      ORDER BY created_at DESC
    `);

    res.json({ data: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not load campaigns' });
  }
});

router.post('/campaigns', requireRoles('SUPER_ADMIN', 'ADMIN', 'ADVERTISEMENT_MANAGER'), async (req, res) => {
  const parsed = campaignSchema.safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ error: 'Invalid campaign' });
  if (!pool) return res.status(503).json({ error: 'Database not configured' });

  const c = parsed.data;

  try {
    const result = await pool.query(`
      INSERT INTO public.ad_campaigns(
        provider, name, placement, status, ad_code, target_url, notes
      )
      VALUES($1,$2,$3,$4,$5,$6,$7)
      RETURNING id, name, provider, placement, status
    `, [
      c.provider, c.name, c.placement, c.status,
      c.adCode ?? null, c.targetUrl ?? null, c.notes ?? null
    ]);

    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not create campaign' });
  }
});

router.patch('/campaigns/:id', requireRoles('SUPER_ADMIN', 'ADMIN', 'ADVERTISEMENT_MANAGER'), async (req, res) => {
  const parsed = z.object({
    status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ENDED']).optional(),
    notes: z.string().max(2000).optional()
  }).safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ error: 'Invalid update' });
  if (!pool) return res.status(503).json({ error: 'Database not configured' });

  try {
    const result = await pool.query(`
      UPDATE public.ad_campaigns
      SET status = COALESCE($2, status), notes = COALESCE($3, notes)
      WHERE id = $1
      RETURNING id, status
    `, [req.params.id, parsed.data.status ?? null, parsed.data.notes ?? null]);

    if (!result.rowCount) return res.status(404).json({ error: 'Campaign not found' });

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not update campaign' });
  }
});

// Sponsors
const sponsorSchema = z.object({
  companyName: z.string().trim().min(2).max(180),
  contactName: z.string().max(160).optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  packageName: z.string().max(120).optional().nullable(),
  amountBdt: z.number().min(0).max(100000000).default(0),
  status: z.enum(['LEAD', 'CONTACTED', 'NEGOTIATION', 'ACTIVE', 'COMPLETED', 'LOST']).default('LEAD'),
  startsAt: z.string().optional().nullable(),
  endsAt: z.string().optional().nullable(),
  notes: z.string().max(3000).optional().nullable()
});

router.get('/sponsors', requireRoles('SUPER_ADMIN', 'ADMIN', 'COLLABORATION_MANAGER'), async (_req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });

  try {
    const result = await pool.query(`
      SELECT id, company_name AS "companyName",
        contact_name AS "contactName", email, phone,
        package_name AS "packageName", amount_bdt AS "amountBdt",
        status, starts_at AS "startsAt", ends_at AS "endsAt",
        notes, created_at AS "createdAt"
      FROM public.sponsors
      ORDER BY created_at DESC
    `);

    res.json({ data: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not load sponsors' });
  }
});

router.post('/sponsors', requireRoles('SUPER_ADMIN', 'ADMIN', 'COLLABORATION_MANAGER'), async (req, res) => {
  const parsed = sponsorSchema.safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ error: 'Invalid sponsor' });
  if (!pool) return res.status(503).json({ error: 'Database not configured' });

  const s = parsed.data;

  try {
    const result = await pool.query(`
      INSERT INTO public.sponsors(
        company_name, contact_name, email, phone, package_name,
        amount_bdt, status, starts_at, ends_at, notes
      )
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id, company_name AS "companyName", status,
        amount_bdt AS "amountBdt"
    `, [
      s.companyName, s.contactName ?? null, s.email ?? null,
      s.phone ?? null, s.packageName ?? null, s.amountBdt,
      s.status, s.startsAt ?? null, s.endsAt ?? null, s.notes ?? null
    ]);

    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not create sponsor' });
  }
});

router.patch('/sponsors/:id', requireRoles('SUPER_ADMIN', 'ADMIN', 'COLLABORATION_MANAGER'), async (req, res) => {
  const parsed = z.object({
    status: z.enum(['LEAD', 'CONTACTED', 'NEGOTIATION', 'ACTIVE', 'COMPLETED', 'LOST']).optional(),
    notes: z.string().max(3000).optional()
  }).safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ error: 'Invalid update' });
  if (!pool) return res.status(503).json({ error: 'Database not configured' });

  try {
    const result = await pool.query(`
      UPDATE public.sponsors
      SET status = COALESCE($2, status),
        notes = COALESCE($3, notes),
        updated_at = now()
      WHERE id = $1
      RETURNING id, status
    `, [req.params.id, parsed.data.status ?? null, parsed.data.notes ?? null]);

    if (!result.rowCount) return res.status(404).json({ error: 'Sponsor not found' });

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not update sponsor' });
  }
});

// Import verified Adsterra/custom ad metrics
router.post('/ad-metrics/import', requireRoles('SUPER_ADMIN', 'ADMIN', 'ADVERTISEMENT_MANAGER'), async (req, res) => {
  const parsed = z.object({
    provider: z.enum(['ADSTERRA', 'CUSTOM']),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    placement: z.string().max(100).default('default'),
    impressions: z.number().int().min(0),
    clicks: z.number().int().min(0),
    revenue: z.number().min(0),
    currency: z.enum(['USD', 'BDT']).default('USD')
  }).safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ error: 'Invalid metrics row' });
  if (!pool) return res.status(503).json({ error: 'Database not configured' });

  const m = parsed.data;

  try {
    const result = await pool.query(`
      INSERT INTO public.ad_metrics_daily(
        provider, metric_date, placement, impressions, clicks, revenue, currency
      )
      VALUES($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT(provider, metric_date, placement)
      DO UPDATE SET
        impressions = EXCLUDED.impressions,
        clicks = EXCLUDED.clicks,
        revenue = EXCLUDED.revenue,
        currency = EXCLUDED.currency,
        imported_at = now()
      RETURNING id
    `, [
      m.provider, m.date, m.placement,
      m.impressions, m.clicks, m.revenue, m.currency
    ]);

    res.status(201).json({ ok: true, id: result.rows[0].id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not import metrics' });
  }
});

// Staff management
router.post('/staff', requireRoles('SUPER_ADMIN'), async (req, res) => {
  const parsed = z.object({
    email: z.string().email().max(254),
    displayName: z.string().trim().min(2).max(60),
    password: z.string().min(12).max(200),
    role: z.enum([
      'ADMIN',
      'CONTENT_MANAGER',
      'ADVERTISEMENT_MANAGER',
      'COLLABORATION_MANAGER',
      'MODERATOR',
      'ANALYST'
    ])
  }).safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ error: 'Invalid staff data' });
  if (!pool) return res.status(503).json({ error: 'Database not configured' });

  try {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.default.hash(parsed.data.password, 12);

    const result = await pool.query(`
      INSERT INTO public.users(email, password_hash, display_name, role)
      VALUES($1,$2,$3,$4)
      RETURNING id, email, display_name AS "displayName", role, status
    `, [
      parsed.data.email.toLowerCase(),
      hash,
      parsed.data.displayName,
      parsed.data.role
    ]);

    res.status(201).json({ data: result.rows[0] });
  } catch (error: any) {
    if (error?.code === '23505') {
      return res.status(409).json({ error: 'Email is already registered' });
    }

    console.error(error);
    res.status(500).json({ error: 'Could not create staff account' });
  }
});

router.patch('/staff/:id', requireRoles('SUPER_ADMIN'), async (req, res) => {
  const parsed = z.object({
    role: z.enum([
      'ADMIN',
      'CONTENT_MANAGER',
      'ADVERTISEMENT_MANAGER',
      'COLLABORATION_MANAGER',
      'MODERATOR',
      'ANALYST'
    ]).optional(),
    status: z.enum(['ACTIVE', 'SUSPENDED']).optional()
  }).refine(value => Object.keys(value).length > 0).safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ error: 'Invalid staff update' });
  if (!pool) return res.status(503).json({ error: 'Database not configured' });

  try {
    const result = await pool.query(`
      UPDATE public.users
      SET role = COALESCE($2, role),
        status = COALESCE($3, status)
      WHERE id = $1 AND role <> 'SUPER_ADMIN'
      RETURNING id, email, role, status
    `, [
      req.params.id,
      parsed.data.role ?? null,
      parsed.data.status ?? null
    ]);

    if (!result.rowCount) {
      return res.status(404).json({ error: 'Staff not found or protected' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not update staff member' });
  }
});

// Moderation queue
router.get('/moderation', requireRoles('SUPER_ADMIN', 'ADMIN', 'MODERATOR'), async (_req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });

  try {
    const [comments, reports] = await Promise.all([
      pool.query(`
        SELECT c.id, c.body, c.status,
          c.created_at AS "createdAt",
          u.display_name AS "displayName",
          a.title AS "animeTitle"
        FROM public.comments c
        JOIN public.users u ON u.id = c.user_id
        JOIN public.anime a ON a.id = c.anime_id
        WHERE c.status = 'PENDING'
        ORDER BY c.created_at ASC LIMIT 200
      `),
      pool.query(`
        SELECT r.id, r.reason, r.status,
          r.created_at AS "createdAt",
          c.body, u.display_name AS "reporterName"
        FROM public.content_reports r
        LEFT JOIN public.comments c ON c.id = r.comment_id
        LEFT JOIN public.users u ON u.id = r.reporter_user_id
        WHERE r.status = 'OPEN'
        ORDER BY r.created_at ASC LIMIT 200
      `)
    ]);

    res.json({ comments: comments.rows, reports: reports.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not load moderation queue' });
  }
});

// Moderate comment
router.patch('/moderation/comments/:id', requireRoles('SUPER_ADMIN', 'ADMIN', 'MODERATOR'), async (req, res) => {
  const parsed = z.object({
    status: z.enum(['PUBLISHED', 'HIDDEN', 'REMOVED'])
  }).safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ error: 'Invalid moderation status' });
  if (!pool) return res.status(503).json({ error: 'Database not configured' });

  try {
    const result = await pool.query(`
      UPDATE public.comments
      SET status = $2, updated_at = now()
      WHERE id = $1
      RETURNING id, user_id, status
    `, [req.params.id, parsed.data.status]);

    if (!result.rowCount) return res.status(404).json({ error: 'Comment not found' });

    const comment = result.rows[0];

    await pool.query(`
      INSERT INTO public.notifications(user_id, title, body, href)
      VALUES($1, $2, $3, '/anime')
    `, [
      comment.user_id,
      'Comment moderation update',
      `Your comment status is now ${comment.status}.`
    ]);

    res.json({ data: { id: comment.id, status: comment.status } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not moderate comment' });
  }
});

// Resolve or dismiss report
router.patch('/moderation/reports/:id', requireRoles('SUPER_ADMIN', 'ADMIN', 'MODERATOR'), async (req, res) => {
  const parsed = z.object({
    status: z.enum(['RESOLVED', 'DISMISSED'])
  }).safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ error: 'Invalid report status' });
  if (!pool) return res.status(503).json({ error: 'Database not configured' });

  try {
    const auth = (req as any).auth;

    const result = await pool.query(`
      UPDATE public.content_reports
      SET status = $2, reviewed_by = $3, reviewed_at = now()
      WHERE id = $1 AND status = 'OPEN'
      RETURNING id, status
    `, [req.params.id, parsed.data.status, auth.userId]);

    if (!result.rowCount) return res.status(404).json({ error: 'Open report not found' });

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not update report' });
  }
});

export default router;
