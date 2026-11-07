
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool } from '../db.js';
import { signToken, requireAuth, type AuthRequest } from '../auth.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200)
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Enter a valid email and password'
    });
  }

  if (!pool) {
    return res.status(503).json({
      error: 'Database not configured'
    });
  }

  try {
    const email = parsed.data.email.toLowerCase().trim();

    const result = await pool.query(
      `SELECT
        id,
        email,
        display_name,
        password_hash,
        role,
        status
       FROM public.users
       WHERE email = $1
       LIMIT 1`,
      [email]
    );

    const user = result.rows[0];

    if (!user || user.status !== 'ACTIVE' || !user.password_hash) {
      return res.status(401).json({
        error: 'Incorrect email or password'
      });
    }

    const passwordMatches = await bcrypt.compare(
      parsed.data.password,
      user.password_hash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        error: 'Incorrect email or password'
      });
    }

    const token = signToken({
      userId: user.id,
      role: user.role,
      email: user.email
    });

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);

    return res.status(500).json({
      error: 'Login failed'
    });
  }
});

router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  if (!pool) {
    return res.status(503).json({
      error: 'Database not configured'
    });
  }

  try {
    const result = await pool.query(
      `SELECT
        id,
        email,
        display_name AS "displayName",
        role,
        status,
        created_at AS "createdAt"
       FROM public.users
       WHERE id = $1
       LIMIT 1`,
      [req.auth!.userId]
    );

    if (!result.rowCount) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    const user = result.rows[0];

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({
        error: 'This account is not active'
      });
    }

    return res.json({ user });
  } catch (error) {
    console.error('Account lookup error:', error);

    return res.status(500).json({
      error: 'Could not load account'
    });
  }
});

export default router;
