
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool } from '../db.js';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(12).max(200),
  displayName: z.string().min(2).max(80)
});

async function main() {
  if (!pool) {
    throw new Error('DATABASE_URL is required');
  }

  const parsed = schema.safeParse({
    email: process.env.SUPER_ADMIN_EMAIL,
    password: process.env.SUPER_ADMIN_PASSWORD,
    displayName: process.env.SUPER_ADMIN_NAME || 'Tanvir Ahmed'
  });

  if (!parsed.success) {
    throw new Error(
      'Set SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD (minimum 12 characters).'
    );
  }

  const { email, password, displayName } = parsed.data;

  const existing = await pool.query(
    'SELECT id FROM users WHERE role = $1 LIMIT 1',
    ['SUPER_ADMIN']
  );

  if (existing.rowCount) {
    throw new Error(
      'A Super Admin already exists. Refusing to create another account.'
    );
  }

  const hash = await bcrypt.hash(password, 12);

  await pool.query(
    `INSERT INTO users
      (email, password_hash, name, display_name, role, status)
     VALUES ($1, $2, $3, $3, 'SUPER_ADMIN', 'ACTIVE')`,
    [email.toLowerCase().trim(), hash, displayName]
  );

  console.log('Super Admin created successfully!');
  await pool.end();
}

main().catch(async (error) => {
  console.error(error.message || error);
  if (pool) await pool.end();
  process.exit(1);
});
