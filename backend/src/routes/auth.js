import express from 'express';
import bcrypt from 'bcryptjs';
import { findUserByEmail, findUserById } from '../db/index.js';
import { generateToken, authMiddleware, roleGuard } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';

const router = express.Router();

router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const user = findUserByEmail(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = generateToken(user.id, user.email, user.role);
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    },
  });
});

router.post('/register', authMiddleware, roleGuard(['admin']), (req, res) => {
  const { email, password, name, role } = req.body;

  if (!email || !password || !name || !role) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  if (!['agent', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  if (findUserByEmail(email)) {
    return res.status(409).json({ error: 'Email already exists' });
  }

  const userId = uuidv4();
  const hash = bcrypt.hashSync(password, 10);
  const now = Math.floor(Date.now() / 1000);

  db.prepare(`
    INSERT INTO users (id, email, password_hash, role, name, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, email, hash, role, name, now);

  const user = findUserById(userId);
  const token = generateToken(user.id, user.email, user.role);

  res.status(201).json({
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    },
  });
});

export default router;
