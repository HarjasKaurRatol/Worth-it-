/**
 * Worth It? — calculations.js
 * Pure calculation logic: no DOM, no storage, no Firebase.
 * Loaded as a plain <script> (before script.js) in the browser;
 * also require()-able directly in Node for unit tests.
 */

/** Threshold: if user says they'll use ≥ this many times/month, it's "high usage" */
const HIGH_USAGE_THRESHOLD = 4;

function _compoundFV(annualAmount, rate, years) {
  return annualAmount * ((Math.pow(1 + rate, years) - 1) / rate);
}

// ─── vs. Alternative: core calculation ────────────────────────────────────────

/**
 * Given already-validated calculator inputs, return all computed values plus
 * a verdict. Assumes productCost, alternativeCost, frequencyPerMonth, and
 * usagePerMonth have already been checked to be > 0 by the caller.
 */
function calculateCore(data) {
  const monthlyAlternativeCost = data.alternativeCost * data.frequencyPerMonth;
  const netMonthlySavings      = monthlyAlternativeCost - data.maintenanceCost;

  // Break-even: avoid division by zero or negative savings
  let breakEvenMonths;
  if (netMonthlySavings <= 0) {
    breakEvenMonths = null; // "No break-even"
  } else {
    breakEvenMonths = data.productCost / netMonthlySavings;
  }

  // Yearly savings = (net monthly savings × 12) − product cost
  const yearlySavings = (netMonthlySavings * 12) - data.productCost;

  // Cost per use = product cost ÷ (usage per month × 12)
  const annualUses = data.usagePerMonth * 12;
  const costPerUse = annualUses > 0 ? data.productCost / annualUses : null;

  // Verdict logic
  let verdict;
  if (netMonthlySavings <= 0) {
    verdict = 'no-savings';
  } else if (yearlySavings > 0 && data.usagePerMonth >= HIGH_USAGE_THRESHOLD) {
    verdict = 'worth-it';
  } else if (yearlySavings > 0) {
    verdict = 'consistent';
  } else {
    verdict = 'probably-not';
  }

  return {
    monthlyAlternativeCost,
    netMonthlySavings,
    breakEvenMonths,
    yearlySavings,
    costPerUse,
    verdict,
  };
}

// ─── Product Value: brand reputation DB ──────────────────────────────────────

