// Mexieon agent proxy — Cloudflare Worker (free, no-sleep, 24/7)
// Routes: /api/status, /api/agent (Gemini), /api/send-email (SendGrid),
//         /api/orchestrate/plan + /api/orchestrate/run (V13 multi-agent, stateless),
//         /api/nova/chat (keyword + Gemini fallback).
// Deploy:  wrangler deploy
// Secret:  wrangler secret put GEMINI_API_KEY

const GEMINI_MODEL = 'gemini-3.6-flash';

// ═══════════════════════════════════════════════════════════════════
// V13 ORCHESTRATION — agent registry + task-graph templates (stateless)
// ═══════════════════════════════════════════════════════════════════
const ORCH_AGENTS = {
  'ARCHITECT':      { entity: 'Mexieon Real Estate',          role: 'Property concept design — architectural vision, floor plans, build cost estimates.' },
  'INTERIOR':       { entity: 'Mexieon Real Estate',          role: 'Interior design and furnishing — room-by-room furnishing plans.' },
  'COMPASS+HUNTER': { entity: 'Mexieon R&D Logistics',        role: 'Supplier vetting and product sourcing.' },
  'FINANCE':        { entity: 'Mexieon Holdings Corporation', role: 'Budget assembly — profit/margin, funds flow, asset ROI.' },
  'LOGISTICS':      { entity: 'Mexieon R&D Logistics',        role: 'Shipping and delivery estimation — routes, inventory, courier intelligence.' },
  'MARKETING':      { entity: 'Mexieon Corporation',          role: 'Marketing and promotional strategy — copy, ads, platform-native content.' },
  'PUBLISHING':     { entity: 'Mexieon Corporation',          role: 'Storefront publishing — listings from procurement, finance, marketing.' },
  'ANALYTICS':      { entity: 'Mexieon Corporation',          role: 'Profitability prediction — margins, SEO, trend intelligence.' }
};

const GRAPH_TEMPLATES = {
  hotel: {
    description: 'Build a property (hotel, resort, villa complex)',
    matchKeywords: ['hotel', 'resort', 'villa', 'build', 'construct', 'property', 'real estate', 'condo', 'lodge'],
    nodes: [
      { key: 'architect',    agent: 'ARCHITECT',      dependsOn: [] },
      { key: 'interior',     agent: 'INTERIOR',       dependsOn: ['architect'] },
      { key: 'procurement',  agent: 'COMPASS+HUNTER', dependsOn: ['interior'] },
      { key: 'finance',      agent: 'FINANCE',        dependsOn: ['architect', 'procurement'] },
      { key: 'logistics',    agent: 'LOGISTICS',      dependsOn: ['architect'] },
      { key: 'marketing',    agent: 'MARKETING',      dependsOn: ['architect', 'interior'] },
      { key: 'publishing',   agent: 'PUBLISHING',     dependsOn: ['procurement', 'finance', 'marketing'] },
      { key: 'analytics',    agent: 'ANALYTICS',      dependsOn: ['procurement', 'finance', 'logistics'] }
    ],
    approvalGateAfter: ['analytics', 'publishing']
  },
  product_launch: {
    description: 'Launch a new product line',
    matchKeywords: ['product', 'launch', 'line', 'brand', 'sku', 'catalog'],
    nodes: [
      { key: 'procurement',  agent: 'COMPASS+HUNTER', dependsOn: [] },
      { key: 'finance',      agent: 'FINANCE',        dependsOn: ['procurement'] },
      { key: 'marketing',    agent: 'MARKETING',      dependsOn: [] },
      { key: 'publishing',   agent: 'PUBLISHING',     dependsOn: ['procurement', 'finance', 'marketing'] },
      { key: 'analytics',    agent: 'ANALYTICS',      dependsOn: ['procurement', 'finance'] }
    ],
    approvalGateAfter: ['analytics', 'publishing']
  }
};

