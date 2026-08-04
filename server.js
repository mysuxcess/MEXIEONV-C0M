const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes-auth');
const cartRoutes = require('./routes-cart');
const requestRoutes = require('./routes-rfq');
const productRoutes = require('./routes-products');
const conciergeRoutes = require('./routes-concierge');
const outreachRoutes = require('./routes-outreach');
const emailRoutes = require('./routes-email');
const adminOrdersRoutes = require('./routes-admin-orders');
const novaRoutes = require('./routes-nova');
const orchestrateRoutes = require('./routes-orchestrate');

const app = express();
const PORT = process.env.PORT || 4000;

const path = require('path');

app.use(cors());
app.use(express.json());

// Serve Mexieon.com
app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'mexieon-backend' }));

app.use('/api/auth', authRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/products', productRoutes);
app.use('/api/country-agent', conciergeRoutes);
app.use('/api', outreachRoutes); // -> /api/facility, /api/outreach
app.use('/api', emailRoutes); // -> /api/send-email
app.use('/api', adminOrdersRoutes); // -> /api/orders, /api/orders/summary
app.use('/api/nova', novaRoutes); // -> /api/nova/chat
app.use('/api/orchestrate', orchestrateRoutes); // -> V13 orchestration layer
app.use('/api', requestRoutes); // -> /api/rfq, /api/hunter

app.listen(PORT, () => {
  console.log(`Mexieon backend running on http://localhost:${PORT}`);
});
