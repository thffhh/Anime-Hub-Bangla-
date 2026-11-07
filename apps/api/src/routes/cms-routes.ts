
import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireAuth, requireRoles, type AuthRequest } from '../auth.js';

const router = Router();
const managers = ['SUPER_ADMIN', 'ADMIN'] as const;

const pageSchema = z.object({
  slug: z.string().trim().min(2).max(160).regex(/^[a-z0-9-]+$/),
  title: z.string().trim().min(2).max(200),
  content: z.record(z.unknown()).default({}),
  seoTitle: z.string().max(200).nullable().optional(),
  seoDescription: z.string().max(500).nullable().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT')
}).strict();

const sectionSchema = z.object({
  sectionKey: z.string().trim().min(2).max(100).regex(/^[a-z0-9_-]+$/),
  title: z.string().max(200).nullable().optional(),
  subtitle: z.string().max(500).nullable().optional(),
  content: z.record(z.unknown()).default({}),
  isEnabled: z.boolean().default(true),
  displayOrder: z.number().int().min(0).max(100000).default(0)
}).strict();

const navigationSchema = z.object({
  location: z.string().trim().min(2).max(60),
  label: z.string().trim().min(1).max(100),
  url: z.string().trim().min(1).max(500),
  openNewTab: z.boolean().default(false),
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().min(0).max(100000).default(0)
}).strict();

const announcementSchema = z.object({
  title: z.string().trim().min(2).max(160),
  message: z.string().trim().min(2).max(1000),
  linkUrl: z.string().url().nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  isActive: z.boolean().default(true)
}).strict();

const mediaSchema = z.object({
  name: z.string().trim().min(1).max(160),
  assetUrl: z.string().url(),
  assetType: z.enum(['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'OTHER']),
  mimeType: z.string().max(120).nullable().optional(),
  fileSizeBytes: z.number().int().min(0).nullable().optional(),
  altText: z.string().max(300).nullable().optional(),
  metadata: z.record(z.unknown()).default({})
}).strict();

function dbError(res: any, error: unknown, message: string) {
  console.error(message, error);
  return res.status(500).json({ error: message });
}

// PUBLIC CMS
router.get('/public/homepage', async (_req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });

  try {
    const [sections, announcements, settings] = await Promise.all([
      pool.query(`
        SELECT section_key AS "sectionKey", title, subtitle, content,
          display_order AS "displayOrder"
        FROM public.cms_homepage_sections
        WHERE is_enabled = true
        ORDER BY display_order ASC
      `),
      pool.query(`
        SELECT id, title, message, link_url AS "linkUrl",
          starts_at AS "startsAt", ends_at AS "endsAt"
        FROM public.cms_announcements
        WHERE is_active = true
          AND (starts_at IS NULL OR starts_at <= now())
          AND (ends_at IS NULL OR ends_at > now())
        ORDER BY created_at DESC
        LIMIT 20
      `),
      pool.query(`
        SELECT setting_key, setting_value
        FROM public.site_settings
        WHERE setting_key IN (
          'siteName', 'tagline', 'announcement',
          'heroTitle', 'heroSubtitle', 'contactEmail',
          'maintenanceMode'
        )
      `)
    ]);

    const siteSettings: Record<string, unknown> = {};
    for (const row of settings.rows) {
      siteSettings[row.setting_key] = row.setting_value;
    }

    res.json({
      sections: sections.rows,
      announcements: announcements.rows,
      settings: siteSettings
    });
  } catch (error) {
    dbError(res, error, 'Could not load homepage CMS data');
  }
});

router.get('/public/pages/:slug', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });

  try {
    const result = await pool.query(`
      SELECT slug, title, content,
        seo_title AS "seoTitle",
        seo_description AS "seoDescription",
        published_at AS "publishedAt"
      FROM public.cms_pages
      WHERE slug = $1 AND status = 'PUBLISHED'
      LIMIT 1
    `, [req.params.slug]);

    if (!result.rowCount) return res.status(404).json({ error: 'Page not found' });
    res.json({ data: result.rows[0] });
  } catch (error) {
    dbError(res, error, 'Could not load page');
  }
});

router.get('/public/navigation/:location', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });

  try {
    const result = await pool.query(`
      SELECT id, label, url,
        open_new_tab AS "openNewTab",
        display_order AS "displayOrder"
      FROM public.cms_navigation_items
      WHERE location = $1 AND is_active = true
      ORDER BY display_order ASC
    `, [req.params.location]);

    res.json({ data: result.rows });
  } catch (error) {
    dbError(res, error, 'Could not load navigation');
  }
});