// ── Agent simulations (deterministic mock — faithful to local backend) ──
const runners = {
  ARCHITECT(ctx) {
    const brief = ctx.projectBrief || 'luxury hotel';
    const clean = brief.replace(/^(build|construct|create)\s+(a|an)\s+/i, '').replace(/\b\w/g, c => c.toUpperCase());
    return {
      conceptName: `${clean} Resort & Spa`,
      propertyType: 'Luxury Boutique Hotel',
      roomCount: 120,
      totalSquareFootage: 85000,
      styleTags: ['contemporary-tropical', 'indoor-outdoor', 'sustainable-design', 'local-materials'],
      floorPlanSummary: 'L-shaped 5-story building with central open-air atrium, rooftop infinity pool, 3 F&B venues, spa wing, conference facilities for 200.',
      estimatedBuildCostRange: { low: 18500000, high: 24000000, currency: 'USD' },
      keyDesignConstraints: ['Seismic zone 4 compliance required', 'Coastal setback 50m minimum', 'Hurricane-rated glazing throughout']
    };
  },
  INTERIOR(ctx) {
    const roomCount = ctx.roomCount || 120;
    const style = (ctx.styleTags || ['luxury']).join(', ');
    const plan = [
      { room: 'Guest Rooms (Standard)', items: ['King bed with Portuguese linens', 'Custom teak millwork', '55" OLED TV', 'Minibar', 'Local artisan decor'], estimatedCost: 28500 },
      { room: 'Suites (20)', items: ['Four-poster king bed', 'Separate living area', 'Wet bar', 'Walk-in closet'], estimatedCost: 62000 },
      { room: 'Lobby & Reception', items: ['14ft reception desk in local stone', '6 lounge clusters', 'Statement chandelier', 'Concierge workstations'], estimatedCost: 185000 },
      { room: 'Restaurant (180-seat)', items: ['Commercial kitchen package', '45 tables + 180 chairs', 'Marble-topped bar', 'Wine display room'], estimatedCost: 340000 },
      { room: 'Spa Wing', items: ['6 treatment rooms', 'Hydrotherapy pool', 'Steam room + sauna', 'Relaxation lounge'], estimatedCost: 420000 },
      { room: 'Rooftop Pool & Bar', items: ['Infinity pool tile + coping', '40 sun loungers', 'Pool bar', 'LED mood lighting'], estimatedCost: 275000 },
      { room: 'Conference Center (200-cap)', items: ['Divisible acoustic partitions', '200 chairs', 'Integrated AV', 'Pre-function area'], estimatedCost: 195000 }
    ];
    const total = Math.round(plan.reduce((s, r) => s + r.estimatedCost, 0) * roomCount / 120);
    return {
      furnishingPlan: plan,
      styleAlignment: `Contemporary tropical luxury — natural materials (teak, stone, linen), indoor-outdoor flow consistent with ${style}`,
      totalFurnishingCost: total,
      procurementCategories: ['Hospitality Furniture', 'Lighting & Fixtures', 'Textiles & Linens', 'AV Equipment', 'Commercial Kitchen Equipment', 'Spa Equipment', 'Outdoor & Pool Furniture', 'Art & Decor']
    };
  },
  'COMPASS+HUNTER'(ctx) {
    const cats = ctx.procurementCategories || ['General'];
    const suppliers = [
      { category: 'Hospitality Furniture', vendor: 'Kettal (Spain)', unitCost: 450000, moq: 1, leadTime: '12-16 weeks' },
      { category: 'Lighting & Fixtures', vendor: 'Vibia (Spain)', unitCost: 180000, moq: 1, leadTime: '8-10 weeks' },
      { category: 'Textiles & Linens', vendor: 'Frette (Italy)', unitCost: 95000, moq: 1, leadTime: '6-8 weeks' },
      { category: 'AV Equipment', vendor: 'Samsung Electronics', unitCost: 220000, moq: 1, leadTime: '4-6 weeks' },
      { category: 'Commercial Kitchen Equipment', vendor: 'Rational AG (Germany)', unitCost: 195000, moq: 1, leadTime: '8-12 weeks' },
      { category: 'Spa Equipment', vendor: 'Ghariani (Italy)', unitCost: 280000, moq: 1, leadTime: '10-14 weeks' },
      { category: 'Outdoor & Pool Furniture', vendor: 'Dedon (Germany)', unitCost: 165000, moq: 1, leadTime: '8-12 weeks' },
      { category: 'Art & Decor', vendor: 'Local Artisan Collective', unitCost: 75000, moq: 1, leadTime: '4-12 weeks' }
    ];
    return {
      suppliers: suppliers.filter(s => cats.some(c => s.category.toLowerCase().includes(c.toLowerCase().split('&')[0].trim()))),
      totalSourcingCost: suppliers.reduce((s, x) => s + x.unitCost, 0),
      recommendations: ['Negotiate volume discount on furniture package (target 12-15% off list)', 'Pre-order long-lead items (Kettal, Ghariani) before construction completes']
    };
  },
  FINANCE(ctx) {
    const low = (ctx.estimatedBuildCostRange && ctx.estimatedBuildCostRange.low) || 18000000;
    const high = (ctx.estimatedBuildCostRange && ctx.estimatedBuildCostRange.high) || 24000000;
    const mid = (low + high) / 2;
    const furnishing = ctx.totalFurnishingCost || 1500000;
    const sourcing = ctx.totalSourcingCost || 1660000;
    const total = mid + furnishing + sourcing + (mid * 0.12);
    return {
      totalProjectCost: Math.round(total),
      financingStructure: { equity: Math.round(total * 0.35), debt: Math.round(total * 0.55), reserve: Math.round(total * 0.10) },
      projectedROI: 18.5,
      monthlyOperatingEstimate: 380000,
      breakEvenMonths: 42
    };
  },
  LOGISTICS(ctx) {
    const sqft = ctx.totalSquareFootage || 85000;
    const containers = Math.ceil(sqft / 5000);
    return {
      shippingEstimate: { containers, cost: containers * 8500 + 45000, transitDays: 28 },
      recommendedPorts: ['Miami (bulk break)', 'Veracruz (direct Gulf access)', 'Houston (alternate)'],
      logisticsNotes: ['Containerized furniture and fixtures: 40ft HC containers', 'Climate-controlled handling required for spa equipment', 'Customs broker pre-clearance recommended for European-sourced materials']
    };
  },
  MARKETING(ctx) {
    const name = ctx.conceptName || 'the property';
    return {
      campaignName: `${name} — Opening Collection`,
      tagline: `Where the horizon becomes home. ${name}.`,
      channels: ['Instagram (visual-first launch)', 'Travel + Leisure print/digital', 'Condé Nast Traveler placement', 'Google Hotel Ads', 'Influencer program (12 creators)'],
      targetDemographic: 'Affluent travelers 35-65, $250K+ HHI, international leisure + bleisure',
      estimatedReach: 4500000
    };
  },
  PUBLISHING(ctx) {
    return {
      storefrontTitle: `${ctx.conceptName || 'Luxury Property'} — Pre-Opening Collection`,
      listingSummary: `Experience ${ctx.conceptName || 'unparalleled luxury'}. ${ctx.tagline || ''} Starting from $${Math.round((ctx.totalProjectCost || 25000000) / 120 / 365 * 1.5)}/night.`,
      pricePoints: [
        { tier: 'Standard King', price: 450, includes: 'Breakfast, pool access, WiFi' },
        { tier: 'Junior Suite', price: 750, includes: 'Butler service, lounge access, breakfast' },
        { tier: 'Penthouse Suite', price: 2200, includes: 'Private terrace, chef kitchen, chauffeur' }
      ],
      publishReady: true
    };
  },
  ANALYTICS(ctx) {
    const roi = ctx.projectedROI || 18;
    return {
      profitabilityScore: roi > 15 ? 82 : roi > 10 ? 68 : 45,
      riskFactors: ['Construction cost overrun risk: 15-20% in current materials market', 'Interest rate exposure on debt financing', 'Seasonal occupancy dip months 5-8', 'Supply chain lead times on European FF&E'],
      marketPosition: 'Upper-upscale boutique — positioned between chain luxury (Ritz/Four Seasons) and independent design hotels.',
      recommendation: 'proceed'
    };
  }
};

