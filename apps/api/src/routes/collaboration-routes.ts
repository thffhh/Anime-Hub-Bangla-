
import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import {
  requireAuth,
  requireRoles,
  type AuthRequest
} from '../auth.js';
import { randomUUID } from 'node:crypto';

const router = Router();

const managerRoles = [
  'SUPER_ADMIN',
  'ADMIN',
  'COLLABORATION_MANAGER'
] as const;

const studioApplicationSchema = z.object({
  studioName: z.string().trim().min(2).max(120),
  description: z.string().trim().max(5000).optional().nullable(),
  portfolioUrl: z.string().url().optional().nullable(),
  contactEmail: z.string().email().optional().nullable()
});

const projectSchema = z.object({
  title: z.string().trim().min(2).max(180),
  description: z.string().max(10000).optional().nullable(),
  projectType: z.enum([
    'DUBBING',
    'ANIMATION',
    'MUSIC',
    'EDITING',
    'TRANSLATION',
    'OTHER'
  ]).default('DUBBING'),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).default('PRIVATE'),
  studioId: z.string().uuid().optional().nullable(),
  deadline: z.string().datetime().optional().nullable()
});

const applicationSchema = z.object({
  roleApplied: z.string().trim().min(2).max(100),
  message: z.string().max(3000).optional().nullable(),
  portfolioUrl: z.string().url().optional().nullable()
});

const taskSchema = z.object({
  title: z.string().trim().min(2).max(180),
  description: z.string().max(5000).optional().nullable(),
  assignedTo: z.string().uuid().optional().nullable(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  dueAt: z.string().datetime().optional().nullable()
});

function auth(req: any) {
  return (req as AuthRequest).auth!;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

async function canManageProject(projectId: string, userId: string) {
  if (!pool) return false;

  const result = await pool.query(`
    SELECT 1
    FROM public.projects p
    WHERE p.id = $1
      AND (
        p.created_by = $2
        OR EXISTS (
          SELECT 1
          FROM public.project_members pm
          WHERE pm.project_id = p.id
            AND pm.user_id = $2
            AND pm.member_role IN ('OWNER', 'MANAGER')
        )
      )
    LIMIT 1
  `, [projectId, userId]);

  return Boolean(result.rowCount);
}

// ========================================
// PUBLIC STUDIOS
// ========================================

router.get('/studios', async (_req, res) => {
  if (!pool) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    const result = await pool.query(`
      SELECT
        s.id,
        s.name,
        s.slug,
        s.description,
        s.logo_url AS "logoUrl",
        s.website_url AS "websiteUrl",
        s.verified_at AS "verifiedAt",
        s.created_at AS "createdAt",
        COUNT(sm.id)::int AS "memberCount"
      FROM public.studios s
      LEFT JOIN public.studio_members sm
        ON sm.studio_id = s.id
       AND sm.status = 'ACTIVE'
      WHERE s.status = 'APPROVED'
      GROUP BY s.id
      ORDER BY s.verified_at DESC NULLS LAST, s.created_at DESC
      LIMIT 100
    `);

    res.json({ data: result.rows });
  } catch (error) {
    console.error('Studio list failed:', error);
    res.status(500).json({ error: 'Could not load studios' });
  }
});

router.get('/studios/mine', requireAuth, async (req, res) => {
  if (!pool) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    const userId = auth(req).userId;

    const result = await pool.query(`
      SELECT
        s.id,
        s.name,
        s.slug,
        s.description,
        s.logo_url AS "logoUrl",
        s.website_url AS "websiteUrl",
        s.status,
        s.verified_at AS "verifiedAt",
        sm.member_role AS "memberRole"
      FROM public.studios s
      LEFT JOIN public.studio_members sm
        ON sm.studio_id = s.id
       AND sm.user_id = $1
      WHERE s.owner_user_id = $1
         OR sm.user_id = $1
      ORDER BY s.created_at DESC
    `, [userId]);

    res.json({ data: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not load your studios' });
  }
});

router.get('/studios/:slug', async (req, res) => {
  if (!pool) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    const result = await pool.query(`
      SELECT
        s.id,
        s.name,
        s.slug,
        s.description,
        s.logo_url AS "logoUrl",
        s.website_url AS "websiteUrl",
        s.verified_at AS "verifiedAt",
        COUNT(sm.id)::int AS "memberCount"
      FROM public.studios s
      LEFT JOIN public.studio_members sm
        ON sm.studio_id = s.id
       AND sm.status = 'ACTIVE'
      WHERE s.slug = $1
        AND s.status = 'APPROVED'
      GROUP BY s.id
      LIMIT 1
    `, [req.params.slug]);

    if (!result.rowCount) {
      return res.status(404).json({ error: 'Studio not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not load studio' });
  }
});

// ========================================
// STUDIO APPLICATIONS
// ========================================

router.post('/studios/applications', requireAuth, async (req, res) => {
  const parsed = studioApplicationSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid studio application',
      details: parsed.error.flatten()
    });
  }

  if (!pool) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    const userId = auth(req).userId;
    const data = parsed.data;

    const existing = await pool.query(`
      SELECT id
      FROM public.studio_applications
      WHERE user_id = $1
        AND status = 'PENDING'
      LIMIT 1
    `, [userId]);

    if (existing.rowCount) {
      return res.status(409).json({
        error: 'You already have a pending studio application'
      });
    }

    const result = await pool.query(`
      INSERT INTO public.studio_applications (
        user_id,
        studio_name,
        description,
        portfolio_url,
        contact_email
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING
        id,
        studio_name AS "studioName",
        status,
        created_at AS "createdAt"
    `, [
      userId,
      data.studioName,
      data.description ?? null,
      data.portfolioUrl ?? null,
      data.contactEmail ?? null
    ]);

    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not submit studio application' });
  }
});

