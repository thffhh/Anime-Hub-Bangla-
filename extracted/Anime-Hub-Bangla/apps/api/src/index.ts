import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { pool } from './db.js';
import authRoutes from './routes/auth-routes.js';
import adminRoutes from './routes/admin-routes.js';
import userRoutes from './routes/user-routes.js';
import { optionalAuth } from './auth.js';

const app = express();
app.use(cors({ origin: process.env.WEB_ORIGIN?.split(',') || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', async (_req,res) => {
  let database = 'not_configured';
  if (pool) { try { await pool.query('SELECT 1'); database = 'connected'; } catch { database = 'error'; } }
  res.json({ ok: true, service: 'anime-hub-api', database, timestamp: new Date().toISOString() });
});

app.get('/api/episodes/:id/playback', optionalAuth, async (req,res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const r = await pool.query(`SELECT id,video_provider AS "videoProvider",provider_video_id AS "providerVideoId",is_premium AS "isPremium" FROM episodes WHERE id=$1 AND published=true AND (release_at IS NULL OR release_at<=now())`, [req.params.id]);
    if (!r.rowCount) return res.status(404).json({ error: 'Episode not found' });
    const ep = r.rows[0];
    if (ep.isPremium) {
      if (!req.auth) return res.status(401).json({ error: 'Sign in and subscribe to watch this premium episode' });
      const m = await pool.query(`SELECT 1 FROM memberships WHERE user_id=$1 AND status='ACTIVE' AND plan IN ('MONTHLY','YEARLY') AND ends_at>now() LIMIT 1`, [req.auth.userId]);
      if (!m.rowCount) return res.status(403).json({ error: 'Premium membership required for this episode' });
    }
    res.setHeader('Cache-Control','private, no-store');
    res.json({ data: ep });
  } catch (error) { console.error('playback authorization failed',error);res.status(500).json({error:'Could not authorize playback'}); }
});

app.get('/api/anime/:slug', async (req,res) => {
  if (!pool) return res.status(503).json({ error: 'Catalogue database is not configured' });
  try {
    const anime = await pool.query(
      `SELECT id, slug, title, original_title AS \"originalTitle\", synopsis, poster_url AS \"posterUrl\", banner_url AS \"bannerUrl\", release_year AS \"releaseYear\", status, genres FROM anime WHERE slug=$1 AND published=true LIMIT 1`,
      [req.params.slug]
    );
    if (!anime.rowCount) return res.status(404).json({ error: 'Anime not found' });
    const episodes = await pool.query(
      `SELECT id, episode_number AS \"episodeNumber\", title, synopsis, runtime_seconds AS \"runtimeSeconds\", thumbnail_url AS \"thumbnailUrl\", is_premium AS \"isPremium\" FROM episodes WHERE anime_id=$1 AND published=true AND (release_at IS NULL OR release_at <= now()) ORDER BY episode_number`,
      [anime.rows[0].id]
    );
    res.json({ data: { ...anime.rows[0], episodes: episodes.rows } });
  } catch (err) {
    console.error('anime details failed', err);
    res.status(500).json({ error: 'Could not load anime details' });
  }
});

app.get('/api/anime', async (_req,res) => {
  if (!pool) return res.json({ data: [], notice: 'Database is not configured. Demo titles are shown by the web app.' });
  try {
    const result = await pool.query(
      `SELECT id, slug, title, synopsis, poster_url AS "posterUrl", release_year AS "releaseYear",
       status, genres FROM anime WHERE published = true ORDER BY created_at DESC LIMIT 100`
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error('anime list failed', err);
    res.status(500).json({ error: 'Could not load catalogue' });
  }
});

// Admin routes must be protected by verified server-side authentication and RBAC before production.
// This endpoint intentionally exposes only a health/configuration summary, never secret values.
app.get('/api/admin/system-status', (_req,res) => {
  res.status(501).json({ error: 'Admin authentication is not configured yet. See docs/SECURITY.md.' });
});

const port = Number(process.env.PORT || 4000);
app.listen(port, '0.0.0.0', () => console.log(`Anime Hub API listening on ${port}`));
