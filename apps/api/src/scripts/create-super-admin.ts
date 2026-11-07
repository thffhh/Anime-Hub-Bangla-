import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool } from '../db.js';

const schema = z.object({ email: z.string().email(), password: z.string().min(12).max(200), displayName: z.string().min(2).max(80) });
async function main() {
  if (!pool) throw new Error('DATABASE_URL is required');
  const parsed = schema.safeParse({
    email: process.env.SUPER_ADMIN_EMAIL,
    password: process.env.SUPER_ADMIN_PASSWORD,
    displayName: process.env.SUPER_ADMIN_NAME || 'Super Admin'
  });
  if (!parsed.success) throw new Error('Set SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD (at least 12 chars), and optional SUPER_ADMIN_NAME in apps/api/.env');
  const { email, password, displayName } = parsed.data;
  const existing = await pool.query('SELECT id FROM users WHERE role=$1 LIMIT 1', ['SUPER_ADMIN']);
  if (existing.rowCount) throw new Error('A Super Admin already exists. Refusing to create another bootstrap account.');
  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO users (email,password_hash,display_name,role,status) VALUES ($1,$2,$3,'SUPER_ADMIN','ACTIVE')`,
    [email.toLowerCase(),hash,displayName]
  );
  console.log('Super Admin created. Remove SUPER_ADMIN_PASSWORD from the environment after bootstrap.');
  await pool.end();
}
main().catch(error => { console.error(error.message || error); process.exit(1); });
