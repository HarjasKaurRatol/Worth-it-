const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  _compoundFV,
  calculateCore,
  lookupBrand,
  calculateProductValue,
  getProductValueVerdict,
  _siMetrics,
  _siScore,
  _siDecision,
  analyzeWishlist,
  _decisionAction,
  _decisionReasons,
} = require('../calculations.js');

// ─── vs. Alternative: calculateCore ───────────────────────────────────────────

describe('calculateCore', () => {
  test('espresso machine example: pays off with high usage', () => {
    // $600 machine, replaces $6/coffee bought 20x/month, $10/mo upkeep, used 20x/month
    const calc = calculateCore({
      productCost: 600,
      alternativeCost: 6,
      frequencyPerMonth: 20,
      usagePerMonth: 20,
      maintenanceCost: 10,
    });
    assert.equal(calc.monthlyAlternativeCost, 120);
    assert.equal(calc.netMonthlySavings, 110);
    assert.ok(Math.abs(calc.breakEvenMonths - 600 / 110) < 1e-9);
    assert.equal(calc.yearlySavings, 110 * 12 - 600);
    assert.equal(calc.verdict, 'worth-it');
  });

  test('verdict is "consistent" when yearly savings are positive but usage is low', () => {
    const calc = calculateCore({
      productCost: 100,
      alternativeCost: 20,
      frequencyPerMonth: 1,
      usagePerMonth: 1, // below HIGH_USAGE_THRESHOLD (4)
      maintenanceCost: 0,
    });
    assert.equal(calc.yearlySavings, 20 * 12 - 100);
    assert.ok(calc.yearlySavings > 0);
    assert.equal(calc.verdict, 'consistent');
  });

  test('verdict is "probably-not" when net savings are positive but don\'t clear yearly cost', () => {
    const calc = calculateCore({
      productCost: 1000,
      alternativeCost: 5,
      frequencyPerMonth: 1,
      usagePerMonth: 1,
      maintenanceCost: 0,
    });
    assert.equal(calc.netMonthlySavings, 5);
    assert.ok(calc.yearlySavings < 0);
    assert.equal(calc.verdict, 'probably-not');
  });

  test('verdict is "no-savings" and breakEvenMonths is null when maintenance eats all savings', () => {
    const calc = calculateCore({
      productCost: 500,
      alternativeCost: 10,
      frequencyPerMonth: 4,
      usagePerMonth: 4,
      maintenanceCost: 40, // == monthlyAlternativeCost, so netMonthlySavings <= 0
    });
    assert.equal(calc.netMonthlySavings, 0);
    assert.equal(calc.breakEvenMonths, null);
    assert.equal(calc.verdict, 'no-savings');
  });

  test('costPerUse is null when usage per month is 0', () => {
    const calc = calculateCore({
      productCost: 300,
      alternativeCost: 15,
      frequencyPerMonth: 4,
      usagePerMonth: 0,
      maintenanceCost: 0,
    });
    assert.equal(calc.costPerUse, null);
  });

  test('costPerUse divides product cost by annual uses', () => {
    const calc = calculateCore({
      productCost: 240,
      alternativeCost: 10,
      frequencyPerMonth: 4,
      usagePerMonth: 2,
      maintenanceCost: 0,
    });
    // annualUses = 24, costPerUse = 240 / 24 = 10
    assert.equal(calc.costPerUse, 10);
  });
});

// ─── calculateCore: generic real-world examples ───────────────────────────────
// These mirror the "Try an example" cards on the homepage (script.js EXAMPLES),
// covering a spread of everyday purchase types and both possible outcomes.

