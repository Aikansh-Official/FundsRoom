import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env.js';
import { query } from '../database/pool.js';
import { HttpError } from '../utils/http-error.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const result = await query<{
    id: string; name: string; email: string; password_hash: string; role: 'ADMIN' | 'SALES' | 'WAREHOUSE' | 'ACCOUNTS';
  }>('SELECT id, name, email, password_hash, role FROM users WHERE LOWER(email) = LOWER($1)', [email]);

  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new HttpError(401, 'Invalid email or password.');
  }

  const payload = { id: user.id, name: user.name, email: user.email, role: user.role };
  const token = jwt.sign(payload, env.jwtSecret, { expiresIn: '12h' });
  return res.json({ token, user: payload });
});
