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

  try {
    const parsed = schema.safeParse({
      email: process.env.SUPER_ADMIN_EMAIL,
      password: process.env.SUPER_ADMIN_PASSWORD,
      displayName: process.env.SUPER_ADMIN_NAME || 'Tanvir Ahmed'
    });

    if (!parsed.success) {
      throw new Error(
        'Invalid configuration. Check SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD.'
      );
    }

    const { email, password, displayName } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Check whether this email already exists
    const emailCheck = await pool.query(
      'SELECT id FROM users WHERE email = $1 LIMIT 1',
      [normalizedEmail]
    );

    if (emailCheck.rowCount) {
      throw new Error('This email already exists in the users table.');
    }

    // Check whether a Super Admin already exists
    const adminCheck = await pool.query(
      "SELECT id FROM users WHERE role = 'SUPER_ADMIN' LIMIT 1"
    );

    if (adminCheck.rowCount) {
      throw new Error('A Super Admin already exists. Bootstrap stopped.');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Insert account with both name columns
    await pool.query(
      `INSERT INTO public.users
        (email, password_hash, name, display_name, role, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        normalizedEmail,
        passwordHash,
        displayName,
        displayName,
        'SUPER_ADMIN',
        'ACTIVE'
      ]
    );

    console.log('SUCCESS: Super Admin account created.');
    console.log('Email:', normalizedEmail);
    console.log('Name:', displayName);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('SUPER ADMIN CREATION FAILED:');
  console.error(error.message || error);
  process.exitCode = 1;
});