describe('calculateCore — generic real-world examples', () => {
  test('air fryer replacing frequent takeout: fast payback, worth it', () => {
    const calc = calculateCore({
      productCost: 100, alternativeCost: 12, frequencyPerMonth: 8,
      usagePerMonth: 8, maintenanceCost: 0,
    });
    assert.equal(calc.monthlyAlternativeCost, 96);
    assert.ok(calc.breakEvenMonths < 2);
    assert.equal(calc.verdict, 'worth-it');
  });

  test('commuter bike replacing daily rideshare: worth it with upkeep factored in', () => {
    const calc = calculateCore({
      productCost: 450, alternativeCost: 6, frequencyPerMonth: 20,
      usagePerMonth: 20, maintenanceCost: 10,
    });
    assert.equal(calc.netMonthlySavings, 110); // (6*20) - 10
    assert.equal(calc.yearlySavings, 870);
    assert.equal(calc.verdict, 'worth-it');
  });

  test('water filter pitcher replacing bottled water: cheap, near-immediate payback', () => {
    const calc = calculateCore({
      productCost: 35, alternativeCost: 6, frequencyPerMonth: 4,
      usagePerMonth: 30, maintenanceCost: 4,
    });
    assert.ok(calc.breakEvenMonths < 2);
    assert.ok(calc.costPerUse < 0.10); // used ~daily, so pennies per use
    assert.equal(calc.verdict, 'worth-it');
  });

  test('treadmill bought instead of a gym membership but rarely used: honest "probably not"', () => {
    // Positive month-to-month savings can still fail to pay off within a year —
    // this is the case the app is designed to catch instead of just approving any
    // purchase with netMonthlySavings > 0.
    const calc = calculateCore({
      productCost: 1200, alternativeCost: 45, frequencyPerMonth: 1,
      usagePerMonth: 3, maintenanceCost: 15,
    });
    assert.equal(calc.netMonthlySavings, 30);
    assert.ok(calc.netMonthlySavings > 0);
    assert.ok(calc.yearlySavings < 0);
    assert.equal(calc.verdict, 'probably-not');
  });

  test('streaming service bundle replacing cable: recurring subscription vs. recurring cost', () => {
    const calc = calculateCore({
      productCost: 0, alternativeCost: 90, frequencyPerMonth: 1,
      usagePerMonth: 30, maintenanceCost: 25, // $25/mo streaming vs $90/mo cable
    });
    assert.equal(calc.netMonthlySavings, 65);
    assert.equal(calc.breakEvenMonths, 0); // no upfront cost, savings start immediately
    assert.equal(calc.verdict, 'worth-it');
  });

  test('impulse gadget with no real alternative cost: does not pay for itself', () => {
    const calc = calculateCore({
      productCost: 250, alternativeCost: 0, frequencyPerMonth: 1,
      usagePerMonth: 2, maintenanceCost: 0,
    });
    assert.equal(calc.monthlyAlternativeCost, 0);
    assert.equal(calc.breakEvenMonths, null);
    assert.equal(calc.verdict, 'no-savings');
  });
});

// ─── Compounding opportunity cost ─────────────────────────────────────────────

describe('_compoundFV', () => {
  test('matches the standard future-value-of-an-annuity formula', () => {
    const fv = _compoundFV(1000, 0.07, 10);
    const expected = 1000 * ((Math.pow(1.07, 10) - 1) / 0.07);
    assert.ok(Math.abs(fv - expected) < 1e-9);
  });

  test('grows with more years', () => {
    const fv10 = _compoundFV(1000, 0.07, 10);
    const fv20 = _compoundFV(1000, 0.07, 20);
    assert.ok(fv20 > fv10);
  });
});

// ─── Brand reputation lookup ───────────────────────────────────────────────────

describe('lookupBrand', () => {
  test('exact match is case-insensitive', () => {
    assert.equal(lookupBrand('Nike').label, 'Industry leader');
    assert.equal(lookupBrand('nike').label, 'Industry leader');
  });

  test('partial match finds a brand contained in the input', () => {
    const info = lookupBrand('Nike Air Max');
    assert.ok(info);
    assert.equal(info.label, 'Industry leader');
  });

  test('returns null for unknown brands and empty input', () => {
    assert.equal(lookupBrand('Some Random Unknown Brand Co'), null);
    assert.equal(lookupBrand(''), null);
    assert.equal(lookupBrand(null), null);
  });
});

// ─── Product Value calculator ──────────────────────────────────────────────────