const BRANDS = {
  // ── Clothing – everyday ──────────────────────────────────────────────────
  'old navy':        { score: 3.5, label: 'Solid basics',        note: 'Reliable everyday basics at accessible prices.',           lifespanMonths: 24 },
  'gap':             { score: 3.5, label: 'Classic quality',      note: 'American classics with consistent mid-range quality.',     lifespanMonths: 30 },
  'banana republic': { score: 4.0, label: 'Premium basics',       note: 'Polished, durable — great value for workwear.',           lifespanMonths: 48 },
  'j.crew':          { score: 4.0, label: 'Timeless quality',     note: 'Well-made classics that hold up over time.',              lifespanMonths: 48 },
  'abercrombie':     { score: 3.8, label: 'Good quality',         note: 'Better construction than most fast-fashion brands.',      lifespanMonths: 36 },
  'aritzia':         { score: 4.5, label: 'Premium quality',      note: 'Elevated quality with a noticeably longer lifespan.',     lifespanMonths: 48 },
  'anthropologie':   { score: 4.0, label: 'Quality & style',      note: 'Artisan-inspired pieces with solid construction.',        lifespanMonths: 42 },
  'uniqlo':          { score: 4.5, label: 'Hidden gem',           note: 'Japanese basics — outstanding durability for the price.', lifespanMonths: 48 },
  'everlane':        { score: 4.0, label: 'Ethical & durable',    note: 'Transparent pricing and solid build quality.',            lifespanMonths: 42 },
  'madewell':        { score: 4.5, label: 'Built to last',        note: 'High-quality denim known for excellent longevity.',       lifespanMonths: 60 },
  "levi's":          { score: 4.5, label: 'Denim icon',           note: 'Legendary denim — made to last years with wear.',         lifespanMonths: 60 },
  'levis':           { score: 4.5, label: 'Denim icon',           note: 'Legendary denim — made to last years with wear.',         lifespanMonths: 60 },
  'express':         { score: 3.2, label: 'Mid-range',            note: 'Decent workwear but inconsistent long-term durability.',  lifespanMonths: 24 },

  // ── Clothing – fast fashion ───────────────────────────────────────────────
  'zara':            { score: 3.0, label: 'Mixed quality',        note: 'Trendy designs but inconsistent durability by item.',     lifespanMonths: 18 },
  'h&m':             { score: 2.5, label: 'Fast fashion',         note: 'Low cost — expect to replace more often.',               lifespanMonths: 12 },
  'forever 21':      { score: 2.0, label: 'Ultra fast fashion',   note: 'Very trend-driven, low durability.',                     lifespanMonths: 8  },
  'shein':           { score: 1.5, label: 'Lowest quality tier',  note: 'Very low quality — likely needs replacing in under a year.', lifespanMonths: 6 },
  'fashion nova':    { score: 2.0, label: 'Fast fashion',         note: 'Trendy but low quality fabrics and construction.',       lifespanMonths: 8  },
  'princess polly':  { score: 3.0, label: 'Mid-range fast fashion', note: 'Decent quality for the price, better than most in class.', lifespanMonths: 18 },
  'revolve':         { score: 3.8, label: 'Mid–high quality',     note: 'Curates quality brands — individual pieces vary.',       lifespanMonths: 30 },

  // ── Activewear ────────────────────────────────────────────────────────────
  'lululemon':       { score: 4.8, label: 'Premium activewear',   note: 'Exceptional quality with a quality guarantee program.',  lifespanMonths: 60 },
  'alo':             { score: 4.5, label: 'Premium yoga wear',     note: 'High-end activewear with lasting colour and structure.', lifespanMonths: 48 },
  'vuori':           { score: 4.5, label: 'Premium comfort',       note: 'Incredibly soft with strong long-term durability.',     lifespanMonths: 48 },
  'gymshark':        { score: 4.0, label: 'Good activewear',       note: 'Quality activewear at a fair price point.',             lifespanMonths: 36 },
  'nike':            { score: 4.5, label: 'Industry leader',       note: 'Consistent performance and durability across lines.',    lifespanMonths: 36 },
  'adidas':          { score: 4.5, label: 'Trusted performance',   note: 'Reliable quality across all product lines.',            lifespanMonths: 36 },
  'under armour':    { score: 4.0, label: 'Performance gear',      note: 'Durable and reliable for high-intensity use.',          lifespanMonths: 36 },
  'athleta':         { score: 4.3, label: 'Quality activewear',    note: 'Sustainable activewear with strong durability.',        lifespanMonths: 42 },
  'fabletics':       { score: 3.5, label: 'Decent value',          note: 'Good quality at the subscription price point.',        lifespanMonths: 30 },

  // ── Footwear ──────────────────────────────────────────────────────────────
  'birkenstock':     { score: 4.8, label: 'Lasts decades',         note: 'Exceptional build — can last 10+ years with resoling.', lifespanMonths: 120 },
  'ugg':             { score: 4.0, label: 'Durable comfort',        note: 'Comfortable and durable with proper care.',             lifespanMonths: 48 },
  'new balance':     { score: 4.5, label: 'Durable footwear',       note: 'Known for comfort and above-average lifespan.',        lifespanMonths: 36 },
  'converse':        { score: 3.8, label: 'Classic icon',           note: 'Durable canvas — extremely repairable and resole-able.', lifespanMonths: 24 },
  'steve madden':    { score: 3.0, label: 'Mid-range',              note: 'Trendy styles with mixed durability feedback.',        lifespanMonths: 18 },
  'sam edelman':     { score: 3.5, label: 'Good value',             note: 'Decent quality at an accessible price point.',        lifespanMonths: 24 },
  'jeffrey campbell':{ score: 3.5, label: 'Statement pieces',       note: 'Bold styles, quality varies by line.',                lifespanMonths: 24 },

  // ── Beauty & personal care ────────────────────────────────────────────────
  'dyson':           { score: 4.8, label: 'Premium engineering',    note: 'Best-in-class engineering with a strong repair program.', lifespanMonths: 84 },
  'charlotte tilbury': { score: 4.8, label: 'Luxury quality',      note: 'High-end formulas that genuinely perform.',             lifespanMonths: 18 },
  'nars':            { score: 4.5, label: 'Professional quality',   note: 'Professional-grade formulations across the range.',     lifespanMonths: 18 },
  'rare beauty':     { score: 4.5, label: 'Highly rated',           note: 'Acclaimed for formula innovation and inclusivity.',     lifespanMonths: 12 },
  'fenty beauty':    { score: 4.5, label: 'Cult favourite',         note: 'Innovative formulas with excellent pigmentation.',      lifespanMonths: 12 },
  'too faced':       { score: 4.0, label: 'Strong performer',       note: 'Consistent quality, particularly eye and lip products.', lifespanMonths: 12 },
  'urban decay':     { score: 4.3, label: 'Pigment-rich formulas',  note: 'Known for long-wearing, highly pigmented formulas.',    lifespanMonths: 12 },
  'e.l.f.':          { score: 3.8, label: 'Great value',            note: 'Impressive drugstore quality for the price.',           lifespanMonths: 12 },
  'maybelline':      { score: 3.5, label: 'Drugstore staple',       note: 'Reliable everyday drugstore formulas.',                lifespanMonths: 12 },
  "l'oreal":         { score: 3.8, label: 'Reliable drugstore',     note: 'Broad range with consistently decent quality.',        lifespanMonths: 12 },
  'olaplex':         { score: 4.8, label: 'Science-backed',         note: 'Clinically proven bond repair — worth the investment.', lifespanMonths: 4  },

  // ── Fragrance ─────────────────────────────────────────────────────────────
  'carolina herrera':{ score: 4.8, label: 'Luxury fragrance',      note: 'House known for excellent longevity and projection.',   lifespanMonths: 18 },
  'chanel':          { score: 5.0, label: 'Iconic luxury',          note: 'Timeless formulas — exceptional quality and longevity.', lifespanMonths: 24 },
  'dior':            { score: 4.8, label: 'Luxury house',           note: 'Premium quality across all fragrance lines.',           lifespanMonths: 24 },
  'ysl':             { score: 4.7, label: 'Luxury fragrance',       note: 'Strong performance and impressive longevity.',          lifespanMonths: 18 },
  'jo malone':       { score: 4.5, label: 'Refined luxury',         note: 'Softer sillage but exceptional quality and blending.',  lifespanMonths: 18 },
  'maison margiela': { score: 4.8, label: 'Niche luxury',           note: 'Replica line is highly acclaimed for originality.',    lifespanMonths: 18 },
  'zara fragrance':  { score: 3.0, label: 'Budget fragrance',       note: 'Decent dupes at low prices — lighter longevity.',      lifespanMonths: 6  },
  'victoria\'s secret': { score: 3.2, label: 'Mass market',        note: 'Good everyday scents, light sillage and longevity.',   lifespanMonths: 8  },

  // ── Electronics / tech ────────────────────────────────────────────────────
  'apple':           { score: 4.8, label: 'Premium engineering',    note: 'Best-in-class build with long software support.',       lifespanMonths: 60 },
  'samsung':         { score: 4.5, label: 'High quality',           note: 'High quality across phones, tablets and TVs.',         lifespanMonths: 48 },
  'sony':            { score: 4.7, label: 'Premium quality',        note: 'Excellent engineering, particularly audio and cameras.',lifespanMonths: 60 },

  // ── Home & kitchen ────────────────────────────────────────────────────────
  'stanley':         { score: 4.7, label: 'Built to last',          note: 'Lifetime warranty — practically indestructible.',      lifespanMonths: 240 },
  'yeti':            { score: 4.8, label: 'Premium durability',     note: 'Exceptional build quality with lifetime support.',     lifespanMonths: 240 },
  'le creuset':      { score: 5.0, label: 'Heirloom quality',       note: 'Lifetime guarantee — designed to last generations.',   lifespanMonths: 600 },
};

