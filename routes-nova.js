const express = require('express');
const db = require('./db');
const { optionalAuth } = require('./middleware');

const router = express.Router();

// ---------- keyword-routed fallback (works with zero setup, no API key) ----------

function keywordReply(message, userOrders) {
  const m = message.toLowerCase();

  if (/track|where.*order|status|arriv|deliver|ship(?!ping cost)/.test(m)) {
    if (!userOrders) {
      return "I can pull up tracking once you're logged in — log in or create an account, then ask me again and I'll show your real order status.";
    }
    if (userOrders.length === 0) {
      return "I don't see any orders on your account yet. Once you place one, ask me again and I'll show you exactly where it stands.";
    }
    const latest = userOrders[0];
    const itemsList = latest.items.map((i) => i.product_name).join(', ');
    return `Your most recent order (#${latest.id}, placed ${new Date(latest.created_at).toLocaleDateString()}) includes: ${itemsList}. Status: ${latest.status}. Total: $${latest.subtotal.toFixed(2)}, with $${latest.cashback.toFixed(2)} cashback credited to your wallet.`;
  }

  if (/return|refund|exchange|send.*back/.test(m)) {
    return "Returns are accepted within 30 days of delivery for most items. To start one, tell me the order number and which item, and I'll flag it — or use the Orders section of your account once that's wired up. Refunds post to your original payment method within 5-7 business days of us receiving the item.";
  }

  if (/cashback|wallet|reward/.test(m)) {
    if (userOrders) {
      const totalCashback = userOrders.reduce((sum, o) => sum + o.cashback, 0);
      return `Across your orders so far, you've earned $${totalCashback.toFixed(2)} in cashback. It's credited automatically at checkout — no codes needed.`;
    }
    return "Cashback is calculated automatically on every order (currently 7% of subtotal) and lands in your wallet at checkout. Log in and ask me again to see your real running total.";
  }

  if (/shipping cost|how much.*ship|delivery cost|duty|duties|tariff|customs/.test(m)) {
    return "Shipping cost and any duties depend on which country storefront you're shopping from — check the Country Concierge (the 🌐 icon next to the country picker) for country-specific details before you check out.";
  }

  if (/cancel/.test(m)) {
    return "If your order hasn't shipped yet, tell me the order number and I'll flag it for cancellation. Once it's shipped, it becomes a return instead — same 30-day window applies.";
  }

  if (/hi|hello|hey|^\s*$/.test(m)) {
    return "Hi, I'm NOVA — Mexieon's support assistant. I can help with order tracking, returns, refunds, cashback, and shipping questions. What's going on?";
  }

  if (/human|agent|person|representative/.test(m)) {
    return "I can handle most order, return, and cashback questions directly. If this needs a real person, email commerce@mexieon.com and a manager will follow up — for now, tell me more about what's going on and I'll try to help.";
  }

  return "I can help with order tracking, returns, refunds, cashback, and shipping questions. Could you tell me a bit more about what you need — or include your order number if this is about a specific purchase?";
}

// ---------- optional real model upgrade ----------

async function getAIReply(message, history, userOrders) {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  try {
    const orderContext = userOrders
      ? `The customer's real orders: ${JSON.stringify(userOrders.slice(0, 5))}`
      : 'The customer is not logged in, so no real order data is available — do not invent order details.';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 300,
        messages: [
          ...history.slice(-6).map((h) => ({ role: h.role, content: h.content })),
          {
            role: 'user',
            content: `You are NOVA, Mexieon's customer support assistant. Be concise and helpful, 2-4 sentences. ${orderContext}\n\nCustomer message: "${message}"`
          }
        ]
      })
    });
    const data = await response.json();
    const text = data?.content?.find((b) => b.type === 'text')?.text;
    return text || null;
  } catch (err) {
    console.error('NOVA AI call failed:', err.message);
    return null;
  }
}

router.post('/chat', optionalAuth, async (req, res) => {
  const { message, history } = req.body || {};
  if (!message) return res.status(400).json({ error: 'message is required.' });

  let userOrders = null;
  if (req.userId) {
    const orders = db.prepare(
      'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 10'
    ).all(req.userId);
    const itemStmt = db.prepare('SELECT product_name, price, emoji, quantity FROM order_items WHERE order_id = ?');
    userOrders = orders.map((o) => ({ ...o, items: itemStmt.all(o.id) }));
  }

  const aiReply = await getAIReply(message, history || [], userOrders);
  const reply = aiReply || keywordReply(message, userOrders);

  res.json({ reply, source: aiReply ? 'ai' : 'keyword', loggedIn: !!req.userId });
});

module.exports = router;