// All management routes below require Super Admin / Admin.
router.use('/admin', requireAuth, requireRoles(...managers));

// PAGES
router.get('/admin/pages', async (_req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });

  try {
    const result = await pool.query(`
      SELECT id, slug, title, content,
        seo_title AS "seoTitle",
        seo_description AS "seoDescription",
        status, published_at AS "publishedAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM public.cms_pages
      ORDER BY updated_at DESC
      LIMIT 500
    `);
    res.json({ data: result.rows });
  } catch (error) {
    dbError(res, error, 'Could not load CMS pages');
  }
});

router.post('/admin/pages', async (req: AuthRequest, res) => {
  const parsed = pageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid page data', details: parsed.error.flatten() });
  if (!pool) return res.status(503).json({ error: 'Database not configured' });

  const p = parsed.data;
  try {
    const result = await pool.query(`
      INSERT INTO public.cms_pages (
        slug, title, content, seo_title, seo_description,
        status, published_at, created_by, updated_by
      )
      VALUES ($1,$2,$3::jsonb,$4,$5,$6,
        CASE WHEN $6 = 'PUBLISHED' THEN now() ELSE NULL END,$7,$7)
      RETURNING *
    `, [
      p.slug, p.title, JSON.stringify(p.content),
      p.seoTitle ?? null, p.seoDescription ?? null,
      p.status, req.auth!.userId
    ]);
    res.status(201).json({ data: result.rows[0] });
  } catch (error: any) {
    if (error?.code === '23505') return res.status(409).json({ error: 'Page slug already exists' });
    dbError(res, error, 'Could not create page');
  }
});

router.put('/admin/pages/:id', async (req: AuthRequest, res) => {
  const parsed = pageSchema.partial().strict().safeParse(req.body);
  if (!parsed.success || !Object.keys(parsed.data || {}).length) {
    return res.status(400).json({ error: 'Invalid page update' });
  }
  if (!pool) return res.status(503).json({ error: 'Database not configured' });

  const map: Record<string, string> = {
    slug: 'slug',
    title: 'title',
    content: 'content',
    seoTitle: 'seo_title',
    seoDescription: 'seo_description',
    status: 'status'
  };

  const entries = Object.entries(parsed.data);
  const values: unknown[] = [req.params.id];
  const sets = entries.map(([key, value]) => {
    values.push(key === 'content' ? JSON.stringify(value) : value);
    const col = map[key];
    return key === 'content'
      ? `${col} = $${values.length}::jsonb`
      : `${col} = $${values.length}`;
  });

  if (parsed.data.status === 'PUBLISHED') {
    sets.push('published_at = COALESCE(published_at, now())');
  } else if (parsed.data.status === 'DRAFT') {
    sets.push('published_at = NULL');
  }

  values.push(req.auth!.userId);
  sets.push(`updated_by = $${values.length}`);
  sets.push('updated_at = now()');

  try {
    const result = await pool.query(`
      UPDATE public.cms_pages
      SET ${sets.join(', ')}
      WHERE id = $1
      RETURNING *
    `, values);
    if (!result.rowCount) return res.status(404).json({ error: 'Page not found' });
    res.json({ data: result.rows[0] });
  } catch (error: any) {
    if (error?.code === '23505') return res.status(409).json({ error: 'Page slug already exists' });
    dbError(res, error, 'Could not update page');
  }
});

router.delete('/admin/pages/:id', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const result = await pool.query(
      'DELETE FROM public.cms_pages WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Page not found' });
    res.json({ ok: true });
  } catch (error) {
    dbError(res, error, 'Could not delete page');
  }
});

// HOMEPAGE SECTIONS
router.get('/admin/sections', async (_req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const result = await pool.query(`
      SELECT id, section_key AS "sectionKey", title, subtitle, content,
        is_enabled AS "isEnabled", display_order AS "displayOrder",
        updated_at AS "updatedAt"
      FROM public.cms_homepage_sections
      ORDER BY display_order ASC
    `);
    res.json({ data: result.rows });
  } catch (error) {
    dbError(res, error, 'Could not load homepage sections');
  }
});

