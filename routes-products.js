const express = require('express');
const db = require('./db');

const router = express.Router();

// GET /api/products?category=Beverages&search=tequila&sort=price-asc
router.get('/', (req, res) => {
  const { category, search, sort } = req.query;

  let sql = 'SELECT * FROM products WHERE 1=1';
  const params = [];

  if (category && category !== 'all') {
    sql += ' AND category = ?';
    params.push(category);
  }

  if (search) {
    sql += ' AND (name LIKE ? OR category LIKE ? OR vendor LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  const sortMap = {
    'price-asc': 'price ASC',
    'price-desc': 'price DESC',
    'rating': 'rating DESC',
    'cashback': 'price DESC', // cashback is a flat % of price, so this is equivalent
  };
  sql += ' ORDER BY ' + (sortMap[sort] || 'id ASC');

  const products = db.prepare(sql).all(...params);
  res.json({ products });
});

// GET /api/products/categories - distinct list of departments
router.get('/categories', (req, res) => {
  const rows = db.prepare('SELECT DISTINCT category FROM products ORDER BY category ASC').all();
  res.json({ categories: rows.map((r) => r.category) });
});

router.get('/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  res.json({ product });
});

module.exports = router;
