const express = require('express');
const crypto = require('crypto');
const db = require('./db');
const { agents, graphTemplates } = require('./agents');

const router = express.Router();

// ── Helpers ──

function uuid() { return crypto.randomUUID(); }
function now() { return new Date().toISOString().replace('T', ' ').slice(0, 19); }

// Resolve all dependency ordering for a graph template — Kahn's algorithm.
function resolveExecutionOrder(nodes) {
  const inDegree = {};
  const adj = {};
  for (const n of nodes) {
    inDegree[n.key] = n.dependsOn.length;
    adj[n.key] = [];
  }
  for (const n of nodes) {
    for (const dep of n.dependsOn) {
      if (adj[dep]) adj[dep].push(n.key);
    }
  }
  const queue = Object.keys(inDegree).filter(k => inDegree[k] === 0);
  const order = [];
  // Group parallelizable nodes: same "wave"
  const waves = [];
  while (queue.length > 0) {
    const wave = [...queue].sort();
    waves.push(wave);
    for (const key of wave) queue.shift();
    for (const key of wave) {
      for (const next of (adj[key] || [])) {
        inDegree[next]--;
        if (inDegree[next] === 0) queue.push(next);
      }
    }
  }
  return waves;
}

// Collect all upstream context for a node
function collectContext(projectId, nodeKey, nodes) {
  const node = nodes.find(n => n.key === nodeKey);
  if (!node) return {};
  const ctx = {};
  // Get everything from context_bus that this node depends on
  const rows = db.prepare(
    `SELECT field_name, field_value FROM context_bus WHERE project_id = ? AND node_key IN (${node.dependsOn.map(() => '?').join(',')})`
  ).all(projectId, ...node.dependsOn);
  for (const row of rows) {
    try { ctx[row.field_name] = JSON.parse(row.field_value); }
    catch { ctx[row.field_name] = row.field_value; }
  }
  return ctx;
}

// Write a node's output to the context bus
function publishToContextBus(projectId, nodeKey, output) {
  const stmt = db.prepare('INSERT INTO context_bus (project_id, node_key, field_name, field_value) VALUES (?, ?, ?, ?)');
  for (const [key, value] of Object.entries(output)) {
    stmt.run(projectId, nodeKey, key, typeof value === 'string' ? value : JSON.stringify(value));
  }
}

// ── Agent simulation (mock LLM — produces realistic structured output) ──

function simulateArchitect(ctx) {
  const brief = ctx.projectBrief || 'luxury hotel';
  return {
    conceptName: `${brief.replace(/^(build|construct|create)\s+(a|an)\s+/i, '').replace(/\b\w/g, c => c.toUpperCase())} Resort & Spa`,
    propertyType: 'Luxury Boutique Hotel',
    roomCount: 120,
    totalSquareFootage: 85000,
    styleTags: ['contemporary-tropical', 'indoor-outdoor', 'sustainable-design', 'local-materials'],
    floorPlanSummary: 'L-shaped 5-story building with central open-air atrium, rooftop infinity pool, 3 F&B venues, spa wing, conference facilities for 200. Ground floor: lobby, restaurant, retail. Floors 2-4: guest rooms (40/floor). Floor 5: penthouse suites + rooftop amenities.',
    estimatedBuildCostRange: { low: 18500000, high: 24000000, currency: 'USD' },
    keyDesignConstraints: ['Seismic zone 4 compliance required', 'Coastal setback 50m minimum', 'Local labor availability for specialized finishes', 'Hurricane-rated glazing throughout']
  };
}