router.get('/studios/applications/mine', requireAuth, async (req, res) => {
  if (!pool) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    const result = await pool.query(`
      SELECT
        id,
        studio_name AS "studioName",
        description,
        portfolio_url AS "portfolioUrl",
        status,
        reviewed_at AS "reviewedAt",
        created_at AS "createdAt"
      FROM public.studio_applications
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [auth(req).userId]);

    res.json({ data: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not load applications' });
  }
});

router.get(
  '/admin/studio-applications',
  requireAuth,
  requireRoles(...managerRoles),
  async (_req, res) => {
    if (!pool) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    try {
      const result = await pool.query(`
        SELECT
          a.id,
          a.studio_name AS "studioName",
          a.description,
          a.portfolio_url AS "portfolioUrl",
          a.contact_email AS "contactEmail",
          a.status,
          a.created_at AS "createdAt",
          u.id AS "userId",
          u.display_name AS "applicantName",
          u.email AS "applicantEmail"
        FROM public.studio_applications a
        JOIN public.users u ON u.id = a.user_id
        ORDER BY
          CASE WHEN a.status = 'PENDING' THEN 0 ELSE 1 END,
          a.created_at DESC
        LIMIT 300
      `);

      res.json({ data: result.rows });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Could not load studio applications' });
    }
  }
);

router.patch(
  '/admin/studio-applications/:id',
  requireAuth,
  requireRoles(...managerRoles),
  async (req, res) => {
    const parsed = z.object({
      status: z.enum(['APPROVED', 'REJECTED'])
    }).safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Status must be APPROVED or REJECTED' });
    }

    if (!pool) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const application = await client.query(`
        SELECT *
        FROM public.studio_applications
        WHERE id = $1
          AND status = 'PENDING'
        FOR UPDATE
      `, [req.params.id]);

      if (!application.rowCount) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          error: 'Pending application not found'
        });
      }

      const item = application.rows[0];
      const reviewerId = auth(req).userId;

      await client.query(`
        UPDATE public.studio_applications
        SET status = $2,
            reviewed_by = $3,
            reviewed_at = now()
        WHERE id = $1
      `, [item.id, parsed.data.status, reviewerId]);

      let studio = null;

      if (parsed.data.status === 'APPROVED') {
        const baseSlug = slugify(item.studio_name) || 'studio';
        const slug = `${baseSlug}-${randomUUID().slice(0, 8)}`;

        const created = await client.query(`
          INSERT INTO public.studios (
            name,
            slug,
            description,
            owner_user_id,
            status,
            verified_at
          )
          VALUES ($1, $2, $3, $4, 'APPROVED', now())
          RETURNING id, name, slug, status
        `, [
          item.studio_name,
          slug,
          item.description,
          item.user_id
        ]);

        studio = created.rows[0];

        await client.query(`
          INSERT INTO public.studio_members (
            studio_id,
            user_id,
            member_role,
            status
          )
          VALUES ($1, $2, 'OWNER', 'ACTIVE')
          ON CONFLICT (studio_id, user_id)
          DO UPDATE SET member_role = 'OWNER', status = 'ACTIVE'
        `, [studio.id, item.user_id]);
      }

      await client.query(`
        INSERT INTO public.audit_logs (
          actor_user_id,
          action,
          entity_type,
          entity_id,
          metadata
        )
        VALUES ($1, $2, 'STUDIO_APPLICATION', $3, $4::jsonb)
      `, [
        reviewerId,
        `STUDIO_APPLICATION_${parsed.data.status}`,
        item.id,
        JSON.stringify({ studioId: studio?.id ?? null })
      ]);

      await client.query('COMMIT');

      res.json({
        ok: true,
        status: parsed.data.status,
        studio
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(error);
      res.status(500).json({ error: 'Could not review studio application' });
    } finally {
      client.release();
    }
  }
);

// ========================================
// STUDIO TEAM MANAGEMENT
// ========================================

router.post('/studios/:id/members', requireAuth, async (req, res) => {
  const parsed = z.object({
    userId: z.string().uuid(),
    memberRole: z.enum(['ADMIN', 'MANAGER', 'MEMBER', 'VOICE_ACTOR', 'EDITOR', 'ANIMATOR'])
      .default('MEMBER')
  }).safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid studio member data' });
  }

  if (!pool) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    const userId = auth(req).userId;

    const permission = await pool.query(`
      SELECT 1
      FROM public.studios s
      LEFT JOIN public.studio_members sm
        ON sm.studio_id = s.id
       AND sm.user_id = $2
       AND sm.status = 'ACTIVE'
      WHERE s.id = $1
        AND (
          s.owner_user_id = $2
          OR sm.member_role IN ('OWNER', 'ADMIN')
        )
    `, [req.params.id, userId]);

    if (!permission.rowCount) {
      return res.status(403).json({ error: 'Studio owner permission required' });
    }

    const result = await pool.query(`
      INSERT INTO public.studio_members (
        studio_id,
        user_id,
        member_role,
        status
      )
      VALUES ($1, $2, $3, 'ACTIVE')
      ON CONFLICT (studio_id, user_id)
      DO UPDATE SET
        member_role = EXCLUDED.member_role,
        status = 'ACTIVE'
      RETURNING id, studio_id AS "studioId", user_id AS "userId",
        member_role AS "memberRole", status
    `, [req.params.id, parsed.data.userId, parsed.data.memberRole]);

    res.status(201).json({ data: result.rows[0] });
  } catch (error: any) {
    if (error?.code === '23503') {
      return res.status(404).json({ error: 'Studio or user not found' });
    }

    console.error(error);
    res.status(500).json({ error: 'Could not add studio member' });
  }
});

router.delete('/studios/:id/members/:userId', requireAuth, async (req, res) => {
  if (!pool) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    const actorId = auth(req).userId;

    const permission = await pool.query(`
      SELECT 1
      FROM public.studios s
      LEFT JOIN public.studio_members sm
        ON sm.studio_id = s.id
       AND sm.user_id = $2
       AND sm.status = 'ACTIVE'
      WHERE s.id = $1
        AND (
          s.owner_user_id = $2
          OR sm.member_role IN ('OWNER', 'ADMIN')
        )
    `, [req.params.id, actorId]);

    if (!permission.rowCount) {
      return res.status(403).json({ error: 'Studio owner permission required' });
    }

    if (actorId === req.params.userId) {
      return res.status(400).json({
        error: 'You cannot remove yourself using this endpoint'
      });
    }

    const result = await pool.query(`
      DELETE FROM public.studio_members
      WHERE studio_id = $1
        AND user_id = $2
      RETURNING id
    `, [req.params.id, req.params.userId]);

    if (!result.rowCount) {
      return res.status(404).json({ error: 'Studio member not found' });
    }

    res.json({ removed: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not remove studio member' });
  }
});

// ========================================
// PROJECTS
// ========================================

router.get('/projects', async (_req, res) => {
  if (!pool) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    const result = await pool.query(`
      SELECT
        p.id,
        p.title,
        p.description,
        p.project_type AS "projectType",
        p.status,
        p.deadline,
        p.created_at AS "createdAt",
        s.name AS "studioName",
        COUNT(DISTINCT pm.id)::int AS "memberCount"
      FROM public.projects p
      LEFT JOIN public.studios s ON s.id = p.studio_id
      LEFT JOIN public.project_members pm ON pm.project_id = p.id
      WHERE p.visibility = 'PUBLIC'
        AND p.status NOT IN ('CANCELLED', 'ARCHIVED')
      GROUP BY p.id, s.name
      ORDER BY p.created_at DESC
      LIMIT 100
    `);

    res.json({ data: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not load projects' });
  }
});

router.get('/projects/mine', requireAuth, async (req, res) => {
  if (!pool) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    const userId = auth(req).userId;

    const result = await pool.query(`
      SELECT DISTINCT
        p.id,
        p.title,
        p.description,
        p.project_type AS "projectType",
        p.status,
        p.visibility,
        p.deadline,
        p.created_at AS "createdAt",
        p.created_by AS "createdBy",
        pm.member_role AS "memberRole"
      FROM public.projects p
      LEFT JOIN public.project_members pm
        ON pm.project_id = p.id
       AND pm.user_id = $1
      WHERE p.created_by = $1
         OR pm.user_id = $1
      ORDER BY p.created_at DESC
    `, [userId]);

    res.json({ data: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not load your projects' });
  }
});

router.post('/projects', requireAuth, async (req, res) => {
  const parsed = projectSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid project data',
      details: parsed.error.flatten()
    });
  }

  if (!pool) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  const data = parsed.data;
  const userId = auth(req).userId;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (data.studioId) {
      const membership = await client.query(`
        SELECT 1
        FROM public.studios s
        LEFT JOIN public.studio_members sm
          ON sm.studio_id = s.id
         AND sm.user_id = $2
         AND sm.status = 'ACTIVE'
        WHERE s.id = $1
          AND s.status = 'APPROVED'
          AND (
            s.owner_user_id = $2
            OR sm.user_id = $2
          )
      `, [data.studioId, userId]);

      if (!membership.rowCount) {
        await client.query('ROLLBACK');
        return res.status(403).json({
          error: 'You must be an active member of the selected studio'
        });
      }
    }

    const result = await client.query(`
      INSERT INTO public.projects (
        studio_id,
        created_by,
        title,
        description,
        project_type,
        visibility,
        deadline
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING
        id,
        title,
        description,
        project_type AS "projectType",
        status,
        visibility,
        deadline,
        created_at AS "createdAt"
    `, [
      data.studioId ?? null,
      userId,
      data.title,
      data.description ?? null,
      data.projectType,
      data.visibility,
      data.deadline ?? null
    ]);

    await client.query(`
      INSERT INTO public.project_members (
        project_id,
        user_id,
        member_role
      )
      VALUES ($1, $2, 'OWNER')
      ON CONFLICT (project_id, user_id) DO NOTHING
    `, [result.rows[0].id, userId]);

    await client.query('COMMIT');

    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Could not create project' });
  } finally {
    client.release();
  }
});

router.get('/projects/:id', async (req, res) => {
  if (!pool) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    const result = await pool.query(`
      SELECT
        p.id,
        p.title,
        p.description,
        p.project_type AS "projectType",
        p.status,
        p.visibility,
        p.deadline,
        p.created_at AS "createdAt",
        p.created_by AS "createdBy",
        s.name AS "studioName"
      FROM public.projects p
      LEFT JOIN public.studios s ON s.id = p.studio_id
      WHERE p.id = $1
      LIMIT 1
    `, [req.params.id]);

    if (!result.rowCount) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = result.rows[0];

    if (project.visibility !== 'PUBLIC') {
      return res.status(401).json({
        error: 'Sign in and join this private project to view it'
      });
    }

    res.json({ data: project });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not load project' });
  }
});

// ========================================
// PROJECT APPLICATIONS
// ========================================

router.post('/projects/:id/applications', requireAuth, async (req, res) => {
  const parsed = applicationSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid project application',
      details: parsed.error.flatten()
    });
  }

  if (!pool) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    const userId = auth(req).userId;

    const project = await pool.query(`
      SELECT id, visibility, status, created_by
      FROM public.projects
      WHERE id = $1
      LIMIT 1
    `, [req.params.id]);

    if (!project.rowCount) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.rows[0].status === 'CANCELLED' ||
        project.rows[0].status === 'ARCHIVED') {
      return res.status(400).json({ error: 'This project is not accepting applications' });
    }

    if (project.rows[0].created_by === userId) {
      return res.status(400).json({ error: 'Project owner cannot apply to their own project' });
    }

    if (project.rows[0].visibility !== 'PUBLIC') {
      return res.status(403).json({ error: 'This project is private' });
    }

    const result = await pool.query(`
      INSERT INTO public.project_applications (
        project_id,
        user_id,
        role_applied,
        message,
        portfolio_url
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING
        id,
        project_id AS "projectId",
        role_applied AS "roleApplied",
        status,
        created_at AS "createdAt"
    `, [
      req.params.id,
      userId,
      parsed.data.roleApplied,
      parsed.data.message ?? null,
      parsed.data.portfolioUrl ?? null
    ]);

    res.status(201).json({ data: result.rows[0] });
  } catch (error: any) {
    if (error?.code === '23505') {
      return res.status(409).json({
        error: 'You already applied for this role'
      });
    }

    console.error(error);
    res.status(500).json({ error: 'Could not submit project application' });
  }
});

router.get('/projects/:id/applications', requireAuth, async (req, res) => {
  if (!pool) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    const userId = auth(req).userId;

 if (!(await canManageProject(String(req.params.id), userId))) {
      return res.status(403).json({ error: 'Project manager permission required' });
    }

    const result = await pool.query(`
      SELECT
        a.id,
        a.role_applied AS "roleApplied",
        a.message,
        a.portfolio_url AS "portfolioUrl",
        a.status,
        a.created_at AS "createdAt",
        u.id AS "userId",
        u.display_name AS "applicantName",
        u.email AS "applicantEmail"
      FROM public.project_applications a
      JOIN public.users u ON u.id = a.user_id
      WHERE a.project_id = $1
      ORDER BY a.created_at DESC
    `, [req.params.id]);

    res.json({ data: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not load project applications' });
  }
});

router.patch('/projects/applications/:applicationId', requireAuth, async (req, res) => {
  const parsed = z.object({
    status: z.enum(['ACCEPTED', 'REJECTED'])
  }).safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: 'Status must be ACCEPTED or REJECTED' });
  }

  if (!pool) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const application = await client.query(`
      SELECT
        a.id,
        a.project_id,
        a.user_id,
        a.role_applied,
        p.created_by
      FROM public.project_applications a
      JOIN public.projects p ON p.id = a.project_id
      WHERE a.id = $1
        AND a.status = 'PENDING'
      FOR UPDATE OF a
    `, [req.params.applicationId]);

    if (!application.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pending application not found' });
    }

    const item = application.rows[0];
    const userId = auth(req).userId;

    const permission = await client.query(`
      SELECT 1
      FROM public.projects p
      LEFT JOIN public.project_members pm
        ON pm.project_id = p.id
       AND pm.user_id = $2
      WHERE p.id = $1
        AND (
          p.created_by = $2
          OR pm.member_role IN ('OWNER', 'MANAGER')
        )
    `, [item.project_id, userId]);

    if (!permission.rowCount) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Project manager permission required' });
    }

    await client.query(`
      UPDATE public.project_applications
      SET status = $2,
          reviewed_by = $3,
          reviewed_at = now()
      WHERE id = $1
    `, [item.id, parsed.data.status, userId]);

    if (parsed.data.status === 'ACCEPTED') {
      await client.query(`
        INSERT INTO public.project_members (
          project_id,
          user_id,
          member_role
        )
        VALUES ($1, $2, 'MEMBER')
        ON CONFLICT (project_id, user_id) DO NOTHING
      `, [item.project_id, item.user_id]);
    }

    await client.query('COMMIT');

    res.json({
      ok: true,
      status: parsed.data.status
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Could not review application' });
  } finally {
    client.release();
  }
});

// ========================================
// PROJECT TASKS
// ========================================

router.post('/projects/:id/tasks', requireAuth, async (req, res) => {
  const parsed = taskSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid task data',
      details: parsed.error.flatten()
    });
  }

  if (!pool) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    const userId = auth(req).userId;

    if (!(await canManageProject(String(req.params.id), userId))) {
      return res.status(403).json({ error: 'Project manager permission required' });
    }

    const result = await pool.query(`
      INSERT INTO public.project_tasks (
        project_id,
        assigned_to,
        created_by,
        title,
        description,
        priority,
        due_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING
        id,
        project_id AS "projectId",
        assigned_to AS "assignedTo",
        title,
        description,
        status,
        priority,
        due_at AS "dueAt",
        created_at AS "createdAt"
    `, [
      req.params.id,
      parsed.data.assignedTo ?? null,
      userId,
      parsed.data.title,
      parsed.data.description ?? null,
      parsed.data.priority,
      parsed.data.dueAt ?? null
    ]);

    res.status(201).json({ data: result.rows[0] });
  } catch (error: any) {
    if (error?.code === '23503') {
      return res.status(400).json({ error: 'Invalid project or assigned user' });
    }

    console.error(error);
    res.status(500).json({ error: 'Could not create task' });
  }
});

router.get('/projects/:id/tasks', requireAuth, async (req, res) => {
  if (!pool) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    const userId = auth(req).userId;

    const access = await pool.query(`
      SELECT 1
      FROM public.projects p
      LEFT JOIN public.project_members pm
        ON pm.project_id = p.id
       AND pm.user_id = $2
      WHERE p.id = $1
        AND (
          p.visibility = 'PUBLIC'
          OR p.created_by = $2
          OR pm.user_id = $2
        )
    `, [req.params.id, userId]);

    if (!access.rowCount) {
      return res.status(403).json({ error: 'Project access required' });
    }

    const result = await pool.query(`
      SELECT
        id,
        title,
        description,
        status,
        priority,
        assigned_to AS "assignedTo",
        due_at AS "dueAt",
        completed_at AS "completedAt",
        created_at AS "createdAt"
      FROM public.project_tasks
      WHERE project_id = $1
      ORDER BY
        CASE priority
          WHEN 'URGENT' THEN 0
          WHEN 'HIGH' THEN 1
          WHEN 'NORMAL' THEN 2
          ELSE 3
        END,
        due_at ASC NULLS LAST
    `, [req.params.id]);

    res.json({ data: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not load project tasks' });
  }
});

router.patch('/projects/tasks/:taskId', requireAuth, async (req, res) => {
  const parsed = z.object({
    status: z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'BLOCKED']).optional(),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
    title: z.string().trim().min(2).max(180).optional(),
    description: z.string().max(5000).optional().nullable(),
    assignedTo: z.string().uuid().optional().nullable(),
    dueAt: z.string().datetime().optional().nullable()
  }).strict().safeParse(req.body);

  if (!parsed.success || Object.keys(parsed.data || {}).length === 0) {
    return res.status(400).json({ error: 'Invalid task update' });
  }

  if (!pool) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    const userId = auth(req).userId;

    const task = await pool.query(`
      SELECT id, project_id, assigned_to
      FROM public.project_tasks
      WHERE id = $1
    `, [req.params.taskId]);

    if (!task.rowCount) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const item = task.rows[0];
    const manager = await canManageProject(item.project_id, userId);
    const assignee = item.assigned_to === userId;

    if (!manager && !assignee) {
      return res.status(403).json({ error: 'Task update permission required' });
    }

    if (!manager && Object.keys(parsed.data).some(
      key => key !== 'status'
    )) {
      return res.status(403).json({
        error: 'Only project managers can edit task details'
      });
    }

    const data = parsed.data;

    const result = await pool.query(`
      UPDATE public.project_tasks
      SET
        status = COALESCE($2, status),
        priority = COALESCE($3, priority),
        title = COALESCE($4, title),
        description = COALESCE($5, description),
        assigned_to = CASE WHEN $6::boolean THEN $7::uuid ELSE assigned_to END,
        due_at = CASE WHEN $8::boolean THEN $9::timestamptz ELSE due_at END,
        completed_at = CASE
          WHEN $2 = 'DONE' THEN now()
          WHEN $2 IS NOT NULL THEN NULL
          ELSE completed_at
        END,
        updated_at = now()
      WHERE id = $1
      RETURNING
        id,
        title,
        description,
        status,
        priority,
        assigned_to AS "assignedTo",
        due_at AS "dueAt",
        completed_at AS "completedAt"
    `, [
      req.params.taskId,
      data.status ?? null,
      data.priority ?? null,
      data.title ?? null,
      data.description ?? null,
      data.assignedTo !== undefined,
      data.assignedTo ?? null,
      data.dueAt !== undefined,
      data.dueAt ?? null
    ]);

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not update task' });
  }
});

export default router;