/** Find a brand entry — exact, then partial match */
function lookupBrand(name) {
  if (!name) return null;
  const key = name.toLowerCase().trim();
  if (BRANDS[key]) return BRANDS[key];
  // Partial: brand DB key contained in input or vice versa
  for (const [brand, data] of Object.entries(BRANDS)) {
    if (key.includes(brand) || brand.includes(key)) return data;
  }
  return null;
}

// ─── Product Value: core calculation ─────────────────────────────────────────

function calculateProductValue(data) {
  const totalUses   = data.uses * data.lifespan;
  const costPerUse  = totalUses > 0 ? data.price / totalUses : null;
  const monthlyCost = data.price / data.lifespan;

  const repInfo    = lookupBrand(data.brand);
  const score      = repInfo?.score ?? 3.0;

  // Comparison against alternative (optional)
  let comparison = null;
  if (data.altPrice > 0) {
    const altRepInfo   = lookupBrand(data.altBrand);
    const altLifespan  = altRepInfo?.lifespanMonths ?? data.lifespan;
    const altUnits     = Math.ceil(data.lifespan / altLifespan);
    const altTotal     = altUnits * data.altPrice;
    const savings      = altTotal - data.price; // positive = main is cheaper
    comparison = {
      altBrandName: data.altBrand || 'Alternative',
      altLifespan,
      altUnits,
      altTotal,
      savings,
      altRepInfo,
    };
  }

  // Verdict
  const verdict = getProductValueVerdict(score, costPerUse, comparison);

  return { totalUses, costPerUse, monthlyCost, repInfo, comparison, verdict };
}