function simulateInterior(ctx) {
  const roomCount = ctx.roomCount || 120;
  const style = (ctx.styleTags || ['luxury']).join(', ');
  const plan = [
    { room: 'Guest Rooms (Standard)', items: ['King bed with Portuguese linens', 'Custom teak millwork', '55" OLED TV', 'Minibar', 'Blackout curtains', 'Local artisan decor package'], estimatedCost: 28500 },
    { room: 'Suites (20)', items: ['Four-poster king bed', 'Separate living area with sofa + armchairs', 'Wet bar', 'Double vanity bathroom', 'Walk-in closet', 'Private balcony furniture'], estimatedCost: 62000 },
    { room: 'Lobby & Reception', items: ['14ft custom reception desk in local stone', 'Seating: 6 lounge clusters (sofa + 2 armchairs each)', 'Statement chandelier (local artisan)', 'Concierge workstations (3)', 'Digital signage wall (3x3 LED)', 'Indoor planting: 12 mature tropical specimens'], estimatedCost: 185000 },
    { room: 'Restaurant (180-seat)', items: ['Commercial kitchen equipment package', 'Dining furniture: 45 tables + 180 chairs', 'Bar: 18-stool marble-topped', 'Wine display room (capacity 800 bottles)', 'Acoustic ceiling treatment', 'Outdoor terrace furniture: 12 tables'], estimatedCost: 340000 },
    { room: 'Spa Wing', items: ['6 treatment rooms with hydraulic tables', 'Hydrotherapy pool', 'Steam room + sauna', 'Relaxation lounge (12 chaise lounges)', 'Reception + retail display', 'Staff facilities (locker room, break area)'], estimatedCost: 420000 },
    { room: 'Rooftop Pool & Bar', items: ['Infinity pool tile + coping', 'Pool deck: 40 sun loungers + 12 cabanas', 'Pool bar: 10 stools + backbar equipment', 'LED mood lighting system', 'Sound system (weather-rated)', 'Fire pit lounge: 3 fire pits + seating'], estimatedCost: 275000 },
    { room: 'Conference Center (200-cap)', items: ['Divisible into 3 rooms via acoustic partitions', '200 stacking conference chairs', '20 modular tables', 'Integrated AV: projector, screen, 12-ceiling speaker array', 'Video conferencing suite', 'Pre-function area: 6 cocktail tables + registration desk'], estimatedCost: 195000 }
  ];
  const totalCost = plan.reduce((s, r) => s + r.estimatedCost, 0) * roomCount / 120;
  return {
    furnishingPlan: plan,
    styleAlignment: `Contemporary tropical luxury — clean lines, natural materials (teak, stone, linen), indoor-outdoor flow consistent with ${style}`,
    totalFurnishingCost: Math.round(totalCost),
    procurementCategories: ['Hospitality Furniture', 'Lighting & Fixtures', 'Textiles & Linens', 'AV Equipment', 'Commercial Kitchen Equipment', 'Spa Equipment', 'Outdoor & Pool Furniture', 'Art & Decor']
  };
}

function simulateProcurement(ctx) {
  const categories = ctx.procurementCategories || ['General'];
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
  const total = suppliers.reduce((s, x) => s + x.unitCost, 0);
  return {
    suppliers: suppliers.filter(s => categories.some(c => s.category.toLowerCase().includes(c.toLowerCase().split('&')[0].trim()))),
    totalSourcingCost: total,
    recommendations: ['Negotiate volume discount on furniture package (target 12-15% off list)', 'Local artisan collective: commission 6-month pipeline now to avoid lead-time crunch', 'Samsung: qualify for hospitality bulk pricing tier', 'Pre-order long-lead items (Kettal, Ghariani) before construction completes']
  };
}

function simulateFinance(ctx) {
  const buildLow = (ctx.estimatedBuildCostRange && ctx.estimatedBuildCostRange.low) || 18000000;
  const buildHigh = (ctx.estimatedBuildCostRange && ctx.estimatedBuildCostRange.high) || 24000000;
  const buildMid = (buildLow + buildHigh) / 2;
  const furnishing = ctx.totalFurnishingCost || 1500000;
  const sourcing = ctx.totalSourcingCost || 1660000;
  const total = buildMid + furnishing + sourcing + (buildMid * 0.12); // 12% contingency
  return {
    totalProjectCost: Math.round(total),
    financingStructure: { equity: Math.round(total * 0.35), debt: Math.round(total * 0.55), reserve: Math.round(total * 0.10) },
    projectedROI: 18.5,
    monthlyOperatingEstimate: 380000,
    breakEvenMonths: 42
  };
}

