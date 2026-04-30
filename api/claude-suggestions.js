/**
 * Vercel Serverless Function — /api/claude-suggestions
 *
 * Receives upcoming calendar events + wishlist items, calls the Claude API,
 * and returns purchase suggestions tailored to those events.
 *
 * Requires: ANTHROPIC_API_KEY environment variable in Vercel project settings.
 *
 * Usage:  POST /api/claude-suggestions
 * Body:   { events: [...], wishlist: [...] }
 * Returns: { suggestions: [ { title, forEvent, reasoning, priceRange, worthItScore }, ... ] }
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY is not configured. Add it to your Vercel project environment variables.',
    });
  }

  const { events, wishlist } = req.body || {};
  if (!Array.isArray(events) || events.length === 0) {
    return res.status(400).json({ error: 'No events provided.' });
  }

  const eventsText = events.map(e => {
    let line = `- "${e.title}" on ${e.date}`;
    if (e.description) line += ` — ${e.description}`;
    if (e.budget)      line += ` (budget: $${e.budget})`;
    return line;
  }).join('\n');

  const wishlistText = Array.isArray(wishlist) && wishlist.length > 0
    ? wishlist.map(item => {
        let line = `- ${item.name}`;
        if (item.price) line += ` ($${item.price})`;
        if (item.note)  line += ` — "${item.note}"`;
        return line;
      }).join('\n')
    : 'No wishlist items saved.';

  const prompt = `You are a smart shopping assistant for an app called "Worth It?" that helps people decide whether purchases are worth making.

The user has these upcoming events:
${eventsText}

The user's wishlist:
${wishlistText}

Based on the upcoming events, suggest 3-5 purchases that would genuinely be worth making. Prioritise items already on the wishlist if they're relevant to an event. For each suggestion:
- Connect it clearly to one or more events
- Explain in 2-3 sentences why buying it now makes financial sense (e.g. replaces a recurring cost, multi-event utility, cost per use)
- Give a realistic price range
- Give a worth-it score: exactly one of "Worth it", "Conditionally worth it", or "Depends on usage"

Return ONLY a JSON array with no other text:
[
  {
    "title": "Product name",
    "forEvent": "Event name(s)",
    "reasoning": "2-3 sentences explaining why it's worth it",
    "priceRange": "$XX–$XX",
    "worthItScore": "Worth it"
  }
]`;

  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 1024,
        messages:   [{ role: 'user', content: prompt }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.json().catch(() => ({}));
      return res.status(502).json({
        error: err.error?.message || `Claude API returned status ${claudeRes.status}`,
      });
    }

    const claudeData = await claudeRes.json();
    const rawText    = claudeData.content?.[0]?.text?.trim() ?? '';

    let suggestions;
    try {
      suggestions = JSON.parse(rawText);
    } catch {
      const match = rawText.match(/\[[\s\S]*\]/);
      if (!match) throw new Error('Claude returned an unexpected response format.');
      suggestions = JSON.parse(match[0]);
    }

    return res.status(200).json({ suggestions });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to generate suggestions.' });
  }
}