describe('calculateProductValue', () => {
  test('computes cost per use and monthly cost', () => {
    const calc = calculateProductValue({ price: 120, uses: 4, lifespan: 12, brand: 'uniqlo' });
    assert.equal(calc.totalUses, 48);
    assert.equal(calc.costPerUse, 120 / 48);
    assert.equal(calc.monthlyCost, 10);
  });

  test('unknown brand defaults to a neutral score of 3.0', () => {
    const calc = calculateProductValue({ price: 100, uses: 10, lifespan: 10, brand: 'totally unknown brand' });
    assert.equal(calc.repInfo, null);
  });

  test('builds a comparison against an alternative when altPrice is given', () => {
    const calc = calculateProductValue({
      price: 100, uses: 4, lifespan: 24, brand: 'nike',
      altPrice: 40, altBrand: 'zara',
    });
    assert.ok(calc.comparison);
    assert.equal(calc.comparison.altBrandName, 'zara');
    // zara lifespan (18mo) < 24mo, so needs multiple units to cover the same period
    assert.equal(calc.comparison.altUnits, Math.ceil(24 / 18));
  });

  test('no comparison when altPrice is 0', () => {
    const calc = calculateProductValue({ price: 100, uses: 4, lifespan: 24, brand: 'nike', altPrice: 0 });
    assert.equal(calc.comparison, null);
  });
});

describe('getProductValueVerdict', () => {
  test('excellent: high score, low cost per use', () => {
    assert.equal(getProductValueVerdict(4.8, 0.5, null), 'excellent');
  });
  test('worth-it: good score, moderate cost per use', () => {
    assert.equal(getProductValueVerdict(4.2, 1.5, null), 'worth-it');
  });
  test('decent: mid score, low cost per use', () => {
    assert.equal(getProductValueVerdict(3.2, 0.5, null), 'decent');
  });
  test('use-more: good score but high cost per use', () => {
    assert.equal(getProductValueVerdict(4.2, 5, null), 'use-more');
  });
  test('budget-risk: low score, high cost per use', () => {
    assert.equal(getProductValueVerdict(2.0, 5, null), 'budget-risk');
  });
  test('better-alt overrides everything when the alternative saves significantly', () => {
    assert.equal(getProductValueVerdict(4.8, 0.5, { savings: -50 }), 'better-alt');
  });
  test('missing costPerUse falls back to worth-it', () => {
    assert.equal(getProductValueVerdict(4.8, null, null), 'worth-it');
  });
});

// ─── Smart Wishlist Insights ────────────────────────────────────────────────────

describe('_siMetrics', () => {
  test('computes cost-per-use and payback only when all inputs are present', () => {
    const m = _siMetrics({ price: 120, uses_per_month: 4, expected_lifespan: 12 });
    assert.equal(m.cpu, 120 / (4 * 12));
    assert.equal(m.pb, null); // no recurring_cost_per_month / replaces flag
  });

  test('computes payback only when replaces_recurring_cost is true', () => {
    const m = _siMetrics({
      price: 300, recurring_cost_per_month: 50, replaces_recurring_cost: true,
    });
    assert.equal(m.pb, 6);
  });

  test('invalid/zero numeric fields become null, not 0 or NaN', () => {
    const m = _siMetrics({ price: 0, uses_per_month: -5, expected_lifespan: 'not a number' });
    assert.equal(m.price, null);
    assert.equal(m.upm, null);
    assert.equal(m.life, null);
    assert.equal(m.cpu, null);
  });
});

describe('_siScore + _siDecision', () => {
  test('low cost-per-use, quick payback, and an upcoming event score a "Buy Now"', () => {
    const score = _siScore(0.5, 2, 20, true);
    const decision = _siDecision(score, 2, 20, 0.5, true);
    assert.equal(decision, 'Buy Now');
  });

  test('very low planned usage forces "Not Worth It" even with a decent score', () => {
    const decision = _siDecision(40, null, 1, null, false);
    assert.equal(decision, 'Not Worth It');
  });

  test('high cost-per-use forces "Not Worth It"', () => {
    const decision = _siDecision(40, null, null, 15, false);
    assert.equal(decision, 'Not Worth It');
  });

  test('no strong signal in any direction lands on "Wait"', () => {
    const score = _siScore(5, null, 5, false); // cpu +12, upm(5) +10 → score 22
    const decision = _siDecision(score, null, 5, 5, false);
    assert.equal(decision, 'Wait');
  });
});

