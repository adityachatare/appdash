const { generateNotifications, refineNotification } = require('../services/ai');

async function generate(req, res) {
  const { prompt, tone, audience, count, language } = req.body || {};
  if (!prompt || !String(prompt).trim()) return res.status(400).json({ error: 'prompt is required' });
  const result = await generateNotifications({
    app: req.ownedApp,
    prompt: String(prompt).trim(),
    tone,
    audience,
    count,
    language,
  });
  res.json(result);
}

async function refine(req, res) {
  const { title, body, instruction } = req.body || {};
  if (!title || !body || !instruction) {
    return res.status(400).json({ error: 'title, body and instruction are required' });
  }
  const result = await refineNotification({ app: req.ownedApp, title, body, instruction });
  res.json(result);
}

module.exports = { generate, refine };
