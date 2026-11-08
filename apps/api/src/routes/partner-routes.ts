
import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireAuth, requireRoles } from '../auth.js';

const router = Router();

const managerRoles = [
  'SUPER_ADMIN',
  'ADMIN',
  'COLLABORATION_MANAGER'
] as const;

const partnerSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().min(2).max(180)
    .regex(/^[a-z0-9-]+$/),
  description: z.string().max(10000).nullable().optional(),
  category: z.enum([
    'DUBBING_TEAM',
    'ANIMATION_STUDIO',
    'MEDIA_PARTNER',
    'COMMUNITY_PARTNER',
    'DISTRIBUTION_PARTNER',
    'OTHER'
  ]).default('MEDIA_PARTNER'),
  logoUrl: z.string().url().nullable().optional(),
  coverUrl: z.string().url().nullable().optional(),
  websiteUrl: z.string().url().nullable().optional(),
  facebookUrl: z.string().url().nullable().optional(),
  youtubeUrl: z.string().url().nullable().optional(),
  instagramUrl: z.string().url().nullable().optional(),
  otherLinks: z.array(z.object({
    label: z.string().trim().min(1).max(60),
    url: z.string().url()
  })).max(20).default([]),
  status: z.enum(['ACTIVE', 'PAST']).default('ACTIVE'),
  isFeatured: z.boolean().default(false),
  isPublished: z.boolean().default(true),
  displayOrder: z.number().int().min(0).max(100000).default(0)
}).strict();

const updateSchema = partnerSchema.partial().strict();

