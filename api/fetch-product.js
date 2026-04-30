/**
 * Vercel Serverless Function — /api/fetch-product
 *
 * Fetches a product page server-side (avoiding browser CORS restrictions)
 * and extracts name, price, and image from:
 *   1. JSON-LD structured data  (best — often server-rendered even on SPAs)
 *   2. Open Graph meta tags      (reliable for name + image)
 *   3. Common price meta tags    (works on simpler/Shopify stores)
 *
 * Usage:  GET /api/fetch-product?url=https://...
 * Returns: { name, price, imageUrl }  — any field may be null
 */

export default async function handler(req, res) {
  // Allow the browser to call this endpoint
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing ?url= parameter' });
  }

  // Validate that it's actually a URL
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error();
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  try {
    const html = await fetchPage(url);
    // Use Amazon-specific parsing when applicable
    const isAmazon = /amazon\.(com|co\.uk|ca|de|fr|it|es|co\.jp|in|com\.au)/i.test(parsedUrl.hostname);
    const result = isAmazon ? extractAmazonInfo(html) : extractProductInfo(html);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(502).json({ error: err.message || 'Failed to fetch page' });
  }
}

// ─── Fetch the page with realistic browser headers ────────────────────────────

async function fetchPage(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept':
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`Site returned status ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Extract product info from raw HTML ──────────────────────────────────────

function extractProductInfo(html) {
  // Strategy 1: JSON-LD structured data (most reliable when present)
  const fromJsonLd = extractFromJsonLd(html);

  // Strategy 2: <meta> Open Graph / price tags
  const fromMeta = extractFromMeta(html);

  // Merge: prefer JSON-LD but fill gaps with meta
  const name     = fromJsonLd?.name     || fromMeta?.name     || null;
  const price    = fromJsonLd?.price    || fromMeta?.price    || null;
  const imageUrl = fromJsonLd?.imageUrl || fromMeta?.imageUrl || null;

  return { name, price, imageUrl };
}

// ─── Amazon parser ────────────────────────────────────────────────────────────

function extractAmazonInfo(html) {
  const generic = extractProductInfo(html);
  const title =
    matchFirst(html, /<span[^>]+id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i) ||
    generic.name;
  const imageUrl =
    matchFirst(html, /data-old-hires=["']([^"']+)["']/i) ||
    matchFirst(html, /"large":"([^"]+)"/i)?.replace(/\\u0026/g, '&') ||
    generic.imageUrl;
  const priceText =
    matchFirst(html, /<span[^>]+class=["'][^"']*a-price-whole[^"']*["'][^>]*>\s*([^<]+)\s*<\/span>/i) ||
    matchFirst(html, /<span[^>]+id=["']priceblock_ourprice["'][^>]*>\s*([^<]+)\s*<\/span>/i) ||
    matchFirst(html, /<span[^>]+id=["']priceblock_dealprice["'][^>]*>\s*([^<]+)\s*<\/span>/i);
  const price = priceText
    ? parseFloat(priceText.replace(/[^0-9.]/g, '')) || generic.price || null
    : generic.price;

  return {
    name: title ? decodeHtmlEntities(title).trim() : null,
    price,
    imageUrl,
  };
}

// ─── JSON-LD parser ───────────────────────────────────────────────────────────

function extractFromJsonLd(html) {
  // Find all <script type="application/ld+json"> blocks
  const scriptPattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = scriptPattern.exec(html)) !== null) {
    try {
      const raw = JSON.parse(match[1]);
      // JSON-LD can be a single object or an array
      const nodes = Array.isArray(raw) ? raw : [raw];

      for (const node of nodes) {
        // Walk @graph arrays (common in Shopify)
        const candidates = node['@graph']
          ? [...nodes, ...node['@graph']]
          : nodes;

        for (const item of candidates) {
          if (item['@type'] !== 'Product') continue;

          const name     = item.name || null;
          const imageUrl = resolveImage(item.image) || null;
          const price    = resolvePrice(item.offers) || null;

          if (name || imageUrl) return { name, price, imageUrl };
        }
      }
    } catch {
      // Malformed JSON-LD — skip and try next block
    }
  }

  return null;
}

function resolveImage(image) {
  if (!image) return null;
  if (typeof image === 'string') return image;
  if (Array.isArray(image))     return image[0]?.url || image[0] || null;
  if (typeof image === 'object') return image.url || null;
  return null;
}

function resolvePrice(offers) {
  if (!offers) return null;
  const offer = Array.isArray(offers) ? offers[0] : offers;
  const raw   = offer?.price ?? offer?.lowPrice ?? null;
  if (raw === null) return null;
  const num = parseFloat(String(raw).replace(/[^0-9.]/g, ''));
  return isNaN(num) ? null : num;
}

// ─── Meta tag parser ──────────────────────────────────────────────────────────

function extractFromMeta(html) {
  function getMeta(...keys) {
    for (const key of keys) {
      // Match <meta property="..." content="..."> or <meta name="..." content="...">
      const pattern = new RegExp(
        `<meta[^>]+(?:property|name)=["']${escapeRegex(key)}["'][^>]+content=["']([^"']+)["']`,
        'i'
      );
      const altPattern = new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escapeRegex(key)}["']`,
        'i'
      );
      const m = html.match(pattern) || html.match(altPattern);
      if (m?.[1]?.trim()) return m[1].trim();
    }
    return null;
  }

  // Product name — strip common " | Store Name" suffixes
  const rawName = getMeta('og:title', 'twitter:title');
  const name = rawName
    ? rawName
        .replace(/\s*[|–—-]\s*(ULTA|Sephora|Amazon|Target|Walmart|Nordstrom|Shop|Buy)[^|–—-]*/i, '')
        .trim() || rawName
    : null;

  // Product image
  const imageUrl = getMeta('og:image', 'twitter:image:src', 'twitter:image') || null;

  // Price (present in static HTML mainly on Shopify / simpler stores)
  const priceStr = getMeta(
    'product:price:amount',
    'og:price:amount',
    'twitter:data1',    // Shopify often puts price here
    'price'
  );
  const price = priceStr
    ? parseFloat(priceStr.replace(/[^0-9.]/g, '')) || null
    : null;

  return { name, price, imageUrl };
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchFirst(html, pattern) {
  const match = html.match(pattern);
  return match?.[1] || null;
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}
