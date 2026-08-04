const express = require('express');
const db = require('./db');

const router = express.Router();

// Manager-facing view of every order placed on the storefront, with the
// customer and line items joined in. No auth gate here yet — this mirrors
// the rest of the manager dashboard's current security model (none), so
// treat this endpoint as internal/trusted-network-only until the v12
// dashboard has real manager auth wired to this backend.
router.get('/orders', (req, res) => {
  const orders = db.prepare(`
    SELECT o.id, o.subtotal, o.cashback, o.status, o.created_at,
           u.id as user_id, u.name as customer_name, u.email as customer_email, u.country as customer_country
    FROM orders o
    JOIN users u ON u.id = o.user_id
    ORDER BY o.created_at DESC
  `).all();

  const itemStmt = db.prepare('SELECT product_name, price, emoji, quantity FROM order_items WHERE order_id = ?');
  const withItems = orders.map((o) => ({ ...o, items: itemStmt.all(o.id) }));

  res.json({ orders: withItems });
});

router.get('/orders/summary', (req, res) => {
  const row = db.prepare(`
    SELECT COUNT(*) as order_count, COALESCE(SUM(subtotal),0) as total_revenue, COALESCE(SUM(cashback),0) as total_cashback
    FROM orders
  `).get();
  res.json(row);
});

module.exports = router;