const selectFields = `
  id,
  name,
  slug,
  description,
  category,
  logo_url AS "logoUrl",
  cover_url AS "coverUrl",
  website_url AS "websiteUrl",
  facebook_url AS "facebookUrl",
  youtube_url AS "youtubeUrl",
  instagram_url AS "instagramUrl",
  other_links AS "otherLinks",
  status,
  is_featured AS "isFeatured",
  is_published AS "isPublished",
  display_order AS "displayOrder",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

const fieldMap: Record<string, string> = {
  name: 'name',
  slug: 'slug',
  description: 'description',
  category: 'category',
  logoUrl: 'logo_url',
  coverUrl: 'cover_url',
  websiteUrl: 'website_url',
  facebookUrl: 'facebook_url',
  youtubeUrl: 'youtube_url',
  instagramUrl: 'instagram_url',
  otherLinks: 'other_links',
  status: 'status',
  isFeatured: 'is_featured',
  isPublished: 'is_published',
  displayOrder: 'display_order'
};

// Public partner showcase
router.get('/partners', async (_req, res) => {
  if (!pool) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    const result = await pool.query(`
      SELECT ${selectFields}
      FROM public.collaboration_partners
      WHERE is_published = true
      ORDER BY
        is_featured DESC,
        display_order ASC,
        created_at DESC
      LIMIT 200
    `);

    res.json({ data: result.rows });
  } catch (error) {
    console.error('Public partners failed:', error);
    res.status(500).json({ error: 'Could not load partners' });
  }
});

// Admin-only partner management
router.get(
  '/admin/partners',
  requireAuth,
  requireRoles(...managerRoles),
  async (_req, res) => {
    if (!pool) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    try {
      const result = await pool.query(`
        SELECT ${selectFields}
        FROM public.collaboration_partners
        ORDER BY display_order ASC, created_at DESC
        LIMIT 500
      `);

      res.json({ data: result.rows });
    } catch (error) {
      console.error('Admin partners failed:', error);
      res.status(500).json({ error: 'Could not load partner management' });
    }
  }
);

// Create partner
router.post(
  '/admin/partners',
  requireAuth,
  requireRoles(...managerRoles),
  async (req, res) => {
    const parsed = partnerSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid partner data',
        details: parsed.error.flatten()
      });
    }

    if (!pool) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const p = parsed.data;

    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN');
      const result = await client.query(`
        INSERT INTO public.collaboration_partners (
          name, slug, description, category,
          logo_url, cover_url,
          website_url, facebook_url, youtube_url, instagram_url,
          other_links, status, is_featured, is_published, display_order
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
          $11::jsonb,$12,$13,$14,$15
        )
        RETURNING ${selectFields}
      `, [
        p.name, p.slug, p.description ?? null, p.category,
        p.logoUrl ?? null, p.coverUrl ?? null,
        p.websiteUrl ?? null, p.facebookUrl ?? null,
        p.youtubeUrl ?? null, p.instagramUrl ?? null,
        JSON.stringify(p.otherLinks), p.status,
        p.isFeatured, p.isPublished, p.displayOrder
      ]);

      const partner = result.rows[0];

      await client.query(`
        INSERT INTO public.collaboration_partner_audit
          (partner_id, actor_user_id, action, details)
        VALUES ($1, $2, 'CREATE', $3::jsonb)
      `, [
        partner.id,
        req.auth!.userId,
        JSON.stringify({ name: partner.name })
      ]);

      await client.query('COMMIT');
      res.status(201).json({ data: partner });
    } catch (error: any) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      if (error?.code === '23505') {
        return res.status(409).json({
          error: 'A partner with this slug already exists'
        });
      }

      console.error('Create partner failed:', error);
      res.status(500).json({ error: 'Could not create partner' });
    } finally {
      client?.release();
    }
  }
);

// Update partner
router.patch(
  '/admin/partners/:id',
  requireAuth,
  requireRoles(...managerRoles),
  async (req, res) => {
    const parsed = updateSchema.safeParse(req.body);

    if (!parsed.success || Object.keys(parsed.data || {}).length === 0) {
      return res.status(400).json({ error: 'Invalid partner update' });
    }

    if (!pool) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const entries = Object.entries(parsed.data);
    const values: unknown[] = [req.params.id];

    const assignments = entries.map(([key, value]) => {
      values.push(
        key === 'otherLinks' ? JSON.stringify(value) : value
      );
      const column = fieldMap[key];
      const placeholder = `$${values.length}`;
      return key === 'otherLinks'
        ? `${column} = ${placeholder}::jsonb`
        : `${column} = ${placeholder}`;
    });

    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN');
      const result = await client.query(`
        UPDATE public.collaboration_partners
        SET ${assignments.join(', ')}, updated_at = now()
        WHERE id = $1
        RETURNING ${selectFields}
      `, values);

      if (!result.rowCount) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Partner not found' });
      }

      const partner = result.rows[0];

      await client.query(`
        INSERT INTO public.collaboration_partner_audit
          (partner_id, actor_user_id, action, details)
        VALUES ($1, $2, 'UPDATE', $3::jsonb)
      `, [
        partner.id,
        req.auth!.userId,
        JSON.stringify({ changedFields: entries.map(([key]) => key) })
      ]);

      await client.query('COMMIT');
      res.json({ data: partner });
    } catch (error: any) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      if (error?.code === '23505') {
        return res.status(409).json({
          error: 'A partner with this slug already exists'
        });
      }

      console.error('Update partner failed:', error);
      res.status(500).json({ error: 'Could not update partner' });
    } finally {
      client?.release();
    }
  }
);

// Delete partner
router.delete(
  '/admin/partners/:id',
  requireAuth,
  requireRoles('SUPER_ADMIN', 'ADMIN'),
  async (req, res) => {
    if (!pool) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN');
      const result = await client.query(`
        DELETE FROM public.collaboration_partners
        WHERE id = $1
        RETURNING id, name
      `, [req.params.id]);

      if (!result.rowCount) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Partner not found' });
      }

      await client.query(`
        INSERT INTO public.collaboration_partner_audit
          (partner_id, actor_user_id, action, details)
        VALUES ($1, $2, 'DELETE', $3::jsonb)
      `, [
        result.rows[0].id,
        req.auth!.userId,
        JSON.stringify({ name: result.rows[0].name })
      ]);

      await client.query('COMMIT');
      res.json({ ok: true });
    } catch (error) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      console.error('Delete partner failed:', error);
      res.status(500).json({ error: 'Could not delete partner' });
    } finally {
      client?.release();
    }
  }
);

export default router;