describe('analyzeWishlist', () => {
  test('flags an item matching an upcoming event within the window', () => {
    const now = new Date();
    const soon = new Date(now.getTime() + 5 * 86400000).toISOString().split('T')[0];
    const results = analyzeWishlist(
      [{ id: '1', name: 'Hiking boots', event_tag: 'camping trip', price: 100, uses_per_month: 4, expected_lifespan: 24 }],
      [{ title: 'Camping Trip', date: soon }],
    );
    assert.equal(results.length, 1);
    assert.ok(results[0].reason.includes('Camping Trip'));
  });

  test('items with no usable data get "Not Worth It" or "Wait", not a crash', () => {
    const results = analyzeWishlist([{ id: '1', name: 'Mystery gadget' }], []);
    assert.equal(results.length, 1);
    assert.ok(['Buy Now', 'Wait', 'Not Worth It'].includes(results[0].decision));
  });

  test('rounds cost_per_use and payback_months metrics', () => {
    const results = analyzeWishlist(
      [{ id: '1', name: 'Blender', price: 100, uses_per_month: 3, expected_lifespan: 11 }],
      [],
    );
    const raw = 100 / (3 * 11);
    assert.equal(results[0].metrics.cost_per_use, Math.round(raw * 100) / 100);
  });
});

// ─── Decision Assistant scoring ────────────────────────────────────────────────

describe('_decisionAction', () => {
  test('an event match always means "Buy"', () => {
    const action = _decisionAction(0, { pb: null, upm: null, cpu: null }, { title: 'Wedding' }, null, null);
    assert.equal(action, 'Buy');
  });

  test('fast payback means "Buy" even without an event', () => {
    const action = _decisionAction(0, { pb: 3, upm: null, cpu: null }, null, null, null);
    assert.equal(action, 'Buy');
  });

  test('very low usage means "Skip"', () => {
    const action = _decisionAction(30, { pb: null, upm: 1, cpu: null }, null, null, null);
    assert.equal(action, 'Skip');
  });

  test('thin runway with meaningful runway impact means "Wait"', () => {
    const action = _decisionAction(30, { pb: null, upm: null, cpu: null }, null, 2, 5);
    assert.equal(action, 'Wait');
  });

  test('falls back to "Consider" with no strong signal', () => {
    const action = _decisionAction(30, { pb: null, upm: null, cpu: null }, null, null, null);
    assert.equal(action, 'Consider');
  });
});

describe('_decisionReasons', () => {
  test('includes a runway-impact reason when the item costs a meaningful number of days', () => {
    const reasons = _decisionReasons(
      { price: 90 }, { pb: null, upm: null, cpu: null }, null, {}, 5, 5,
    );
    assert.ok(reasons.some(r => r.includes('day')));
  });

  test('flags items over the user\'s "enough" budget', () => {
    const reasons = _decisionReasons(
      { price: 500 }, { pb: null, upm: null, cpu: null }, null, { budget: 200 }, null, null,
    );
    assert.ok(reasons.includes('over your enough limit'));
  });

  test('falls back to a generic reason when nothing else applies', () => {
    const reasons = _decisionReasons(
      { price: 0 }, { pb: null, upm: null, cpu: null }, null, {}, null, null,
    );
    assert.deepEqual(reasons, ['needs usage details for a sharper call']);
  });

  test('never returns more than 3 reasons', () => {
    const reasons = _decisionReasons(
      { price: 500 },
      { pb: 4, upm: 10, cpu: 15 },
      { title: 'Big Event' },
      { budget: 100 },
      2, 5,
    );
    assert.ok(reasons.length <= 3);
  });
});