// Kahn's algorithm — resolve dependency waves
function resolveWaves(nodes) {
  const inDegree = {}, adj = {};
  for (const n of nodes) { inDegree[n.key] = n.dependsOn.length; adj[n.key] = []; }
  for (const n of nodes) for (const d of n.dependsOn) if (adj[d]) adj[d].push(n.key);
  const queue = Object.keys(inDegree).filter(k => inDegree[k] === 0);
  const waves = [];
  while (queue.length) {
    const wave = [...queue].sort();
    waves.push(wave);
    for (const k of wave) queue.shift();
    for (const k of wave) for (const nx of (adj[k] || [])) { inDegree[nx]--; if (inDegree[nx] === 0) queue.push(nx); }
  }
  return waves;
}

function matchTemplate(prompt) {
  const lower = (prompt || '').toLowerCase();
  for (const [key, t] of Object.entries(GRAPH_TEMPLATES)) {
    if (t.matchKeywords.some(kw => lower.includes(kw))) return { key, ...t };
  }
  return { key: 'generic', description: 'General request', nodes: [{ key: 'procurement', agent: 'COMPASS+HUNTER', dependsOn: [] }], approvalGateAfter: ['procurement'] };
}

function planOrchestration(prompt) {
  const tpl = matchTemplate(prompt);
  const waves = resolveWaves(tpl.nodes);
  const nodes = tpl.nodes.map(n => ({
    key: n.key,
    agent: n.agent,
    entity: ORCH_AGENTS[n.agent] ? ORCH_AGENTS[n.agent].entity : 'Unknown',
    role: ORCH_AGENTS[n.agent] ? ORCH_AGENTS[n.agent].role : '',
    dependsOn: n.dependsOn
  }));
  return { title: (prompt || '').slice(0, 200), template: tpl.key, description: tpl.description, waves, nodes, approvalGateAfter: tpl.approvalGateAfter || [] };
}