function simulateLogistics(ctx) {
  const sqft = ctx.totalSquareFootage || 85000;
  const containers = Math.ceil(sqft / 5000);
  return {
    shippingEstimate: { containers, cost: containers * 8500 + 45000, transitDays: 28 },
    recommendedPorts: ['Miami (bulk break)', 'Veracruz (direct Gulf access)', 'Houston (alternate)'],
    logisticsNotes: ['Containerized furniture and fixtures: 40ft HC containers', 'Specialized handling required for spa equipment (climate-controlled)', 'Customs broker pre-clearance recommended for European-sourced materials', 'Last-mile: flatbed + crane for large items']
  };
}

function simulateMarketing(ctx) {
  const name = ctx.conceptName || 'the property';
  return {
    campaignName: `${name} — Opening Collection`,
    tagline: `Where the horizon becomes home. ${name}.`,
    channels: ['Instagram (visual-first launch)', 'Travel + Leisure print/ digital', 'Condé Nast Traveler feature placement', 'Google Hotel Ads', 'Direct booking email sequence', 'Influencer familiarization program (12 creators)'],
    targetDemographic: 'Affluent travelers 35-65, $250K+ HHI, international leisure + bleisure',
    estimatedReach: 4500000
  };
}

function simulatePublishing(ctx) {
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
}

function simulateAnalytics(ctx) {
  const cost = ctx.totalProjectCost || 25000000;
  const roi = ctx.projectedROI || 18;
  return {
    profitabilityScore: roi > 15 ? 82 : roi > 10 ? 68 : 45,
    riskFactors: [
      'Construction cost overrun risk: 15-20% in current materials market',
      'Interest rate exposure on debt financing (55% LTV)',
      'Seasonal occupancy dip months 5-8 in target market',
      'Supply chain lead times on European-sourced FF&E'
    ],
    marketPosition: 'Upper-upscale boutique — positioned between chain luxury (Ritz/Four Seasons) and independent design hotels. Gap in market for contemporary tropical luxury without colonial aesthetic.',
    recommendation: 'proceed'
  };
}

// Agent dispatch table
const agentRunners = {
  'ARCHITECT': simulateArchitect,
  'INTERIOR': simulateInterior,
  'COMPASS+HUNTER': simulateProcurement,
  'FINANCE': simulateFinance,
  'LOGISTICS': simulateLogistics,
  'MARKETING': simulateMarketing,
  'PUBLISHING': simulatePublishing,
  'ANALYTICS': simulateAnalytics
};

// ── ATLAS: Generate executive summary from full context bus ──

