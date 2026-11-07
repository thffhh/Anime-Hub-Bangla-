
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { pool } from './db.js';
import authRoutes from './routes/auth-routes.js';
import adminRoutes from './routes/admin-routes.js';
import userRoutes from './routes/user-routes.js';
import { optionalAuth } from './auth.js';

const app = express();

app.use(cors({
  origin: process.env.WEB_ORIGIN?.split(',') || 'http://localhost:5173'
}));

app.use(express.json({ limit: '1mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', async (_req, res) => {
  let database = 'not_configured';

  if (pool) {
    try {
      await pool.query('SELECT 1');
      database = 'connected';
    } catch {
      database = 'error';
    }
  }

  res.json({
    ok: true,
    service: 'anime-hub-api',
    database,
    timestamp: new Date().toISOString()
  });
});

// Anime catalogue
app.get('/api/anime', async (_req, res) => {
  if (!pool) {
    return res.status(503).json({
      error: 'Database not configured'
    });
  }

  try {
    const result = await pool.query(`
      SELECT
        a.id,
        a.slug,
        a.title,
        a.synopsis,
        a.poster_url AS "posterUrl",
        a.release_year AS "releaseYear",
        a.status,
        COALESCE(
          ARRAY_AGG(DISTINCT g.name)
          FILTER (WHERE g.name IS NOT NULL),
          ARRAY[]::varchar[]
        ) AS genres
      FROM public.anime a
      LEFT JOIN public.anime_genres ag
        ON ag.anime_id = a.id
      LEFT JOIN public.genres g
        ON g.id = ag.genre_id
      WHERE a.is_published = true
      GROUP BY a.id
      ORDER BY a.created_at DESC
      LIMIT 100
    `);

    res.json({ data: result.rows });
  } catch (err) {
    console.error('anime list failed', err);

    res.status(500).json({
      error: 'Could not load catalogue'
    });
  }
});

// Anime details
app.get('/api/anime/:slug', async (req, res) => {
  if (!pool) {
    return res.status(503).json({
      error: 'Database not configured'
    });
  }

  try {
    const anime = await pool.query(`
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
        COALESCE(
          ARRAY_AGG(DISTINCT g.name)
          FILTER (WHERE g.name IS NOT NULL),
          ARRAY[]::varchar[]
        ) AS genres
      FROM public.anime a
      LEFT JOIN public.anime_genres ag
        ON ag.anime_id = a.id
      LEFT JOIN public.genres g
        ON g.id = ag.genre_id
      WHERE a.slug = $1
        AND a.is_published = true
      GROUP BY a.id
      LIMIT 1
    `, [req.params.slug]);

    if (!anime.rowCount) {
      return res.status(404).json({
        error: 'Anime not found'
      });
    }

    const episodes = await pool.query(`
      SELECT
        id,
        episode_number AS "episodeNumber",
        title,
        synopsis,
        runtime_seconds AS "runtimeSeconds",
        thumbnail_url AS "thumbnailUrl",
        is_premium AS "isPremium"
      FROM public.episodes
      WHERE anime_id = $1
        AND published = true
        AND (release_at IS NULL OR release_at <= now())
      ORDER BY episode_number
    `, [anime.rows[0].id]);

    res.json({
      data: {
        ...anime.rows[0],
        episodes: episodes.rows
      }
    });
  } catch (err) {
    console.error('anime details failed', err);

    res.status(500).json({
      error: 'Could not load anime details'
    });
  }
});

// Episode playback authorization
app.get('/api/episodes/:id/playback', optionalAuth, async (req, res) => {
  if (!pool) {
    return res.status(503).json({
      error: 'Database not configured'
    });
  }

  try {
    const result = await pool.query(`
      SELECT
        id,
        video_provider AS "videoProvider",
        provider_video_id AS "providerVideoId",
        is_premium AS "isPremium"
      FROM public.episodes
      WHERE id = $1
        AND published = true
        AND (release_at IS NULL OR release_at <= now())
    `, [req.params.id]);

    if (!result.rowCount) {
      return res.status(404).json({
        error: 'Episode not found'
      });
    }

    const episode = result.rows[0];

    if (episode.isPremium) {
      if (!req.auth) {
        return res.status(401).json({
          error: 'Sign in and subscribe to watch this premium episode'
        });
      }

      const membership = await pool.query(`
        SELECT 1
        FROM memberships
        WHERE user_id = $1
          AND status = 'ACTIVE'
          AND plan IN ('MONTHLY', 'YEARLY')
          AND ends_at > now()
        LIMIT 1
      `, [req.auth.userId]);

      if (!membership.rowCount) {
        return res.status(403).json({
          error: 'Premium membership required for this episode'
        });
      }
    }

    res.setHeader('Cache-Control', 'private, no-store');
    res.json({ data: episode });
  } catch (err) {
    console.error('playback authorization failed', err);

    res.status(500).json({
      error: 'Could not authorize playback'
    });
  }
});

// Admin system status
app.get('/api/admin/system-status', (_req, res) => {
  res.status(501).json({
    error: 'Admin authentication is not configured yet. See docs/SECURITY.md.'
  });
});

const port = Number(process.env.PORT || 4000);

app.listen(port, '0.0.0.0', () => {
  console.log(`Anime Hub API listening on ${port}`);
});
