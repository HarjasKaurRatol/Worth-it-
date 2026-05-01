/**
 * Vercel Serverless Function — /api/search-product
 *
 * Searches Google Shopping via SerpAPI and returns the top result's
 * name, price, and thumbnail image.
 *
 * Requires: SERP_API_KEY environment variable in Vercel project settings.
 *
 * Usage:  GET /api/search-product?q=espresso+machine
 * Returns: { name, price, imageUrl, link, rating, reviews }
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'SERP_API_KEY is not configured. Add it to your Vercel project environment variables.',
    });
  }

  const { q } = req.query;
  if (!q || !q.trim()) {
    return res.status(400).json({ error: 'Missing ?q= query parameter' });
  }

  const serpUrl = new URL('https://serpapi.com/search.json');
  serpUrl.searchParams.set('engine', 'google_shopping');
  serpUrl.searchParams.set('q', q.trim());
  serpUrl.searchParams.set('api_key', apiKey);
  serpUrl.searchParams.set('num', '5');
  serpUrl.searchParams.set('gl', 'us');
  serpUrl.searchParams.set('hl', 'en');

  let serpRes;
  try {
    serpRes = await fetch(serpUrl.toString(), {
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    return res.status(502).json({ error: 'Could not reach SerpAPI.' });
  }

  if (!serpRes.ok) {
    const body = await serpRes.json().catch(() => ({}));
    return res.status(502).json({
      error: body.error || `SerpAPI returned status ${serpRes.status}`,
    });
  }

  const data = await serpRes.json();
  const results = data.shopping_results || [];

  if (results.length === 0) {
    return res.status(200).json({ name: null, price: null, imageUrl: null, link: null });
  }

  const top = results[0];

  return res.status(200).json({
    name:     top.title     || null,
    price:    top.extracted_price ?? null,
    imageUrl: top.thumbnail  || null,
    link:     top.link       || null,
    rating:   top.rating     || null,
    reviews:  top.reviews    || null,
    allResults: results.slice(0, 5).map(r => ({
      name:     r.title          || null,
      price:    r.extracted_price ?? null,
      imageUrl: r.thumbnail      || null,
      link:     r.link           || null,
    })),
  });
}