function generateAtlasSummary(projectId) {
  const rows = db.prepare('SELECT node_key, field_name, field_value FROM context_bus WHERE project_id = ? ORDER BY id').all(projectId);
  const ctx = {};
  for (const row of rows) {
    try { ctx[`${row.node_key}.${row.field_name}`] = JSON.parse(row.field_value); }
    catch { ctx[`${row.node_key}.${row.field_name}`] = row.field_value; }
  }

  const conceptName = ctx['architect.conceptName'] || 'Project';
  const totalCost = ctx['finance.totalProjectCost'] || 0;
  const roi = ctx['finance.projectedROI'] || 0;
  const score = ctx['analytics.profitabilityScore'] || 0;
  const recommendation = ctx['analytics.recommendation'] || 'review';
  const rooms = ctx['architect.roomCount'] || 0;
  const sqft = ctx['architect.totalSquareFootage'] || 0;
  const furnishingCost = ctx['interior.totalFurnishingCost'] || 0;
  const campaignName = ctx['marketing.campaignName'] || '';

  return {
    projectName: conceptName,
    summary: `${conceptName} is a ${rooms}-room luxury property spanning ${sqft.toLocaleString()} sq ft. Total project cost: $${(totalCost / 1000000).toFixed(1)}M with a projected 5-year ROI of ${roi}%.`,
    keyMetrics: {
      totalCost: `$${(totalCost / 1000000).toFixed(1)}M`,
      costPerRoom: `$${Math.round(totalCost / rooms).toLocaleString()}`,
      projectedROI: `${roi}%`,
      breakEven: `${ctx['finance.breakEvenMonths'] || 'N/A'} months`,
      furnishingBudget: `$${(furnishingCost / 1000000).toFixed(1)}M`,
      profitabilityScore: `${score}/100`
    },
    decision: {
      recommendation: recommendation === 'proceed' ? 'APPROVE' : recommendation === 'caution' ? 'REVIEW' : 'REVISE',
      rationale: recommendation === 'proceed'
        ? `Strong projected ROI (${roi}%) with favorable market positioning. Primary risks are construction cost overrun and interest rate exposure — both manageable with the 10% reserve allocation.`
        : 'Requires revision before approval.',
      requiresBoardApproval: totalCost > 20000000
    },
    marketingCampaign: campaignName,
    readyForPublishing: ctx['publishing.publishReady'] || false
  };
}

// ═══════════════════════════════════════════
//  ROUTES
// ═══════════════════════════════════════════

// POST /api/orchestrate/plan
// Turns free-text into a task graph using keyword matching against templates.
router.post('/plan', (req, res) => {
  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  // Match against graph templates
  let matchedTemplate = null;
  const lower = prompt.toLowerCase();
  for (const [key, template] of Object.entries(graphTemplates)) {
    if (template.matchKeywords.some(kw => lower.includes(kw))) {
      matchedTemplate = { key, ...template };
      break;
    }
  }

  // Fallback: generic single-node procurement if nothing matches
  if (!matchedTemplate) {
    matchedTemplate = { key: 'generic', description: 'General request', nodes: [{ key: 'procurement', agent: 'COMPASS+HUNTER', dependsOn: [] }], approvalGateAfter: ['procurement'] };
  }

  const projectId = uuid();
  const title = prompt.slice(0, 200);

  db.prepare('INSERT INTO projects (id, title, status) VALUES (?, ?, ?)').run(projectId, title, 'planned');

  // Insert nodes and edges
  const nodeStmt = db.prepare('INSERT INTO task_nodes (project_id, node_key, agent_name, status) VALUES (?, ?, ?, ?)');
  const edgeStmt = db.prepare('INSERT INTO task_edges (project_id, from_node, to_node) VALUES (?, ?, ?)');

  for (const node of matchedTemplate.nodes) {
    nodeStmt.run(projectId, node.key, node.agent, 'pending');
    for (const dep of node.dependsOn) {
      edgeStmt.run(projectId, dep, node.key);
    }
  }

  // Resolve execution order
  const waves = resolveExecutionOrder(matchedTemplate.nodes);

  // Build node detail list
  const nodeDetails = matchedTemplate.nodes.map(n => {
    const agentDef = agents.find(a => a.agent_name === n.agent);
    return {
      key: n.key,
      agent: n.agent,
      entity: agentDef ? agentDef.entity : 'Unknown',
      role: agentDef ? agentDef.role_desc : '',
      dependsOn: n.dependsOn,
      inputContract: agentDef ? JSON.parse(agentDef.input_contract) : [],
      outputContract: agentDef ? JSON.parse(agentDef.output_contract) : []
    };
  });

  res.json({
    projectId,
    title,
    template: matchedTemplate.key,
    description: matchedTemplate.description,
    waves,
    nodes: nodeDetails,
    approvalGateAfter: matchedTemplate.approvalGateAfter || []
  });
});