router.post('/admin/sections', async (req: AuthRequest, res) => {
  const parsed = sectionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid section data', details: parsed.error.flatten() });
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const p = parsed.data;
  try {
    const result = await pool.query(`
      INSERT INTO public.cms_homepage_sections
        (section_key, title, subtitle, content, is_enabled, display_order, updated_by)
      VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7)
      RETURNING id, section_key AS "sectionKey", title, subtitle, content,
        is_enabled AS "isEnabled", display_order AS "displayOrder"
    `, [
      p.sectionKey, p.title ?? null, p.subtitle ?? null,
      JSON.stringify(p.content), p.isEnabled, p.displayOrder, req.auth!.userId
    ]);
    res.status(201).json({ data: result.rows[0] });
  } catch (error: any) {
    if (error?.code === '23505') return res.status(409).json({ error: 'Section key already exists' });
    dbError(res, error, 'Could not create section');
  }
});

router.put('/admin/sections/:id', async (req: AuthRequest, res) => {
  const parsed = sectionSchema.partial().strict().safeParse(req.body);
  if (!parsed.success || !Object.keys(parsed.data || {}).length) return res.status(400).json({ error: 'Invalid section update' });
  if (!pool) return res.status(503).json({ error: 'Database not configured' });

  const map: Record<string, string> = {
    sectionKey: 'section_key',
    title: 'title',
    subtitle: 'subtitle',
    content: 'content',
    isEnabled: 'is_enabled',
    displayOrder: 'display_order'
  };
  const values: unknown[] = [req.params.id];
  const sets = Object.entries(parsed.data).map(([key, value]) => {
    values.push(key === 'content' ? JSON.stringify(value) : value);
    return key === 'content'
      ? `${map[key]} = $${values.length}::jsonb`
      : `${map[key]} = $${values.length}`;
  });
  values.push(req.auth!.userId);
  sets.push(`updated_by = $${values.length}`, 'updated_at = now()');

  try {
    const result = await pool.query(`
      UPDATE public.cms_homepage_sections
      SET ${sets.join(', ')}
      WHERE id = $1
      RETURNING *
    `, values);
    if (!result.rowCount) return res.status(404).json({ error: 'Section not found' });
    res.json({ data: result.rows[0] });
  } catch (error: any) {
    if (error?.code === '23505') return res.status(409).json({ error: 'Section key already exists' });
    dbError(res, error, 'Could not update section');
  }
});

router.delete('/admin/sections/:id', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const result = await pool.query(
      'DELETE FROM public.cms_homepage_sections WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Section not found' });
    res.json({ ok: true });
  } catch (error) {
    dbError(res, error, 'Could not delete section');
  }
});

// NAVIGATION
router.get('/admin/navigation', async (_req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const result = await pool.query(`
      SELECT id, location, label, url,
        open_new_tab AS "openNewTab", is_active AS "isActive",
        display_order AS "displayOrder"
      FROM public.cms_navigation_items
      ORDER BY location, display_order
    `);
    res.json({ data: result.rows });
  } catch (error) {
    dbError(res, error, 'Could not load navigation');
  }
});

router.post('/admin/navigation', async (req, res) => {
  const parsed = navigationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid navigation item' });
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const p = parsed.data;
  try {
    const result = await pool.query(`
      INSERT INTO public.cms_navigation_items
        (location, label, url, open_new_tab, is_active, display_order)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *
    `, [p.location, p.label, p.url, p.openNewTab, p.isActive, p.displayOrder]);
    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    dbError(res, error, 'Could not create navigation item');
  }
});

router.put('/admin/navigation/:id', async (req, res) => {
  const parsed = navigationSchema.partial().strict().safeParse(req.body);
  if (!parsed.success || !Object.keys(parsed.data || {}).length) return res.status(400).json({ error: 'Invalid navigation update' });
  if (!pool) return res.status(503).json({ error: 'Database not configured' });

  const map: Record<string, string> = {
    location: 'location',
    label: 'label',
    url: 'url',
    openNewTab: 'open_new_tab',
    isActive: 'is_active',
    displayOrder: 'display_order'
  };
  const values: unknown[] = [req.params.id];
  const sets = Object.entries(parsed.data).map(([key, value]) => {
    values.push(value);
    return `${map[key]} = $${values.length}`;
  });
  sets.push('updated_at = now()');

  try {
    const result = await pool.query(`
      UPDATE public.cms_navigation_items
      SET ${sets.join(', ')}
      WHERE id = $1
      RETURNING *
    `, values);
    if (!result.rowCount) return res.status(404).json({ error: 'Navigation item not found' });
    res.json({ data: result.rows[0] });
  } catch (error) {
    dbError(res, error, 'Could not update navigation item');
  }
});

