// Mexieon agent proxy — Cloudflare Worker (free, no-sleep, 24/7)
// Implements GET /api/status and POST /api/agent backed by Google Gemini.
// Deploy:  wrangler deploy
// Secret:  wrangler secret put GEMINI_API_KEY

const GEMINI_MODEL = 'gemini-3.6-flash';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Session-Id',
    };
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const path = (url.pathname || '/').replace(/\/+$/, '') || '/';

    // GET /api/status — health + key state (dashboard gates on `keys.anthropic`)
    if (path === '/api/status' || path === '/status') {
      const hasKey = !!env.GEMINI_API_KEY;
      return json({
        ok: true,
        service: 'mexieon-agent-proxy',
        model: hasKey ? GEMINI_MODEL : null,
        provider: 'gemini',
        keys: {
          anthropic: hasKey, // live-gate flag used by the dashboard
          gemini: hasKey,
          shopify: false,
          sendgrid: false,
          coinbase: false,
          openexchange: false,
          langfuse: false,
          twilio: false,
          polygon: false
        },
        recentEvents: []
      }, cors);
    }

    // POST /api/agent — { agent, system, user } -> { reply }
    if (path === '/api/agent' || path === '/agent') {
      const key = env.GEMINI_API_KEY;
      if (!key) return json({ error: 'No model key configured on server.' }, cors, 503);

      let body;
      try { body = await request.json(); } catch { return json({ error: 'Invalid JSON body.' }, cors, 400); }
      const { agent, system, user } = body || {};
      if (!user) return json({ error: 'user prompt is required' }, cors, 400);

      const payload = {
        contents: [{ role: 'user', parts: [{ text: String(user) }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2000 }
      };
      if (system) payload.systemInstruction = { parts: [{ text: String(system) }] };

      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await r.json().catch(() => ({}));
        const parts = (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
        const reply = parts.map((p) => (typeof p.text === 'string' ? p.text : '')).join('').trim();
        if (!reply) {
          const msg = (data && data.error && data.error.message) || `Empty model response (HTTP ${r.status})`;
          return json({ error: msg }, cors, 502);
        }
        return json({ reply, agent: agent || 'AGENT', model: GEMINI_MODEL, provider: 'gemini' }, cors);
      } catch (e) {
        return json({ error: e.message }, cors, 502);
      }
    }

    return json({ error: 'Not found' }, cors, 404);
  }
};

function json(obj, headers, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
  });
}