// POST /api/orchestrate/execute
// Runs the project graph wave by wave. Call once per wave, or auto-run all.
router.post('/execute', (req, res) => {
  const { projectId, autoRun } = req.body || {};
  if (!projectId) return res.status(400).json({ error: 'projectId is required' });

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  // Get all edges to know dependencies
  const edges = db.prepare('SELECT * FROM task_edges WHERE project_id = ?').all(projectId);
  const nodes = db.prepare('SELECT * FROM task_nodes WHERE project_id = ? ORDER BY id').all(projectId);

  // Figure out which nodes are runnable: all deps completed
  const nodeMap = {};
  for (const n of nodes) nodeMap[n.node_key] = n;

  function depsCompleted(n) {
    const deps = edges.filter(e => e.to_node === n.node_key).map(e => e.from_node);
    return deps.every(d => nodeMap[d] && nodeMap[d].status === 'completed');
  }

  const runnable = nodes.filter(n => n.status === 'pending' && depsCompleted(n));

  if (runnable.length === 0) {
    // Check if everything is done
    const allDone = nodes.every(n => n.status === 'completed');
    if (allDone) {
      // Generate ATLAS summary
      const summary = generateAtlasSummary(projectId);
      db.prepare('UPDATE projects SET status = ?, completed_at = ? WHERE id = ?').run('awaiting_approval', now(), projectId);
      return res.json({ projectId, status: 'awaiting_approval', summary, message: 'All nodes complete. Project ready for approval.' });
    }
    return res.json({ projectId, status: project.status, runnable: [], message: 'No runnable nodes — some dependencies may have failed.' });
  }

  // Execute runnable nodes
  const results = [];
  for (const node of runnable) {
    const runner = agentRunners[node.agent_name];
    if (!runner) {
      db.prepare('UPDATE task_nodes SET status = ?, error_text = ? WHERE id = ?').run('failed', `No runner for agent: ${node.agent_name}`, node.id);
      results.push({ node_key: node.node_key, agent: node.agent_name, status: 'failed', error: `No runner for agent: ${node.agent_name}` });
      continue;
    }

    db.prepare('UPDATE task_nodes SET status = ?, started_at = ? WHERE id = ?').run('running', now(), node.id);

    // Collect context
    const ctx = collectContext(projectId, node.node_key, nodes.map(n => ({ key: n.node_key, dependsOn: edges.filter(e => e.to_node === n.node_key).map(e => e.from_node) })));
    // Add the project prompt as context for the first node
    if (node.node_key === 'architect') ctx.projectBrief = project.title;

    try {
      const output = runner(ctx);
      publishToContextBus(projectId, node.node_key, output);
      db.prepare('UPDATE task_nodes SET status = ?, output_json = ?, completed_at = ? WHERE id = ?')
        .run('completed', JSON.stringify(output), now(), node.id);
      results.push({ node_key: node.node_key, agent: node.agent_name, status: 'completed', output });
    } catch (err) {
      db.prepare('UPDATE task_nodes SET status = ?, error_text = ? WHERE id = ?').run('failed', err.message, node.id);
      results.push({ node_key: node.node_key, agent: node.agent_name, status: 'failed', error: err.message });
    }
  }

  db.prepare('UPDATE projects SET status = ? WHERE id = ?').run('running', projectId);

  // If autoRun, keep going
  if (autoRun) {
    const remaining = db.prepare('SELECT COUNT(*) as c FROM task_nodes WHERE project_id = ? AND status = ?').get(projectId, 'pending');
    if (remaining.c === 0) {
      // All done — generate ATLAS summary
      const allDone = nodes.every(n => n.status === 'completed' || n.node_key === results.find(r => r.node_key === n.node_key)?.node_key);
      const summary = generateAtlasSummary(projectId);
      db.prepare('UPDATE projects SET status = ?, completed_at = ? WHERE id = ?').run('awaiting_approval', now(), projectId);
      return res.json({
        projectId, status: 'awaiting_approval', summary,
        waveCompleted: results, remainingNodes: 0, continue: false,
        message: 'All nodes complete. Project ready for approval.'
      });
    }
    return res.json({
      projectId,
      status: 'running',
      waveCompleted: results,
      remainingNodes: remaining.c,
      continue: remaining.c > 0,
      nextCall: remaining.c > 0 ? 'POST /api/orchestrate/execute with same projectId + autoRun=true' : null
    });
  }

  res.json({ projectId, status: 'running', waveCompleted: results });
});

