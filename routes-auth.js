const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');
const { JWT_SECRET, requireAuth } = require('./middleware');

const router = express.Router();

router.post('/signup', (req, res) => {
  const { name, email, password, country } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO users (name, email, password_hash, country) VALUES (?, ?, ?, ?)'
  ).run(name, email.toLowerCase(), hash, country || 'United States');

  const userId = result.lastInsertRowid;
  const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });

  res.json({
    token,
    user: { id: userId, name, email: email.toLowerCase(), country: country || 'United States', wallet_balance: 0 }
  });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, country: user.country, wallet_balance: user.wallet_balance }
  });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, name, email, country, wallet_balance FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json({ user });
});

router.patch('/me/country', requireAuth, (req, res) => {
  const { country } = req.body || {};
  if (!country) return res.status(400).json({ error: 'Country is required.' });
  db.prepare('UPDATE users SET country = ? WHERE id = ?').run(country, req.userId);
  res.json({ ok: true, country });
});

module.exports = router;
