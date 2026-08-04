const express = require('express');
const db = require('./db');
const { optionalAuth } = require('./middleware');

const router = express.Router();

router.post('/rfq', optionalAuth, (req, res) => {
  const { item, quantity, ship_to, company, contact, specs } = req.body || {};
  if (!item || !quantity || !contact) {
    return res.status(400).json({ error: 'item, quantity, and contact are required.' });
  }

  db.prepare(
    'INSERT INTO rfq_requests (user_id, item, quantity, ship_to, company, contact, specs) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(req.userId || null, item, quantity, ship_to || '', company || '', contact, specs || '');

  res.json({ ok: true, message: 'RFQ submitted. A trade specialist will follow up within 1-2 business days.' });
});

router.post('/hunter', optionalAuth, (req, res) => {
  const { item, brand, budget, contact, details } = req.body || {};
  if (!item || !contact) {
    return res.status(400).json({ error: 'item and contact are required.' });
  }

  db.prepare(
    'INSERT INTO hunter_requests (user_id, item, brand, budget, contact, details) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.userId || null, item, brand || '', budget || '', contact, details || '');

  res.json({ ok: true, message: 'HUNTER is on it. We will reach out once a match is found.' });
});

module.exports = router;
