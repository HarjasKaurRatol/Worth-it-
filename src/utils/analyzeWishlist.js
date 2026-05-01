const DECISIONS = {
  BUY_NOW: 'Buy Now',
  WAIT: 'Wait',
  NOT_WORTH_IT: 'Not Worth It',
};

const EVENT_WINDOW_DAYS = 30;

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function asBoolean(value) {
  return value === true || value === 'true';
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function roundMoney(value) {
  return value === null ? null : Math.round(value * 100) / 100;
}

function daysUntil(dateValue, now) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;

  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((date.getTime() - now.getTime()) / msPerDay);
}

function getUpcomingEventMatch(item, upcomingEvents, now) {
  const tag = normalizeText(item.event_tag);
  if (!tag) return null;

  return upcomingEvents.find((event) => {
    const eventName = normalizeText(event.name);
    const days = daysUntil(event.date, now);

    return (
      (eventName === tag || eventName.includes(tag) || tag.includes(eventName)) &&
      days !== null &&
      days >= 0 &&
      days <= EVENT_WINDOW_DAYS
    );
  }) || null;
}

function joinReasons(reasons) {
  if (reasons.length <= 1) return reasons[0] || '';
  if (reasons.length === 2) return `${reasons[0]} and ${reasons[1]}`;

  return `${reasons.slice(0, -1).join(', ')}, and ${reasons[reasons.length - 1]}`;
}

function scoreCostPerUse(costPerUse) {
  if (costPerUse === null) return 0;
  if (costPerUse <= 1) return 30;
  if (costPerUse <= 3) return 22;
  if (costPerUse <= 7) return 12;
  if (costPerUse <= 12) return 5;
  return -15;
}

function scorePayback(paybackMonths) {
  if (paybackMonths === null) return 0;
  if (paybackMonths < 3) return 30;
  if (paybackMonths < 6) return 24;
  if (paybackMonths <= 12) return 14;
  if (paybackMonths <= 18) return 6;
  return -10;
}

function scoreUsage(usesPerMonth) {
  if (usesPerMonth === null) return 0;
  if (usesPerMonth >= 20) return 20;
  if (usesPerMonth >= 8) return 16;
  if (usesPerMonth >= 4) return 10;
  if (usesPerMonth >= 2) return 4;
  return -20;
}

function getMetrics(item) {
  const price = asNumber(item.price);
  const usesPerMonth = asNumber(item.uses_per_month);
  const lifespan = asNumber(item.expected_lifespan);
  const recurringCost = asNumber(item.recurring_cost_per_month);
  const replacesRecurringCost = asBoolean(item.replaces_recurring_cost);

  const totalUses = usesPerMonth && lifespan ? usesPerMonth * lifespan : null;
  const costPerUse = price && totalUses ? price / totalUses : null;
  const paybackMonths = price && replacesRecurringCost && recurringCost
    ? price / recurringCost
    : null;

  return {
    price,
    usesPerMonth,
    lifespan,
    replacesRecurringCost,
    costPerUse,
    paybackMonths,
  };
}

function classify({ score, metrics, eventSoon }) {
  if (
    score >= 58 ||
    (metrics.paybackMonths !== null && metrics.paybackMonths < 6) ||
    eventSoon
  ) {
    return DECISIONS.BUY_NOW;
  }

  if (
    (metrics.usesPerMonth !== null && metrics.usesPerMonth < 2) ||
    (metrics.costPerUse !== null && metrics.costPerUse > 12) ||
    score < 18
  ) {
    return DECISIONS.NOT_WORTH_IT;
  }

  return DECISIONS.WAIT;
}

function getReason(item, decision, metrics, eventMatch) {
  const reasons = [];

  if (metrics.paybackMonths !== null && metrics.paybackMonths < 6) {
    reasons.push(`Pays for itself in ${Math.ceil(metrics.paybackMonths)} months`);
  }

  if (metrics.costPerUse !== null) {
    reasons.push(`${roundMoney(metrics.costPerUse).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    })} per use`);
  }

  if (metrics.usesPerMonth !== null && metrics.usesPerMonth >= 8) {
    reasons.push('high expected usage');
  }

  if (eventMatch) {
    reasons.push(`relevant for ${eventMatch.name} within ${EVENT_WINDOW_DAYS} days`);
  }

  if (decision === DECISIONS.NOT_WORTH_IT) {
    if (metrics.usesPerMonth !== null && metrics.usesPerMonth < 2) {
      return 'Low expected usage makes the value hard to justify.';
    }
    if (metrics.costPerUse !== null && metrics.costPerUse > 12) {
      return 'Cost per use is very high compared with expected use.';
    }
    return 'No clear savings, urgency, or usage signal from the saved wishlist data.';
  }

  if (decision === DECISIONS.WAIT && reasons.length === 0) {
    return 'No strong urgency yet. Revisit when usage, lifespan, or savings are clearer.';
  }

  if (decision === DECISIONS.WAIT) {
    return `${joinReasons(reasons.slice(0, 2))}, but there is no urgent reason to buy now.`;
  }

  return joinReasons(reasons.slice(0, 3)) || 'Strong value signal from saved wishlist data.';
}

export function analyzeWishlist(wishlistItems = [], upcomingEvents = [], options = {}) {
  const now = options.now ? new Date(options.now) : new Date();

  return wishlistItems.map((item) => {
    const metrics = getMetrics(item);
    const eventMatch = getUpcomingEventMatch(item, upcomingEvents, now);

    const score =
      scoreCostPerUse(metrics.costPerUse) +
      scorePayback(metrics.paybackMonths) +
      scoreUsage(metrics.usesPerMonth) +
      (eventMatch ? 25 : 0);

    const decision = classify({
      score,
      metrics,
      eventSoon: Boolean(eventMatch),
    });

    return {
      id: item.id,
      name: item.name,
      decision,
      reason: getReason(item, decision, metrics, eventMatch),
      score,
      metrics: {
        cost_per_use: roundMoney(metrics.costPerUse),
        payback_months: metrics.paybackMonths === null
          ? null
          : Math.round(metrics.paybackMonths * 10) / 10,
      },
    };
  });
}

export { DECISIONS };