function runOrchestration(prompt) {
  const tpl = matchTemplate(prompt);
  const waves = resolveWaves(tpl.nodes);
  const ctx = { projectBrief: prompt || '' };
  const results = [];
  for (const wave of waves) {
    for (const key of wave) {
      const node = tpl.nodes.find(n => n.key === key);
      const runner = runners[node.agent];
      if (!runner) { results.push({ node_key: key, agent: node.agent, status: 'failed', error: 'No runner' }); continue; }
      try {
        const output = runner(ctx);
        Object.assign(ctx, output);
        results.push({ node_key: key, agent: node.agent, status: 'completed', output });
      } catch (e) {
        results.push({ node_key: key, agent: node.agent, status: 'failed', error: e.message });
      }
    }
  }
  // ATLAS summary
  const concept = ctx.conceptName || 'Project';
  const totalCost = ctx.totalProjectCost || 0;
  const roi = ctx.projectedROI || 0;
  const score = ctx.profitabilityScore || 0;
  const rooms = ctx.roomCount || 0;
  const summary = {
    projectName: concept,
    summary: `${concept} is a ${rooms}-room luxury property. Total project cost: $${(totalCost / 1000000).toFixed(1)}M with a projected 5-year ROI of ${roi}%.`,
    keyMetrics: {
      totalCost: `$${(totalCost / 1000000).toFixed(1)}M`,
      projectedROI: `${roi}%`,
      profitabilityScore: `${score}/100`,
      furnishingBudget: `$${((ctx.totalFurnishingCost || 0) / 1000000).toFixed(1)}M`
    },
    decision: { recommendation: 'APPROVE', rationale: `Strong projected ROI (${roi}%) with favorable market positioning.` },
    readyForPublishing: ctx.publishReady || false
  };
  return { template: tpl.key, waves, results, summary };
}

