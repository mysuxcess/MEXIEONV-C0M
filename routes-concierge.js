const express = require('express');
const { COUNTRY_INFO, answerQuestion } = require('./country-info');

const router = express.Router();

// Optional: if ANTHROPIC_API_KEY is set in the environment, use a real model
// for open-ended answers, grounded in the curated facts so it doesn't invent
// shipping/duty information. Falls back to the keyword-matched answer if the
// key isn't set or the call fails, so this feature works out of the box.
async function getAIAnswer(country, question, facts) {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  try {
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
        messages: [{
          role: 'user',
          content: `You are the Mexieon Country Concierge, helping a shopper understand ${country} before they shop the ${country} storefront. ` +
            `Known facts: ${facts.join(' ')} ` +
            `Answer this question in 2-3 sentences, using only the facts above plus general public knowledge about ${country} (no invented logistics/customs specifics): "${question}"`
        }]
      })
    });
    const data = await response.json();
    const text = data?.content?.find((b) => b.type === 'text')?.text;
    return text || null;
  } catch (err) {
    console.error('Country concierge AI call failed:', err.message);
    return null;
  }
}

router.post('/', async (req, res) => {
  const { country, question } = req.body || {};
  if (!country || !question) {
    return res.status(400).json({ error: 'country and question are required.' });
  }

  const info = COUNTRY_INFO[country];
  if (!info) {
    return res.status(404).json({ error: `No concierge data available yet for ${country}.` });
  }

  const aiAnswer = await getAIAnswer(country, question, info.facts);
  const fallback = answerQuestion(country, question);

  res.json({
    answer: aiAnswer || fallback.answer,
    video: info.video,
    source: aiAnswer ? 'ai' : 'curated'
  });
});

router.get('/:country', (req, res) => {
  const info = COUNTRY_INFO[req.params.country];
  if (!info) return res.status(404).json({ error: 'No concierge data for this country.' });
  res.json({ facts: info.facts, video: info.video });
});

module.exports = router;
