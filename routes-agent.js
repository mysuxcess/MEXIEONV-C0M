const express = require('express');
const router = express.Router();

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const model = () => process.env.GEMINI_MODEL || 'gemini-3.6-flash';

// GET /api/status — health + key state.
// The V9/V11 dashboard gates on `keys.anthropic`; we set it true whenever ANY
// live model key is configured so the UI flips from SIMULATOR to SERVER LIVE.
router.get('/status', (req, res) => {
  const gemini = !!process.env.GEMINI_API_KEY;
  const anthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasLLM = gemini || anthropic;
  res.json({
    ok: true,
    service: 'mexieon-backend',
    model: hasLLM ? model() : null,
    provider: gemini ? 'gemini' : (anthropic ? 'anthropic' : null),
    keys: {
      anthropic: hasLLM, // live-gate flag used by the dashboard
      gemini,
      shopify: false,
      sendgrid: false,
      coinbase: false,
      openexchange: false,
      langfuse: false,
      twilio: false,
      polygon: false
    },
    recentEvents: []
  });
});

// POST /api/agent — { agent, system, user } -> { reply }
router.post('/agent', async (req, res) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return res.status(503).json({ error: 'No model key configured on server (.env).' });
  }
  const { agent, system, user } = req.body || {};
  if (!user) return res.status(400).json({ error: 'user prompt is required' });

  const body = {
    contents: [{ role: 'user', parts: [{ text: String(user) }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 2000 }
  };
  if (system) body.systemInstruction = { parts: [{ text: String(system) }] };

  try {
    const resp = await fetch(`${GEMINI_URL}/${model()}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await resp.json().catch(() => ({}));
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const reply = parts.map((p) => (typeof p.text === 'string' ? p.text : '')).join('').trim();
    if (!reply) {
      const errMsg = data?.error?.message || `Model returned empty response (HTTP ${resp.status})`;
      console.error('[agent] Gemini error:', errMsg);
      return res.status(502).json({ error: errMsg });
    }
    res.json({ reply, agent: agent || 'AGENT', model: model(), provider: 'gemini' });
  } catch (err) {
    console.error('[agent] call failed:', err.message);
    res.status(502).json({ error: err.message });
  }
});

module.exports = router;