// ═══════════════════════════════════════════════════════════════════
// NOVA — keyword fallback (faithful to routes-nova.js)
// ═══════════════════════════════════════════════════════════════════
function keywordReply(message) {
  const m = (message || '').toLowerCase();
  if (/track|where.*order|status|arriv|deliver|ship/.test(m)) return "I can pull up tracking once you're logged in — log in or create an account, then ask me again and I'll show your real order status.";
  if (/return|refund|exchange|send.*back/.test(m)) return "Returns are accepted within 30 days of delivery for most items. Refunds post to your original payment method within 5-7 business days of us receiving the item.";
  if (/cashback|wallet|reward/.test(m)) return "Cashback is calculated automatically on every order (currently 7% of subtotal) and lands in your wallet at checkout.";
  if (/shipping cost|how much.*ship|delivery cost|duty|duties|tariff|customs/.test(m)) return "Shipping cost and any duties depend on which country storefront you're shopping from — check the Country Concierge for country-specific details.";
  if (/cancel/.test(m)) return "If your order hasn't shipped yet, tell me the order number and I'll flag it for cancellation. Once shipped, it becomes a return instead.";
  if (/hi|hello|hey|^\s*$/.test(m)) return "Hi, I'm NOVA — Mexieon's support assistant. I can help with order tracking, returns, refunds, cashback, and shipping questions. What's going on?";
  if (/human|agent|person|representative/.test(m)) return "I can handle most order, return, and cashback questions directly. If this needs a real person, email commerce@mexieon.com.";
  return "I can help with order tracking, returns, refunds, cashback, and shipping questions. Could you tell me a bit more about what you need?";
}

async function novaAIReply(message, env) {
  const key = env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: "You are NOVA, Mexieon's customer support assistant. Be concise and helpful, 2-4 sentences." }] },
        contents: [{ role: 'user', parts: [{ text: String(message) }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 300 }
      })
    });
    const d = await r.json().catch(() => ({}));
    const parts = (d && d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts) || [];
    const text = parts.map(p => (typeof p.text === 'string' ? p.text : '')).join('').trim();
    return text || null;
  } catch { return null; }
}