router.delete('/admin/navigation/:id', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const result = await pool.query(
      'DELETE FROM public.cms_navigation_items WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Navigation item not found' });
    res.json({ ok: true });
  } catch (error) {
    dbError(res, error, 'Could not delete navigation item');
  }
});

// ANNOUNCEMENTS
router.get('/admin/announcements', async (_req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const result = await pool.query(`
      SELECT id, title, message, link_url AS "linkUrl",
        starts_at AS "startsAt", ends_at AS "endsAt",
        is_active AS "isActive", created_at AS "createdAt"
      FROM public.cms_announcements
      ORDER BY created_at DESC
    `);
    res.json({ data: result.rows });
  } catch (error) {
    dbError(res, error, 'Could not load announcements');
  }
});

router.post('/admin/announcements', async (req: AuthRequest, res) => {
  const parsed = announcementSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid announcement data', details: parsed.error.flatten() });
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const p = parsed.data;
  try {
    const result = await pool.query(`
      INSERT INTO public.cms_announcements
        (title, message, link_url, starts_at, ends_at, is_active, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
    `, [
      p.title, p.message, p.linkUrl ?? null,
      p.startsAt ?? null, p.endsAt ?? null,
      p.isActive, req.auth!.userId
    ]);
    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    dbError(res, error, 'Could not create announcement');
  }
});

router.patch('/admin/announcements/:id', async (req, res) => {
  const parsed = announcementSchema.partial().strict().safeParse(req.body);
  if (!parsed.success || !Object.keys(parsed.data || {}).length) return res.status(400).json({ error: 'Invalid announcement update' });
  if (!pool) return res.status(503).json({ error: 'Database not configured' });

  const map: Record<string, string> = {
    title: 'title',
    message: 'message',
    linkUrl: 'link_url',
    startsAt: 'starts_at',
    endsAt: 'ends_at',
    isActive: 'is_active'
  };
  const values: unknown[] = [req.params.id];
  const sets = Object.entries(parsed.data).map(([key, value]) => {
    values.push(value);
    return `${map[key]} = $${values.length}`;
  });
  sets.push('updated_at = now()');

  try {
    const result = await pool.query(`
      UPDATE public.cms_announcements
      SET ${sets.join(', ')}
      WHERE id = $1
      RETURNING *
    `, values);
    if (!result.rowCount) return res.status(404).json({ error: 'Announcement not found' });
    res.json({ data: result.rows[0] });
  } catch (error) {
    dbError(res, error, 'Could not update announcement');
  }
});

router.delete('/admin/announcements/:id', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const result = await pool.query(
      'DELETE FROM public.cms_announcements WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Announcement not found' });
    res.json({ ok: true });
  } catch (error) {
    dbError(res, error, 'Could not delete announcement');
  }
});

// MEDIA LIBRARY - stores asset metadata and an existing hosted URL.
// Actual file upload/storage provider connection is a separate integration.
router.get('/admin/media', async (_req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const result = await pool.query(`
      SELECT id, name, asset_url AS "assetUrl",
        asset_type AS "assetType", mime_type AS "mimeType",
        file_size_bytes AS "fileSizeBytes", alt_text AS "altText",
        metadata, created_at AS "createdAt"
      FROM public.cms_media_assets
      ORDER BY created_at DESC
      LIMIT 500
    `);
    res.json({ data: result.rows });
  } catch (error) {
    dbError(res, error, 'Could not load media library');
  }
});

router.post('/admin/media', async (req: AuthRequest, res) => {
  const parsed = mediaSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid media data', details: parsed.error.flatten() });
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const p = parsed.data;
  try {
    const result = await pool.query(`
      INSERT INTO public.cms_media_assets (
        name, asset_url, asset_type, mime_type,
        file_size_bytes, alt_text, metadata, uploaded_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)
      RETURNING *
    `, [
      p.name, p.assetUrl, p.assetType, p.mimeType ?? null,
      p.fileSizeBytes ?? null, p.altText ?? null,
      JSON.stringify(p.metadata), req.auth!.userId
    ]);
    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    dbError(res, error, 'Could not register media asset');
  }
});

router.delete('/admin/media/:id', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const result = await pool.query(
      'DELETE FROM public.cms_media_assets WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Media asset not found' });
    res.json({ ok: true });
  } catch (error) {
    dbError(res, error, 'Could not delete media asset');
  }
});

export default router;
