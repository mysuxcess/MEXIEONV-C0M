const express = require('express');
const router = express.Router();

// Relays outreach emails through SendGrid server-side.
//
// Why this has to live on the backend rather than calling SendGrid directly
// from the browser: SendGrid's API does not return CORS headers for
// browser-originated requests, so a fetch() straight from mexieon-v12.html
// would be blocked by the browser regardless of whether the API key is
// valid. Routing through here also keeps the key out of the browser
// network tab. The dashboard still stores the key in localStorage (Vault)
// and sends it with each request rather than storing it server-side, to
// match how the rest of the dashboard already handles keys.
router.post('/send-email', async (req, res) => {
  const { apiKey, from, to, subject, body } = req.body || {};

  if (!apiKey) return res.status(400).json({ error: 'Missing SendGrid API key.' });
  if (!from) return res.status(400).json({ error: 'Missing sender (from) email address. Set "Company Sender Email" in the API Vault.' });
  if (!to) return res.status(400).json({ error: 'Missing recipient email address.' });
  if (!subject || !body) return res.status(400).json({ error: 'Missing subject or body.' });

  try {
    const sgRes = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: from },
        subject,
        content: [{ type: 'text/plain', value: body }]
      })
    });

    if (sgRes.status === 202) {
      return res.json({ ok: true, message: 'Email accepted by SendGrid for delivery.' });
    }

    // SendGrid returns error details in the body even on failure.
    const errText = await sgRes.text();
    let detail = errText;
    try { detail = JSON.parse(errText).errors?.map((e) => e.message).join('; ') || errText; } catch {}

    console.error('SendGrid send failed:', sgRes.status, detail);
    return res.status(sgRes.status === 401 ? 401 : 502).json({
      error: sgRes.status === 401
        ? 'SendGrid rejected the API key. Check the key in the API Vault.'
        : `SendGrid rejected the email: ${detail || 'Unknown error. Common cause: the "from" address is not a verified sender in your SendGrid account (Settings → Sender Authentication).'}`
    });
  } catch (err) {
    console.error('SendGrid relay error:', err.message);
    return res.status(502).json({ error: 'Could not reach SendGrid. The backend may have no outbound network access, or SendGrid is down.' });
  }
});

module.exports = router;