// ═══════════════════════════════════════════════════════════════════
// ROUTER
// ═══════════════════════════════════════════════════════════════════
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

    // GET /api/status
    if (path === '/api/status' || path === '/status') {
      const hasKey = !!env.GEMINI_API_KEY;
      return json({ ok: true, service: 'mexieon-agent-proxy', model: hasKey ? GEMINI_MODEL : null, provider: 'gemini', keys: { anthropic: hasKey, gemini: hasKey, shopify: false, sendgrid: false, coinbase: false, openexchange: false, langfuse: false, twilio: false, polygon: false }, recentEvents: [] }, cors);
    }

    // POST /api/agent
    if (path === '/api/agent' || path === '/agent') {
      const key = env.GEMINI_API_KEY;
      if (!key) return json({ error: 'No model key configured on server.' }, cors, 503);
      let body;
      try { body = await request.json(); } catch { return json({ error: 'Invalid JSON body.' }, cors, 400); }
      const { agent, system, user, history } = body || {};
      if (!user) return json({ error: 'user prompt is required' }, cors, 400);
      const contents = [];
      if (Array.isArray(history)) {
        for (const h of history) {
          if (h && h.role && h.content) contents.push({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(h.content).slice(0, 4000) }] });
        }
      }
      contents.push({ role: 'user', parts: [{ text: String(user) }] });
      const payload = { contents, generationConfig: { temperature: 0.7, maxOutputTokens: 2000 } };
      if (system) payload.systemInstruction = { parts: [{ text: String(system) }] };
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await r.json().catch(() => ({}));
        const parts = (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
        const reply = parts.map(p => (typeof p.text === 'string' ? p.text : '')).join('').trim();
        if (!reply) { const msg = (data && data.error && data.error.message) || `Empty model response (HTTP ${r.status})`; return json({ error: msg }, cors, 502); }
        return json({ reply, agent: agent || 'AGENT', model: GEMINI_MODEL, provider: 'gemini' }, cors);
      } catch (e) { return json({ error: e.message }, cors, 502); }
    }

    // POST /api/send-email
    if (path === '/api/send-email' || path === '/send-email') {
      let b;
      try { b = await request.json(); } catch { return json({ error: 'Invalid JSON body.' }, cors, 400); }
      const { apiKey, from, to, subject, body } = b || {};
      if (!apiKey) return json({ error: 'Missing SendGrid API key.' }, cors, 400);
      if (!from) return json({ error: 'Missing sender (from) email.' }, cors, 400);
      if (!to) return json({ error: 'Missing recipient email address.' }, cors, 400);
      if (!subject || !body) return json({ error: 'Missing subject or body.' }, cors, 400);
      try {
        const sg = await fetch('https://api.sendgrid.com/v3/mail/send', { method: 'POST', headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ personalizations: [{ to: [{ email: to }] }], from: { email: from }, subject, content: [{ type: 'text/plain', value: body }] }) });
        if (sg.status === 202) return json({ ok: true, message: 'Email accepted by SendGrid for delivery.' }, cors);
        const errText = await sg.text();
        let detail = errText;
        try { detail = (JSON.parse(errText).errors || []).map(e => e.message).join('; ') || errText; } catch {}
        return json({ error: sg.status === 401 ? 'SendGrid rejected the API key. Check the key in the API Vault.' : ('SendGrid rejected the email: ' + (detail || 'Unknown error — the "from" address may not be a verified sender.')) }, cors, sg.status === 401 ? 401 : 502);
      } catch (e) { return json({ error: 'Could not reach SendGrid.' }, cors, 502); }
    }

    // POST /api/orchestrate/plan
    if (path === '/api/orchestrate/plan') {
      let b;
      try { b = await request.json(); } catch { return json({ error: 'Invalid JSON body.' }, cors, 400); }
      const prompt = b && b.prompt;
      if (!prompt) return json({ error: 'prompt is required' }, cors, 400);
      return json(planOrchestration(prompt), cors);
    }

    // POST /api/orchestrate/run (stateless full pipeline)
    if (path === '/api/orchestrate/run' || path === '/api/orchestrate/execute') {
      let b;
      try { b = await request.json(); } catch { return json({ error: 'Invalid JSON body.' }, cors, 400); }
      const prompt = (b && (b.prompt || b.title)) || '';
      if (!prompt) return json({ error: 'prompt is required' }, cors, 400);
      return json(runOrchestration(prompt), cors);
    }

    // POST /api/nova/chat
    if (path === '/api/nova/chat') {
      let b;
      try { b = await request.json(); } catch { b = {}; }
      const message = (b && b.message) || '';
      if (!message) return json({ error: 'message is required.' }, cors, 400);
      const ai = await novaAIReply(message, env);
      return json({ reply: ai || keywordReply(message), source: ai ? 'ai' : 'keyword', loggedIn: false }, cors);
    }

    // KV store — shared per-manager state (memory, teachings, standing orders)
    if (path === '/api/store') {
      if (request.method === 'GET') {
        const key = url.searchParams.get('key');
        if (!key) return json({ error: 'key required' }, cors, 400);
        try {
          const raw = await env.MEXIEON_KV.get(key);
          return json({ key, value: raw ? JSON.parse(raw) : null }, cors);
        } catch (e) { return json({ error: 'KV read failed: ' + e.message }, cors, 500); }
      }
      if (request.method === 'PUT' || request.method === 'POST') {
        let b; try { b = await request.json(); } catch { return json({ error: 'invalid json body' }, cors, 400); }
        const { key, value } = b || {};
        if (!key) return json({ error: 'key required' }, cors, 400);
        try {
          await env.MEXIEON_KV.put(key, JSON.stringify(value));
          return json({ ok: true, key }, cors);
        } catch (e) { return json({ error: 'KV write failed: ' + e.message }, cors, 500); }
      }
      if (request.method === 'DELETE') {
        const key = url.searchParams.get('key');
        if (!key) return json({ error: 'key required' }, cors, 400);
        try { await env.MEXIEON_KV.delete(key); return json({ ok: true, key }, cors); }
        catch (e) { return json({ error: 'KV delete failed: ' + e.message }, cors, 500); }
      }
    }
    return json({ error: 'Not found' }, cors, 404);
  }
};

function json(obj, headers, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}