function getProductValueVerdict(score, costPerUse, comparison) {
  // If the cheaper alt is actually cheaper over time, flag it
  if (comparison && comparison.savings < -20) return 'better-alt';

  if (!costPerUse) return 'worth-it'; // edge case

  if (score >= 4.5 && costPerUse <= 0.75) return 'excellent';
  if (score >= 4.0 && costPerUse <= 2.00) return 'worth-it';
  if (score >= 3.0 && costPerUse <= 0.75) return 'decent';
  if (score >= 4.0 && costPerUse > 2.00)  return 'use-more';
  return 'budget-risk';
}

// ─── Smart Insights: wishlist scoring ────────────────────────────────────────

const _SI_WINDOW = 30; // days

function _siNum(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function _siDaysUntil(dateStr, now) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - now.getTime()) / 86400000);
}

function _siEventMatch(item, events, now) {
  const tag = String(item.event_tag || '').trim().toLowerCase();
  if (!tag) return null;
  return events.find(ev => {
    const name = String(ev.title || '').trim().toLowerCase();
    const days = _siDaysUntil(ev.date, now);
    return (name === tag || name.includes(tag) || tag.includes(name)) &&
      days !== null && days >= 0 && days <= _SI_WINDOW;
  }) || null;
}

function _siMetrics(item) {
  const price   = _siNum(item.price);
  const upm     = _siNum(item.uses_per_month);
  const life    = _siNum(item.expected_lifespan);
  const rec     = _siNum(item.recurring_cost_per_month);
  const replaces = item.replaces_recurring_cost === true;

  const cpu = price && upm && life ? price / (upm * life) : null;
  const pb  = price && replaces && rec ? price / rec : null;
  return { price, upm, life, cpu, pb };
}

function _siScore(cpu, pb, upm, hasEvent) {
  let s = 0;
  if (cpu !== null) {
    if (cpu <= 1) s += 30; else if (cpu <= 3) s += 22;
    else if (cpu <= 7) s += 12; else if (cpu <= 12) s += 5; else s -= 15;
  }
  if (pb !== null) {
    if (pb < 3) s += 30; else if (pb < 6) s += 24;
    else if (pb <= 12) s += 14; else if (pb <= 18) s += 6; else s -= 10;
  }
  if (upm !== null) {
    if (upm >= 20) s += 20; else if (upm >= 8) s += 16;
    else if (upm >= 4) s += 10; else if (upm >= 2) s += 4; else s -= 20;
  }
  if (hasEvent) s += 25;
  return s;
}

function _siDecision(score, pb, upm, cpu, eventSoon) {
  if (score >= 58 || (pb !== null && pb < 6) || eventSoon) return 'Buy Now';
  if ((upm !== null && upm < 2) || (cpu !== null && cpu > 12) || score < 18) return 'Not Worth It';
  return 'Wait';
}

