const express = require('express');
const db = require('./db');
const { requireAuth } = require('./middleware');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const items = db.prepare('SELECT * FROM cart_items WHERE user_id = ? ORDER BY created_at ASC').all(req.userId);
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const cashback = subtotal * 0.07;
  res.json({ items, subtotal, cashback });
});

router.post('/add', requireAuth, (req, res) => {
  const { product_name, price, emoji, quantity } = req.body || {};
  if (!product_name || price == null) {
    return res.status(400).json({ error: 'product_name and price are required.' });
  }

  // If the same item is already in the cart, bump quantity instead of duplicating.
  const existing = db.prepare(
    'SELECT * FROM cart_items WHERE user_id = ? AND product_name = ?'
  ).get(req.userId, product_name);

  if (existing) {
    db.prepare('UPDATE cart_items SET quantity = quantity + ? WHERE id = ?')
      .run(quantity || 1, existing.id);
  } else {
    db.prepare(
      'INSERT INTO cart_items (user_id, product_name, price, emoji, quantity) VALUES (?, ?, ?, ?, ?)'
    ).run(req.userId, product_name, price, emoji || '', quantity || 1);
  }

  const items = db.prepare('SELECT * FROM cart_items WHERE user_id = ? ORDER BY created_at ASC').all(req.userId);
  res.json({ items });
});

router.delete('/:itemId', requireAuth, (req, res) => {
  db.prepare('DELETE FROM cart_items WHERE id = ? AND user_id = ?').run(req.params.itemId, req.userId);
  const items = db.prepare('SELECT * FROM cart_items WHERE user_id = ? ORDER BY created_at ASC').all(req.userId);
  res.json({ items });
});

router.post('/checkout', requireAuth, (req, res) => {
  const items = db.prepare('SELECT * FROM cart_items WHERE user_id = ?').all(req.userId);
  if (items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty.' });
  }

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const cashback = subtotal * 0.07;

  const orderResult = db.prepare('INSERT INTO orders (user_id, subtotal, cashback) VALUES (?, ?, ?)')
    .run(req.userId, subtotal, cashback);
  const orderId = orderResult.lastInsertRowid;

  const insertItem = db.prepare(
    'INSERT INTO order_items (order_id, product_name, price, emoji, quantity) VALUES (?, ?, ?, ?, ?)'
  );
  for (const item of items) {
    insertItem.run(orderId, item.product_name, item.price, item.emoji, item.quantity);
  }

  db.prepare('UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?')
    .run(cashback, req.userId);
  db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(req.userId);

  res.json({ ok: true, orderId, subtotal, cashback });
});

router.get('/orders', requireAuth, (req, res) => {
  const orders = db.prepare(
    'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC'
  ).all(req.userId);
  const itemStmt = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
  const withItems = orders.map((o) => ({ ...o, items: itemStmt.all(o.id) }));
  res.json({ orders: withItems });
});

module.exports = router;
