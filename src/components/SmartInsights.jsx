import React, { useMemo } from 'react';
import { analyzeWishlist, DECISIONS } from '../utils/analyzeWishlist';
import './SmartInsights.css';

const SECTIONS = [
  DECISIONS.BUY_NOW,
  DECISIONS.WAIT,
  DECISIONS.NOT_WORTH_IT,
];

const BADGE_CLASS = {
  [DECISIONS.BUY_NOW]: 'smart-insights__badge smart-insights__badge--buy',
  [DECISIONS.WAIT]: 'smart-insights__badge smart-insights__badge--wait',
  [DECISIONS.NOT_WORTH_IT]: 'smart-insights__badge smart-insights__badge--no',
};

function formatMoney(value) {
  if (value === null || value === undefined) return 'N/A';

  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function groupByDecision(insights) {
  return SECTIONS.reduce((groups, decision) => {
    groups[decision] = insights.filter((item) => item.decision === decision);
    return groups;
  }, {});
}

export default function SmartInsights({ wishlistItems = [], upcomingEvents = [] }) {
  const insights = useMemo(
    () => analyzeWishlist(wishlistItems, upcomingEvents),
    [wishlistItems, upcomingEvents],
  );

  const groupedInsights = useMemo(() => groupByDecision(insights), [insights]);

  if (wishlistItems.length === 0) {
    return (
      <section className="smart-insights" aria-labelledby="smart-insights-title">
        <div className="smart-insights__header">
          <h2 id="smart-insights-title">Smart Wishlist Insights</h2>
        </div>
        <p className="smart-insights__empty">Add wishlist items to see insights.</p>
      </section>
    );
  }

  return (
    <section className="smart-insights" aria-labelledby="smart-insights-title">
      <div className="smart-insights__header">
        <h2 id="smart-insights-title">Smart Wishlist Insights</h2>
      </div>

      <div className="smart-insights__sections">
        {SECTIONS.map((decision) => (
          <section className="smart-insights__section" key={decision}>
            <h3 className="smart-insights__section-title">{decision}</h3>

            {groupedInsights[decision].length === 0 ? (
              <p className="smart-insights__empty">No items in this group.</p>
            ) : (
              <div className="smart-insights__grid">
                {groupedInsights[decision].map((item) => (
                  <article className="smart-insights__card" key={item.id || item.name}>
                    <div className="smart-insights__card-header">
                      <h4 className="smart-insights__item-name">{item.name}</h4>
                      <span className={BADGE_CLASS[item.decision]}>
                        {item.decision}
                      </span>
                    </div>

                    <p className="smart-insights__reason">{item.reason}</p>

                    <dl className="smart-insights__metrics">
                      <div>
                        <dt>Cost per use</dt>
                        <dd>{formatMoney(item.metrics.cost_per_use)}</dd>
                      </div>
                      <div>
                        <dt>Payback</dt>
                        <dd>
                          {item.metrics.payback_months === null
                            ? 'N/A'
                            : `${item.metrics.payback_months} months`}
                        </dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </section>
  );
}