// GET /api/orchestrate/project/:id
// Full project state: nodes, context bus, edges, ATLAS summary if done.
router.get('/project/:id', (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const nodes = db.prepare('SELECT * FROM task_nodes WHERE project_id = ? ORDER BY id').all(req.params.id);
  const contextBus = db.prepare('SELECT * FROM context_bus WHERE project_id = ? ORDER BY id').all(req.params.id);
  const edges = db.prepare('SELECT * FROM task_edges WHERE project_id = ?').all(req.params.id);

  let summary = null;
  if (project.status === 'awaiting_approval' || project.status === 'approved' || project.status === 'completed') {
    summary = generateAtlasSummary(req.params.id);
  }

  res.json({ project, nodes, edges, contextBus, summary });
});

// GET /api/orchestrate/projects
// List all orchestration projects
router.get('/projects', (req, res) => {
  const projects = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
  res.json({ projects });
});

// POST /api/orchestrate/approve
// Approval gate: approve, revise, or reject a project.
router.post('/approve', (req, res) => {
  const { projectId, decision, revisionNote } = req.body || {};
  if (!projectId || !decision) return res.status(400).json({ error: 'projectId and decision are required' });

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  if (!['approved', 'rejected', 'revise'].includes(decision)) {
    return res.status(400).json({ error: 'decision must be: approved, rejected, or revise' });
  }

  if (decision === 'approved') {
    db.prepare('UPDATE projects SET status = ?, completed_at = ? WHERE id = ?').run('completed', now(), projectId);
    return res.json({ projectId, status: 'completed', message: 'Project approved and marked complete.' });
  }

  if (decision === 'rejected') {
    db.prepare('UPDATE projects SET status = ?, completed_at = ? WHERE id = ?').run('rejected', now(), projectId);
    return res.json({ projectId, status: 'rejected', message: 'Project rejected.' });
  }

  if (decision === 'revise') {
    // Revision: reset nodes that need re-run based on revisionNote
    db.prepare('UPDATE projects SET status = ? WHERE id = ?').run('planned', projectId);
    db.prepare('UPDATE task_nodes SET status = ?, output_json = NULL, completed_at = NULL WHERE project_id = ? AND node_key = ?')
      .run('pending', projectId, revisionNote || 'architect');
    // Also reset all downstream nodes
    const edges = db.prepare('SELECT * FROM task_edges WHERE project_id = ?').all(projectId);
    const downstream = new Set();
    function collectDownstream(key) {
      for (const e of edges) {
        if (e.from_node === key && !downstream.has(e.to_node)) {
          downstream.add(e.to_node);
          collectDownstream(e.to_node);
        }
      }
    }
    collectDownstream(revisionNote || 'architect');
    for (const key of downstream) {
      db.prepare('UPDATE task_nodes SET status = ?, output_json = NULL, completed_at = NULL WHERE project_id = ? AND node_key = ?')
        .run('pending', projectId, key);
    }
    // Clear downstream context bus entries
    for (const key of downstream) {
      db.prepare('DELETE FROM context_bus WHERE project_id = ? AND node_key = ?').run(projectId, key);
    }
    return res.json({ projectId, status: 'planned', message: `Revision requested on node '${revisionNote || 'architect'}'. ${downstream.size} downstream nodes reset. Re-execute to continue.` });
  }
});

module.exports = router;