/** Fixed USD formatter for internal advisory strings (independent of user locale/currency prefs) */
function _fmtUSD(v) {
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

function _siReason(decision, m, eventMatch) {
  const $$ = _fmtUSD;
  const parts = [];
  if (m.pb !== null && m.pb < 6) parts.push(`pays for itself in ${Math.ceil(m.pb)} months`);
  if (m.cpu !== null) parts.push(`${$$(Math.round(m.cpu * 100) / 100)} per use`);
  if (m.upm !== null && m.upm >= 8) parts.push('high expected usage');
  if (eventMatch) parts.push(`relevant for "${eventMatch.title}" within ${_SI_WINDOW} days`);

  if (decision === 'Not Worth It') {
    if (m.upm !== null && m.upm < 2) return 'Low expected usage makes the value hard to justify.';
    if (m.cpu !== null && m.cpu > 12) return 'Cost per use is very high compared with expected use.';
    return 'No clear savings, urgency, or usage signal from the saved wishlist data.';
  }
  if (decision === 'Wait') {
    return parts.length
      ? `${parts.slice(0, 2).join(' and ')}, but no urgent reason to buy now.`
      : 'No strong urgency yet. Revisit when usage, lifespan, or savings are clearer.';
  }
  return parts.slice(0, 3).join(', ') || 'Strong value signal from saved wishlist data.';
}

function analyzeWishlist(wishlistItems, calendarEvents) {
  const now = new Date();
  return wishlistItems.map(item => {
    const m    = _siMetrics(item);
    const ev   = _siEventMatch(item, calendarEvents, now);
    const score = _siScore(m.cpu, m.pb, m.upm, Boolean(ev));
    const decision = _siDecision(score, m.pb, m.upm, m.cpu, Boolean(ev));
    return {
      id: item.id,
      name: item.name,
      decision,
      reason: _siReason(decision, m, ev),
      metrics: {
        cost_per_use:   m.cpu === null ? null : Math.round(m.cpu * 100) / 100,
        payback_months: m.pb  === null ? null : Math.round(m.pb  * 10)  / 10,
      },
    };
  });
}

// ─── Decision Assistant: ranking scoring ─────────────────────────────────────

function _decisionAction(score, metrics, eventMatch, runway, daysLost) {
  if (eventMatch || (metrics.pb !== null && metrics.pb < 6) || score >= 58) return 'Buy';
  if ((metrics.upm !== null && metrics.upm < 2) || (metrics.cpu !== null && metrics.cpu > 12)) return 'Skip';
  if (runway !== null && runway < 3 && daysLost !== null && daysLost > 3) return 'Wait';
  if (score < 18) return 'Wait';
  return 'Consider';
}

function _decisionReasons(item, metrics, eventMatch, settings, runway, daysLost) {
  const reasons = [];
  if (metrics.pb !== null) reasons.push(`pays back in ${Math.ceil(metrics.pb)} mo`);
  if (metrics.cpu !== null) reasons.push(`${_fmtUSD(Math.round(metrics.cpu * 100) / 100)} per use`);
  if (metrics.upm !== null && metrics.upm >= 8) reasons.push('high planned use');
  if (eventMatch) reasons.push(`useful for ${eventMatch.title}`);
  if (daysLost !== null && daysLost < 1) reasons.push('tiny runway impact');
  else if (daysLost !== null && daysLost <= 7) reasons.push(`about ${Math.round(daysLost)} day${Math.round(daysLost) === 1 ? '' : 's'} of runway`);
  if (runway !== null && runway < 3 && daysLost !== null && daysLost > 3) reasons.push('runway is thin');
  if (item.price && settings.budget && item.price > settings.budget) reasons.push('over your enough limit');
  if (reasons.length === 0) reasons.push('needs usage details for a sharper call');
  return reasons.slice(0, 3);
}

// ─── Node/browser interop ─────────────────────────────────────────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    HIGH_USAGE_THRESHOLD,
    _compoundFV,
    calculateCore,
    BRANDS,
    lookupBrand,
    calculateProductValue,
    getProductValueVerdict,
    _SI_WINDOW,
    _siNum,
    _siDaysUntil,
    _siEventMatch,
    _siMetrics,
    _siScore,
    _siDecision,
    _siReason,
    analyzeWishlist,
    _decisionAction,
    _decisionReasons,
  };
}
