import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool } from '../db.js';
import { signToken, requireAuth, type AuthRequest } from '../auth.js';

const router = Router();
const loginSchema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(200) });

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a valid email and password' });
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const email = parsed.data.email.toLowerCase().trim();
    const result = await pool.query(
      'SELECT id, email, display_name, password_hash, role, status FROM users WHERE email=$1',
      [email]
    );
    const user = result.rows[0];
    if (!user || user.status !== 'ACTIVE' || !(await bcrypt.compare(parsed.data.password, user.password_hash))) {
      return res.status(401).json({ error: 'Incorrect email or password' });
    }
    const token = signToken({ userId: user.id, role: user.role, email: user.email });
    res.json({ token, user: { id: user.id, email: user.email, displayName: user.display_name, role: user.role } });
  } catch (error) {
    console.error('login error', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me',requireAuth,async(req:AuthRequest,res)=>{if(!pool)return res.status(503).json({error:'Database not configured'});const r=await pool.query('SELECT id,email,display_name AS "displayName",role,status FROM users WHERE id=$1',[req.auth!.userId]);res.json({user:r.rows[0]});});

export default router;
