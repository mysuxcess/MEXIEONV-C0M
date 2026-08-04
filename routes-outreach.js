const express = require('express');
const db = require('./db');

const router = express.Router();

// ---------- facility ----------

function getAllocated(excludeId) {
  const rows = db.prepare(
    `SELECT funding_amount FROM supplier_outreach
     WHERE include_funding = 1 AND status != 'responded_negative'
     ${excludeId ? 'AND id != ?' : ''}`
  ).all(...(excludeId ? [excludeId] : []));
  return rows.reduce((sum, r) => sum + (r.funding_amount || 0), 0);
}

router.get('/facility', (req, res) => {
  const facility = db.prepare('SELECT * FROM trade_facility WHERE id = 1').get();
  const allocated = getAllocated();
  res.json({
    total: facility.total_amount,
    allocated,
    remaining: facility.total_amount - allocated
  });
});

router.patch('/facility', (req, res) => {
  const { total } = req.body || {};
  if (!total || Number(total) <= 0) {
    return res.status(400).json({ error: 'total must be a positive number.' });
  }
  db.prepare('UPDATE trade_facility SET total_amount = ? WHERE id = 1').run(Number(total));
  const allocated = getAllocated();
  res.json({ total: Number(total), allocated, remaining: Number(total) - allocated });
});

// ---------- outreach ----------

router.get('/outreach', (req, res) => {
  const rows = db.prepare('SELECT * FROM supplier_outreach ORDER BY created_at DESC').all();
  res.json({ outreach: rows });
});

router.post('/outreach', (req, res) => {
  const {
    company, contact_email, category, supply_model, pay_terms, notes,
    include_funding, funding_amount, draft_subject, draft_body
  } = req.body || {};

  if (!company) return res.status(400).json({ error: 'company is required.' });

  if (include_funding && funding_amount) {
    const facility = db.prepare('SELECT * FROM trade_facility WHERE id = 1').get();
    const allocated = getAllocated();
    const remaining = facility.total_amount - allocated;
    if (Number(funding_amount) > remaining) {
      // Not a hard block server-side — the manager confirmed this in the UI —
      // but we flag it back so the client can show the same warning if it bypassed the check.
      console.warn(`Outreach to ${company} allocates ${funding_amount}, exceeding remaining facility balance of ${remaining}.`);
    }
  }

  const result = db.prepare(
    `INSERT INTO supplier_outreach
      (company, contact_email, category, supply_model, pay_terms, notes, include_funding, funding_amount, draft_subject, draft_body, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent')`
  ).run(
    company, contact_email || '', category || '', supply_model || '', pay_terms || '',
    notes || '', include_funding ? 1 : 0, funding_amount || 0, draft_subject || '', draft_body || ''
  );

  const row = db.prepare('SELECT * FROM supplier_outreach WHERE id = ?').get(result.lastInsertRowid);
  res.json({ outreach: row });
});

router.patch('/outreach/:id/status', (req, res) => {
  const { status } = req.body || {};
  const allowed = ['sent', 'responded_positive', 'responded_negative', 'responded_questions', 'vetting'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Must be one of: ' + allowed.join(', ') });
  }
  db.prepare("UPDATE supplier_outreach SET status = ?, updated_at = datetime('now') WHERE id = ?")
    .run(status, req.params.id);
  const row = db.prepare('SELECT * FROM supplier_outreach WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Outreach record not found.' });
  res.json({ outreach: row });
});

router.delete('/outreach/:id', (req, res) => {
  db.prepare('DELETE FROM supplier_outreach WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
