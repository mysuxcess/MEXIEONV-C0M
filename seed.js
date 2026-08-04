// Run with: node seed.js
// Populates the products table. Safe to re-run — clears existing products first.

const fs = require('fs');
const path = require('path');
const db = require('./db');

const seedPath = path.join(__dirname, 'seed-data.json');
const products = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

db.exec('DELETE FROM products');

const insert = db.prepare(
  'INSERT INTO products (name, price, emoji, category, vendor, rating, reviews, image, fallback_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
);

for (const p of products) {
  insert.run(p.name, p.price, p.emoji, p.category, p.vendor, p.rating, p.reviews, p.image || null, p.fallback_image || null);
}

console.log(`Seeded ${products.length} products into the database.`);
