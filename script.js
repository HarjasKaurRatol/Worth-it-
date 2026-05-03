/**
 * Worth It? — script.js
 * Vanilla JS, no dependencies.
 * All calculations are pure functions; DOM updates are separate.
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY         = 'worthit_calculations';
const WISHLIST_KEY        = 'worthit_wishlist';
const CALENDAR_EVENTS_KEY = 'worthit_calendar_events';
const SETTINGS_KEY        = 'worthit_settings';

/** Threshold: if user says they'll use ≥ this many times/month, it's "high usage" */
const HIGH_USAGE_THRESHOLD = 4;

// ─── Firebase storage ─────────────────────────────────────────────────────────
//
// Setup steps:
//  1. Go to https://console.firebase.google.com → create a new project.
//  2. Add a Web app → copy the config object into FIREBASE_CONFIG below.
//  3. In the console, enable:
//       • Firestore Database (start in production mode, any region)
//       • Authentication → Sign-in method → Anonymous
//  4. In Firestore → Rules, replace the default with:
//
    
//
// ─────────────────────────────────────────────────────────────────────────────

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyCtLtsEJ9jxwpoGJywrhyFHEHw6L8woeQI",
  authDomain:        "newapp-998b9.firebaseapp.com",
  projectId:         "newapp-998b9",
  storageBucket:     "newapp-998b9.firebasestorage.app",
  messagingSenderId: "464304439384",
  appId:             "1:464304439384:web:26f25879653ff4236b4a2d",
};

firebase.initializeApp(FIREBASE_CONFIG);
const db   = firebase.firestore();
const auth = firebase.auth();

let _uid = null;

const _cache = {
  [STORAGE_KEY]:         [],
  [WISHLIST_KEY]:        [],
  [CALENDAR_EVENTS_KEY]: [],
  [SETTINGS_KEY]:        {},
};

function _fsSave(key, value) {
  if (!_uid) return;
  db.collection('users').doc(_uid).collection('data').doc(key)
    .set({ v: value })
    .catch(err => {
      console.warn('[Firestore] write error:', err);
      showToast('Couldn\'t save — check your connection', 'err');
    });
}

async function _fsLoad(key) {
  if (!_uid) return null;
  const snap = await db.collection('users').doc(_uid).collection('data').doc(key).get();
  return snap.exists ? snap.data().v : null;
}

// ─── Toast notifications ──────────────────────────────────────────────────────

function showToast(message, type = 'default', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast${type !== 'default' ? ` toast--${type}` : ''}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast--out');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, duration);
}

// ─── Example data ────────────────────────────────────────────────────────────

const EXAMPLES = {
  'gel-nails': {
    productName:      'Gel Nail Kit',
    productCost:      85,
    alternativeCost:  65,
    frequencyPerMonth: 1,
    usagePerMonth:    4,
    maintenanceCost:  8,
    lifespanMonths:   36,
  },
  'espresso': {
    productName:      'Espresso Machine',
    productCost:      280,
    alternativeCost:  6.50,
    frequencyPerMonth: 20,
    usagePerMonth:    20,
    maintenanceCost:  12,
    lifespanMonths:   60,
  },
  'walking-pad': {
    productName:      'Walking Pad',
    productCost:      350,
    alternativeCost:  45,
    frequencyPerMonth: 1,
    usagePerMonth:    12,
    maintenanceCost:  0,
    lifespanMonths:   48,
  },
  'sports-bras': {
    productName:      'Quality Sports Bras (3-pack)',
    productCost:      120,
    alternativeCost:  18,
    frequencyPerMonth: 0.5,
    usagePerMonth:    8,
    maintenanceCost:  0,
    lifespanMonths:   18,
  },
  'laser': {
    productName:      'At-home Laser Hair Removal Device',
    productCost:      449,
    alternativeCost:  80,
    frequencyPerMonth: 1,
    usagePerMonth:    4,
    maintenanceCost:  0,
    lifespanMonths:   60,
  },
};

// ─── DOM references ───────────────────────────────────────────────────────────

const form              = document.getElementById('calc-form');
const btnCalculate      = document.getElementById('btn-calculate');
const btnSave           = document.getElementById('btn-save');
const btnClear          = document.getElementById('btn-clear');
const resultsSection    = document.getElementById('results');
const savedListEl       = document.getElementById('saved-list');

// Form inputs
const fields = {
  productName:       document.getElementById('productName'),
  productCost:       document.getElementById('productCost'),
  alternativeCost:   document.getElementById('alternativeCost'),
  frequencyPerMonth: document.getElementById('frequencyPerMonth'),
  usagePerMonth:     document.getElementById('usagePerMonth'),
  maintenanceCost:   document.getElementById('maintenanceCost'),
  lifespanMonths:    document.getElementById('lifespanMonths'),
};

// Result display elements
const resultEls = {
  productName:    document.getElementById('results-product-name'),
  verdictBadge:   document.getElementById('verdict-badge'),
  verdictText:    document.getElementById('verdict-text'),
  monthlyAlt:     document.getElementById('stat-monthly-alt'),
  monthlySavings: document.getElementById('stat-monthly-savings'),
  breakEven:      document.getElementById('stat-breakeven'),
  yearly:         document.getElementById('stat-yearly'),
  perUse:         document.getElementById('stat-per-use'),
};

// ─── Utility helpers ──────────────────────────────────────────────────────────

// Detect the user's locale and map it to a currency so formatting feels local.
// Falls back to USD for unknown locales.
const _userLocale = navigator.language || 'en-US';
const _CURRENCY_MAP = {
  'en-US': 'USD', 'en-CA': 'CAD', 'en-GB': 'GBP', 'en-AU': 'AUD',
  'en-NZ': 'NZD', 'en-IN': 'INR', 'en-SG': 'SGD', 'en-ZA': 'ZAR',
  'en-IE': 'EUR', 'en-PH': 'PHP', 'en-PK': 'PKR', 'en-NG': 'NGN',
  'fr-FR': 'EUR', 'de-DE': 'EUR', 'es-ES': 'EUR', 'it-IT': 'EUR',
  'nl-NL': 'EUR', 'pt-PT': 'EUR', 'fr-BE': 'EUR', 'de-AT': 'EUR',
  'fi-FI': 'EUR', 'el-GR': 'EUR', 'sk-SK': 'EUR', 'fr-LU': 'EUR',
  'fr-CA': 'CAD', 'zh-CN': 'CNY', 'zh-TW': 'TWD', 'ja-JP': 'JPY',
  'ko-KR': 'KRW', 'pt-BR': 'BRL', 'es-MX': 'MXN', 'tr-TR': 'TRY',
  'pl-PL': 'PLN', 'sv-SE': 'SEK', 'nb-NO': 'NOK', 'da-DK': 'DKK',
  'cs-CZ': 'CZK', 'hu-HU': 'HUF', 'ro-RO': 'RON', 'ru-RU': 'RUB',
  'ar-SA': 'SAR', 'ar-AE': 'AED', 'he-IL': 'ILS', 'hi-IN': 'INR',
};
const _userCurrency = _CURRENCY_MAP[_userLocale] || 'USD';

/** Format a number as a currency string using the user's locale, e.g. 1234.5 → "$1,234.50" */
function formatMoney(value) {
  return new Intl.NumberFormat(_userLocale, {
    style: 'currency',
    currency: _userCurrency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Format a date (ISO string) as "Apr 14, 2026" */
function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ─── Psychology of Money helpers ─────────────────────────────────────────────

const HUMILITY_NOTES = {
  'worth-it':     'This assumes things go as planned — real outcomes depend on usage, life changes, and a bit of luck.',
  'consistent':   'This depends on consistent use. Circumstances change, so build in some flexibility.',
  'probably-not': 'Sometimes the math says no, but life says yes. That\'s valid too.',
  'no-savings':   'Sometimes the math says no, but life says yes. That\'s valid too.',
  'excellent':    'This assumes things go as planned — real outcomes depend on usage, life changes, and a bit of luck.',
  'decent':       'Mid-tier quality means you may need to replace sooner than expected. Factor that in.',
  'use-more':     'Usage estimates tend to be optimistic. Consider a more conservative usage number.',
  'budget-risk':  'Sometimes the math says no, but life says yes. That\'s valid too.',
  'better-alt':   'Comparisons depend on estimates — real-world quality differences may shift the outcome.',
};

function _compoundFV(annualAmount, rate, years) {
  return annualAmount * ((Math.pow(1 + rate, years) - 1) / rate);
}

function _buildResultExtras(amount, isEmotional, type) {
  // type: 'savings' — yearly savings compounded (annuity FV)
  // type: 'price'   — purchase price opportunity cost (lump-sum FV)
  let html = '';
  const settings  = _cache[SETTINGS_KEY] || {};
  const dailyCost = Number(settings.dailyCost) || 0;
  const rate      = 0.07;

  if (amount > 0) {
    const label = type === 'savings'
      ? 'If you invested those annual savings at 7%/yr:'
      : `Time value — if you invested ${formatMoney(amount)} at 7%/yr instead:`;

    const v10 = type === 'savings' ? _compoundFV(amount, rate, 10) : amount * Math.pow(1 + rate, 10);
    const v20 = type === 'savings' ? _compoundFV(amount, rate, 20) : amount * Math.pow(1 + rate, 20);
    const v30 = type === 'savings' ? _compoundFV(amount, rate, 30) : amount * Math.pow(1 + rate, 30);

    html += `
      <div class="compound-box">
        <p class="compound-box__label">${label}</p>
        <div class="compound-box__grid">
          <div class="compound-stat"><span class="compound-stat__years">10 yrs</span><span class="compound-stat__val">${formatMoney(v10)}</span></div>
          <div class="compound-stat"><span class="compound-stat__years">20 yrs</span><span class="compound-stat__val">${formatMoney(v20)}</span></div>
          <div class="compound-stat"><span class="compound-stat__years">30 yrs</span><span class="compound-stat__val">${formatMoney(v30)}</span></div>
        </div>
      </div>`;

    if (dailyCost > 0) {
      const days = Math.floor(amount / dailyCost);
      if (days > 0) {
        const freedomText = type === 'savings'
          ? `Freedom earned: <strong>${days} day${days === 1 ? '' : 's'}</strong> of financial freedom per year`
          : `This purchase costs <strong>${days} day${days === 1 ? '' : 's'}</strong> of financial freedom`;
        html += `<p class="freedom-score">${freedomText}</p>`;
      }
    }
  }

  if (isEmotional) {
    html += `<div class="emotion-flag-banner">Some flags raised — you might be reacting emotionally. The numbers are still valid, but consider waiting 48 hours before deciding.</div>`;
  }

  return html;
}

/** Read a numeric input — returns 0 if blank or NaN */
function numVal(inputEl) {
  const v = parseFloat(inputEl.value);
  return isNaN(v) ? 0 : v;
}

// ─── Form helpers ─────────────────────────────────────────────────────────────

/** Collect all form values into a plain object */
function getFormValues() {
  return {
    productName:       fields.productName.value.trim(),
    productCost:       numVal(fields.productCost),
    alternativeCost:   numVal(fields.alternativeCost),
    frequencyPerMonth: numVal(fields.frequencyPerMonth),
    usagePerMonth:     numVal(fields.usagePerMonth),
    maintenanceCost:   numVal(fields.maintenanceCost),
    lifespanMonths:    numVal(fields.lifespanMonths),
  };
}

/** Fill the form fields from a saved/example data object */
function fillForm(data) {
  fields.productName.value       = data.productName       ?? '';
  fields.productCost.value       = data.productCost       ?? '';
  fields.alternativeCost.value   = data.alternativeCost   ?? '';
  fields.frequencyPerMonth.value = data.frequencyPerMonth ?? '';
  fields.usagePerMonth.value     = data.usagePerMonth     ?? '';
  fields.maintenanceCost.value   = data.maintenanceCost   || '';
  fields.lifespanMonths.value    = data.lifespanMonths    || '';
  clearErrors();
}

/** Clear all form fields and hide results */
function clearForm() {
  form.reset();
  clearErrors();
  hideResults();
}

// ─── Validation ───────────────────────────────────────────────────────────────

/** Show an error message under a field */
function showError(fieldId, message) {
  const errEl = document.getElementById(`err-${fieldId}`);
  const inputEl = fields[fieldId];
  if (errEl)   errEl.textContent = message;
  if (inputEl) inputEl.classList.add('input--error');
}

/** Clear a single field's error */
function clearFieldError(fieldId) {
  const errEl = document.getElementById(`err-${fieldId}`);
  const inputEl = fields[fieldId];
  if (errEl)   errEl.textContent = '';
  if (inputEl) inputEl.classList.remove('input--error');
}

/** Clear all error states */
function clearErrors() {
  ['productName', 'productCost', 'alternativeCost', 'frequencyPerMonth', 'usagePerMonth']
    .forEach(clearFieldError);
}

/** Validate required fields — returns true if valid */
function validateForm(data) {
  clearErrors();
  let valid = true;

  if (!data.productName) {
    showError('productName', 'Please enter a product name.');
    valid = false;
  }
  if (data.productCost <= 0) {
    showError('productCost', 'Enter a cost greater than $0.');
    valid = false;
  }
  if (data.alternativeCost <= 0) {
    showError('alternativeCost', 'Enter a cost greater than $0.');
    valid = false;
  }
  if (data.frequencyPerMonth <= 0) {
    showError('frequencyPerMonth', 'Enter how often you pay for the alternative.');
    valid = false;
  }
  if (data.usagePerMonth <= 0) {
    showError('usagePerMonth', 'Enter your expected uses per month.');
    valid = false;
  }

  return valid;
}

// ─── Core calculation ─────────────────────────────────────────────────────────

/**
 * Given user inputs, return all computed values plus a verdict.
 * Returns null if data is invalid.
 */
function calculate(data) {
  if (!validateForm(data)) return null;

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
  // usagePerMonth > 0 is guaranteed by validation, but guard anyway
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

// ─── Verdict copy ─────────────────────────────────────────────────────────────

const VERDICT_CONFIG = {
  'worth-it': {
    label: 'Worth it ✓',
    css:   'verdict-badge--worth-it',
    text:  'Great news — at your usage level this purchase pays for itself and keeps saving you money every year. Go for it.',
  },
  'consistent': {
    label: 'Conditionally worth it',
    css:   'verdict-badge--consistent',
    text:  'This can pay off, but only if you use it consistently. Make sure you\'ll actually stick with it before buying.',
  },
  'probably-not': {
    label: 'Probably not worth it',
    css:   'verdict-badge--probably-not',
    text:  'The numbers don\'t quite work out in year one. Consider whether you\'ll really use it enough to justify the upfront cost.',
  },
  'no-savings': {
    label: 'Does not pay for itself',
    css:   'verdict-badge--no-savings',
    text:  'The ongoing costs eat into — or exceed — what you\'d save, so this purchase doesn\'t pay for itself at current prices.',
  },
};

// ─── Display results ──────────────────────────────────────────────────────────

function showResults(data, calc, isEmotional = false) {
  const v = VERDICT_CONFIG[calc.verdict];

  // Header
  resultEls.productName.textContent = data.productName;

  // Badge
  resultEls.verdictBadge.textContent = v.label;
  resultEls.verdictBadge.className   = `verdict-badge ${v.css}`;

  // Stats
  resultEls.monthlyAlt.textContent     = formatMoney(calc.monthlyAlternativeCost);
  resultEls.monthlySavings.textContent = formatMoney(calc.netMonthlySavings);

  if (calc.breakEvenMonths === null) {
    resultEls.breakEven.textContent = 'No break-even';
  } else {
    const months = Math.ceil(calc.breakEvenMonths);
    resultEls.breakEven.textContent = `${months} month${months === 1 ? '' : 's'}`;
  }

  resultEls.yearly.textContent  = formatMoney(calc.yearlySavings);
  resultEls.perUse.textContent  = calc.costPerUse !== null ? formatMoney(calc.costPerUse) : 'N/A';

  // Verdict text + humility note
  resultEls.verdictText.textContent = v.text;
  const humilityEl = document.getElementById('humility-note');
  if (humilityEl) humilityEl.textContent = HUMILITY_NOTES[calc.verdict] || '';

  // Compounding, freedom score, emotional flag
  const extrasEl = document.getElementById('results-extras');
  if (extrasEl) extrasEl.innerHTML = _buildResultExtras(calc.yearlySavings, isEmotional, 'savings');

  // Show the card
  resultsSection.hidden = false;
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function hideResults() {
  resultsSection.hidden = true;
}

// ─── Emotional check modal ─────────────────────────────────────────────────────

function showEmotionModal(onContinue) {
  const modal = document.getElementById('emotion-modal');
  if (!modal) { onContinue(false); return; }

  document.querySelectorAll('.emotion-check').forEach(cb => { cb.checked = false; });
  const flagEl = document.getElementById('emotion-flag');
  if (flagEl) flagEl.hidden = true;
  modal.hidden = false;

  const continueBtn = document.getElementById('emotion-continue-btn');
  if (!continueBtn) { modal.hidden = true; onContinue(false); return; }

  const handler = () => {
    const uncheckedCount = [...document.querySelectorAll('.emotion-check')].filter(cb => !cb.checked).length;
    modal.hidden = true;
    continueBtn.removeEventListener('click', handler);
    onContinue(uncheckedCount >= 2);
  };
  continueBtn.addEventListener('click', handler);

  document.querySelectorAll('.emotion-check').forEach(cb => {
    cb.addEventListener('change', () => {
      const unchecked = [...document.querySelectorAll('.emotion-check')].filter(c => !c.checked).length;
      if (flagEl) flagEl.hidden = unchecked < 2;
    }, { once: false });
  });
}

// ─── Saved calculations storage ───────────────────────────────────────────────

function loadSaved() {
  return _cache[STORAGE_KEY];
}

function persistSaved(entries) {
  _cache[STORAGE_KEY] = entries;
  _fsSave(STORAGE_KEY, entries);
}

/** Save the current calculation result */
function saveCalculation(data, calc) {
  const entries = loadSaved();
  const entry = {
    id:                     Date.now().toString(),
    mode:                   'vs-service',
    productName:            data.productName,
    productCost:            data.productCost,
    alternativeCost:        data.alternativeCost,
    frequencyPerMonth:      data.frequencyPerMonth,
    usagePerMonth:          data.usagePerMonth,
    maintenanceCost:        data.maintenanceCost,
    lifespanMonths:         data.lifespanMonths,
    monthlyAlternativeCost: calc.monthlyAlternativeCost,
    netMonthlySavings:      calc.netMonthlySavings,
    breakEvenMonths:        calc.breakEvenMonths,
    yearlySavings:          calc.yearlySavings,
    costPerUse:             calc.costPerUse,
    verdict:                calc.verdict,
    createdAt:              new Date().toISOString(),
  };
  entries.unshift(entry); // newest first
  persistSaved(entries);
  renderSaved();
}

/** Delete a saved entry by id */
function deleteEntry(id) {
  const entries = loadSaved().filter(e => e.id !== id);
  persistSaved(entries);
  renderSaved();
}

/** Load a saved entry back into the form */
function loadEntryIntoForm(entry) {
  if (entry.mode === 'product-value') {
    setCalculatorMode('product-value');
    pvFields.name.value     = entry.name || entry.productName || '';
    pvFields.price.value    = entry.price ?? '';
    pvFields.brand.value    = entry.brand ?? '';
    pvFields.uses.value     = entry.uses ?? '';
    pvFields.lifespan.value = entry.lifespan ?? '';
    pvFields.altBrand.value = entry.altBrand ?? '';
    pvFields.altPrice.value = entry.altPrice ?? '';

    pvFields.brand.dispatchEvent(new Event('input'));
    pvFields.altBrand.dispatchEvent(new Event('input'));
    pvResults.hidden = true;
  } else {
    setCalculatorMode('vs-service');
    fillForm(entry);
  }

  document.getElementById('calculator').scrollIntoView({ behavior: 'smooth' });
}

// ─── Render saved list ────────────────────────────────────────────────────────

function renderSaved() {
  const entries = loadSaved();

  if (entries.length === 0) {
    savedListEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">📋</div>
        <p class="empty-state__text">No saved calculations yet.<br>Hit <strong>Save</strong> after calculating to store a result here.</p>
      </div>`;
    return;
  }

  savedListEl.innerHTML = entries.map(entry => {
    const isProductValue = entry.mode === 'product-value';
    const verdictConfig = isProductValue
      ? (PV_VERDICT_CONFIG[entry.verdict] || PV_VERDICT_CONFIG['decent'])
      : (VERDICT_CONFIG[entry.verdict] || VERDICT_CONFIG['probably-not']);

    const statsHtml = isProductValue
      ? `
        <div class="saved-card__stat">
          <span>Cost per use</span>
          <strong>${entry.costPerUse !== null ? formatMoney(entry.costPerUse) : 'N/A'}</strong>
        </div>
        <div class="saved-card__stat">
          <span>Monthly cost</span>
          <strong>${formatMoney(entry.monthlyCost || 0)}</strong>
        </div>
        <div class="saved-card__stat">
          <span>Lifespan</span>
          <strong>${entry.lifespan ? `${entry.lifespan} months` : 'N/A'}</strong>
        </div>`
      : `
        <div class="saved-card__stat">
          <span>Yearly savings</span>
          <strong>${formatMoney(entry.yearlySavings || 0)}</strong>
        </div>
        <div class="saved-card__stat">
          <span>Break-even</span>
          <strong>${entry.breakEvenMonths === null ? 'No break-even' : `${Math.ceil(entry.breakEvenMonths)} months`}</strong>
        </div>
        <div class="saved-card__stat">
          <span>Net monthly savings</span>
          <strong>${formatMoney(entry.netMonthlySavings || 0)}</strong>
        </div>`;

    return `
      <div class="saved-card" data-id="${entry.id}">
        <div class="saved-card__header">
          <span class="saved-card__name">${escapeHtml(entry.productName)}</span>
          <span class="saved-card__date">${formatDate(entry.createdAt)}</span>
        </div>
        <span class="saved-card__meta">${isProductValue ? 'Product Value' : 'vs. Alternative'}</span>
        <span class="saved-card__badge verdict-badge ${verdictConfig.css}">${verdictConfig.label}</span>
        <div class="saved-card__stats">
          ${statsHtml}
        </div>
        <div class="saved-card__actions">
          <button class="btn btn--secondary" data-action="load" data-id="${entry.id}">Load</button>
          <button class="btn btn--ghost" data-action="delete" data-id="${entry.id}">Delete</button>
        </div>
      </div>`;
  }).join('');
}

/** Simple HTML escaper to prevent XSS from saved product names */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Event listeners ──────────────────────────────────────────────────────────

// Track last successful calculation so Save can use it
let lastCalculation = null;
let lastData        = null;

// Bypass the emotional check modal for programmatic form dispatches
let _skipEmotionModal = false;

/** Calculate on form submit */
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = getFormValues();
  const calc = calculate(data);
  if (calc) {
    lastCalculation = calc;
    lastData        = data;
    showEmotionModal((isEmotional) => showResults(data, calc, isEmotional));
  }
});

/** Save button — requires a calculation to have been run first */
btnSave.addEventListener('click', () => {
  if (!lastCalculation || !lastData) {
    // Run the calculation first, then save if valid
    const data = getFormValues();
    const calc = calculate(data);
    if (!calc) return;
    lastCalculation = calc;
    lastData        = data;
    showResults(data, calc);
    saveCalculation(data, calc);
    return;
  }
  saveCalculation(lastData, lastCalculation);
});

/** Clear button */
btnClear.addEventListener('click', () => {
  clearForm();
  lastCalculation = null;
  lastData        = null;
});

/** Example cards — event delegation on the grid */
document.querySelector('.examples__grid').addEventListener('click', (e) => {
  const card = e.target.closest('.example-card');
  if (!card) return;
  const key = card.dataset.example;
  if (!EXAMPLES[key]) return;

  fillForm(EXAMPLES[key]);

  // Brief visual flash on the clicked card
  card.classList.add('example-card--active');
  setTimeout(() => card.classList.remove('example-card--active'), 700);

  // Status line above the calculator
  const statusEl = document.getElementById('example-load-status');
  if (statusEl) {
    statusEl.textContent = `Loaded: ${EXAMPLES[key].productName}`;
    statusEl.hidden = false;
    setTimeout(() => { statusEl.hidden = true; }, 2500);
  }

  document.getElementById('calculator').scrollIntoView({ behavior: 'smooth' });
});

/** Saved list actions — event delegation */
savedListEl.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const { action, id } = btn.dataset;

  if (action === 'delete') {
    deleteEntry(id);
  } else if (action === 'load') {
    const entries = loadSaved();
    const entry   = entries.find(en => en.id === id);
    if (entry) loadEntryIntoForm(entry);
  }
});

/** Clear per-field errors as the user types */
Object.keys(fields).forEach(fieldId => {
  fields[fieldId].addEventListener('input', () => clearFieldError(fieldId));
});

// ─── Wishlist ─────────────────────────────────────────────────────────────────

const wishlistForm        = document.getElementById('wishlist-form');
const wishlistListEl      = document.getElementById('wishlist-list');
const wishlistNameEl      = document.getElementById('wishlistName');
const wishlistPriceEl     = document.getElementById('wishlistPrice');
const wishlistNoteEl      = document.getElementById('wishlistNote');
const wishlistCategoryEl  = document.getElementById('wishlistCategory');
const wishlistUrlEl       = document.getElementById('wishlistUrl');
const btnFetchUrl     = document.getElementById('btn-fetch-url');
const fetchBtnText    = document.getElementById('fetch-btn-text');
const fetchStatus     = document.getElementById('fetch-status');
const productPreview  = document.getElementById('product-preview');
const previewImage    = document.getElementById('preview-image');
const previewName     = document.getElementById('preview-name');
const btnClearPreview = document.getElementById('btn-clear-preview');

// Smart analysis fields
const wishlistLifespanEl      = document.getElementById('wishlistLifespan');
const wishlistUsesPerMonthEl  = document.getElementById('wishlistUsesPerMonth');
const wishlistEventTagEl      = document.getElementById('wishlistEventTag');
const wishlistReplacesEl      = document.getElementById('wishlistReplacesRecurring');
const wishlistRecurringCostEl = document.getElementById('wishlistRecurringCost');
const wishlistRecurringField  = document.getElementById('wishlistRecurringCostField');

wishlistReplacesEl.addEventListener('change', () => {
  wishlistRecurringField.hidden = !wishlistReplacesEl.checked;
});

// Stores the image URL captured during a URL fetch so it can be saved with the item
let pendingImageUrl = null;

// ─── URL product fetcher ──────────────────────────────────────────────────────

// ─── Amazon helpers ───────────────────────────────────────────────────────────

/** Return true if the URL is an Amazon product page */
function isAmazonUrl(url) {
  return /amazon\.(com|co\.uk|ca|de|fr|it|es|co\.jp|in|com\.au)/i.test(url);
}

/**
 * Extract the ASIN (10-char product ID) from an Amazon URL.
 * Works for /dp/, /gp/product/, and direct /ASIN/ paths.
 */
function extractAsin(url) {
  const match = url.match(/\/(?:dp|gp\/product|ASIN)\/([A-Z0-9]{10})/i);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Amazon serves product images publicly via their CDN given just the ASIN.
 * This works in the browser without any server call.
 */
function amazonImageUrl(asin) {
  return `https://images-na.ssl-images-amazon.com/images/P/${asin}.01.LZZZZZZZ.jpg`;
}

// ─── Product fetch ────────────────────────────────────────────────────────────

/**
 * Main entry point — handles three cases:
 *   1. Amazon URL  → extract ASIN client-side, load image from CDN (no server needed)
 *   2. Other URL   → call /api/fetch-product (requires Vercel deployment)
 *   3. Local file  → /api/fetch-product returns 404 → show clear message
 */
async function fetchProductFromUrl(url) {
  // ── Case 1: Amazon ────────────────────────────────────────────────────────
  if (isAmazonUrl(url)) {
    const asin = extractAsin(url);
    if (!asin) throw new Error('Could not find an ASIN in that Amazon URL.');

    // Verify the image actually loads before returning it
    const imgUrl = amazonImageUrl(asin);
    const imageLoaded = await new Promise(resolve => {
      const img = new Image();
      img.onload  = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = imgUrl;
    });

    return {
      name:     null,          // Amazon blocks name scraping — user fills this in
      price:    null,          // Same for price
      imageUrl: imageLoaded ? imgUrl : null,
      _hint:    'amazon',      // Used below to show a tailored status message
    };
  }

  // ── Case 2 & 3: All other sites via Vercel serverless function ────────────
  const apiUrl = `/api/fetch-product?url=${encodeURIComponent(url)}`;
  let response;

  try {
    response = await fetch(apiUrl, { signal: AbortSignal.timeout(15000) });
  } catch {
    // fetch() itself threw — likely running as a local file with no server
    throw new Error('__no_server__');
  }

  // 404 means the API route doesn't exist (site not deployed to Vercel yet)
  if (response.status === 404) {
    throw new Error('__no_server__');
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Server returned ${response.status}`);
  }

  return await response.json(); // { name, price, imageUrl }
}

/** Show loading state on the Fetch button */
function setFetchLoading(loading) {
  if (loading) {
    fetchBtnText.innerHTML = '<span class="spinner"></span>';
    btnFetchUrl.disabled = true;
  } else {
    fetchBtnText.textContent = 'Fetch';
    btnFetchUrl.disabled = false;
  }
}

/** Show the product preview strip above the manual fields */
function showProductPreview(name, imageUrl) {
  previewName.textContent = name || '(name not found)';
  if (imageUrl) {
    previewImage.src = imageUrl;
    previewImage.hidden = false;
  } else {
    previewImage.hidden = true;
  }
  productPreview.hidden = false;
}

/** Hide and reset the product preview strip */
function clearProductPreview() {
  productPreview.hidden = true;
  previewImage.src = '';
  previewName.textContent = '';
  pendingImageUrl = null;
}

/** Fetch button click handler */
btnFetchUrl.addEventListener('click', async () => {
  const url = wishlistUrlEl.value.trim();
  if (!url) {
    fetchStatus.textContent = 'Paste a product URL above first.';
    fetchStatus.className = 'url-fetcher__hint url-fetcher__hint--err';
    return;
  }

  // Basic URL check
  try { new URL(url); } catch {
    fetchStatus.textContent = 'That doesn\'t look like a valid URL.';
    fetchStatus.className = 'url-fetcher__hint url-fetcher__hint--err';
    return;
  }

  setFetchLoading(true);
  fetchStatus.textContent = 'Fetching product info…';
  fetchStatus.className = 'url-fetcher__hint';
  clearProductPreview();

  try {
    const result = await fetchProductFromUrl(url);
    const { name, price, imageUrl, _hint } = result;

    // Fill in whatever we found
    if (name)  wishlistNameEl.value  = name;
    if (price) wishlistPriceEl.value = price;
    pendingImageUrl = imageUrl || null;

    if (_hint === 'amazon') {
      // Amazon: image only — name/price must be typed manually
      if (imageUrl) {
        showProductPreview('Amazon product', imageUrl);
        fetchStatus.textContent = 'Got the product image! Amazon blocks name & price fetching — please type them in below.';
        fetchStatus.className = 'url-fetcher__hint url-fetcher__hint--ok';
      } else {
        fetchStatus.textContent = 'Amazon link detected but image could not be loaded. Fill in the fields manually.';
        fetchStatus.className = 'url-fetcher__hint url-fetcher__hint--err';
      }
    } else {
      // General site: report what was and wasn't found
      const found   = [name && 'name', price && 'price', imageUrl && 'image'].filter(Boolean);
      const missing = [!name && 'name', !price && 'price', !imageUrl && 'image'].filter(Boolean);

      if (found.length === 0) {
        fetchStatus.textContent = 'Couldn\'t extract product info — this site may block fetching. Fill in the fields manually.';
        fetchStatus.className = 'url-fetcher__hint url-fetcher__hint--err';
      } else {
        fetchStatus.textContent = missing.length
          ? `Got: ${found.join(', ')}. Please fill in: ${missing.join(', ')}.`
          : 'All product info fetched!';
        fetchStatus.className = 'url-fetcher__hint url-fetcher__hint--ok';
        if (name || imageUrl) showProductPreview(name, imageUrl);
      }
    }

  } catch (err) {
    if (err.message === '__no_server__') {
      fetchStatus.innerHTML =
        'This feature needs the site deployed on Vercel. ' +
        'For now, fill in the fields manually — ' +
        '<strong>see the setup guide above for deployment steps.</strong>';
    } else {
      fetchStatus.textContent = `Could not fetch: ${err.message}. Fill in the fields manually.`;
    }
    fetchStatus.className = 'url-fetcher__hint url-fetcher__hint--err';
  } finally {
    setFetchLoading(false);
  }
});

/** Clear preview button */
btnClearPreview.addEventListener('click', () => {
  clearProductPreview();
  fetchStatus.textContent = '';
  fetchStatus.className = 'url-fetcher__hint';
});

// ─── Product name search (SerpAPI) ────────────────────────────────────────────

const btnSearchProduct  = document.getElementById('btn-search-product');
const searchBtnText     = document.getElementById('search-btn-text');
const searchStatus      = document.getElementById('search-status');
const searchResultsEl   = document.getElementById('search-results');
const wishlistSearchEl  = document.getElementById('wishlistSearch');

function setSearchLoading(loading) {
  if (loading) {
    searchBtnText.innerHTML = '<span class="spinner"></span>';
    btnSearchProduct.disabled = true;
  } else {
    searchBtnText.textContent = 'Search';
    btnSearchProduct.disabled = false;
  }
}

function applySearchResult(result) {
  if (result.name)  wishlistNameEl.value  = result.name;
  if (result.price) wishlistPriceEl.value = result.price;
  pendingImageUrl = result.imageUrl || null;
  if (result.name || result.imageUrl) showProductPreview(result.name, result.imageUrl);
}

function renderSearchResults(results) {
  if (!results || results.length <= 1) {
    searchResultsEl.hidden = true;
    return;
  }
  searchResultsEl.hidden = false;
  searchResultsEl.innerHTML = results.map((r, i) => `
    <button type="button" class="search-result-item" data-index="${i}">
      ${r.imageUrl ? `<img src="${escapeHtml(r.imageUrl)}" alt="" class="search-result-item__img" />` : ''}
      <span class="search-result-item__text">
        <span class="search-result-item__name">${escapeHtml(r.name || 'Unknown')}</span>
        ${r.price != null ? `<span class="search-result-item__price">${formatMoney(r.price)}</span>` : ''}
      </span>
    </button>
  `).join('');

  searchResultsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-index]');
    if (!btn) return;
    applySearchResult(results[Number(btn.dataset.index)]);
    searchResultsEl.hidden = true;
    searchStatus.textContent = 'Applied! Fill in any missing details below.';
    searchStatus.className = 'url-fetcher__hint url-fetcher__hint--ok';
  }, { once: true });
}

btnSearchProduct.addEventListener('click', async () => {
  const query = wishlistSearchEl.value.trim();
  if (!query) {
    searchStatus.textContent = 'Enter a product name to search.';
    searchStatus.className = 'url-fetcher__hint url-fetcher__hint--err';
    return;
  }

  setSearchLoading(true);
  searchStatus.textContent = 'Searching Google Shopping…';
  searchStatus.className = 'url-fetcher__hint';
  searchResultsEl.hidden = true;
  clearProductPreview();

  try {
    const res = await fetch(`/api/search-product?q=${encodeURIComponent(query)}`, {
      signal: AbortSignal.timeout(12000),
    });

    if (res.status === 404) {
      searchStatus.innerHTML =
        'Search requires the site to be deployed on Vercel with a <strong>SERP_API_KEY</strong> environment variable set.';
      searchStatus.className = 'url-fetcher__hint url-fetcher__hint--err';
      return;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Server returned ${res.status}`);
    }

    const data = await res.json();

    if (!data.name && !data.price) {
      searchStatus.textContent = 'No results found. Try a different search or fill in manually.';
      searchStatus.className = 'url-fetcher__hint url-fetcher__hint--err';
      return;
    }

    // Auto-apply the top result
    applySearchResult(data);

    // Show alternate picks if multiple results came back
    if (data.allResults && data.allResults.length > 1) {
      renderSearchResults(data.allResults);
      searchStatus.textContent = 'Top result applied — or pick a different one below.';
    } else {
      searchStatus.textContent = 'Found it! Fill in any missing details below.';
    }
    searchStatus.className = 'url-fetcher__hint url-fetcher__hint--ok';

  } catch (err) {
    searchStatus.textContent = `Search failed: ${err.message}`;
    searchStatus.className = 'url-fetcher__hint url-fetcher__hint--err';
  } finally {
    setSearchLoading(false);
  }
});

wishlistSearchEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); btnSearchProduct.click(); }
});

function loadWishlist() {
  return _cache[WISHLIST_KEY];
}

function persistWishlist(items) {
  _cache[WISHLIST_KEY] = items;
  _fsSave(WISHLIST_KEY, items);
}

/** Add a new item to the wishlist */
function addWishlistItem(name, price, note, imageUrl, analysisData, category, url) {
  const items = loadWishlist();
  items.unshift({
    id:                       Date.now().toString(),
    name:                     name.trim(),
    price:                    price || null,
    note:                     note.trim() || null,
    imageUrl:                 imageUrl || null,
    category:                 category || null,
    productUrl:               url || null,
    createdAt:                new Date().toISOString(),
    expected_lifespan:        analysisData ? (analysisData.lifespan || null) : null,
    uses_per_month:           analysisData ? (analysisData.usesPerMonth || null) : null,
    replaces_recurring_cost:  analysisData ? analysisData.replacesRecurring : false,
    recurring_cost_per_month: analysisData ? (analysisData.recurringCost || null) : null,
    event_tag:                analysisData ? (analysisData.eventTag || null) : null,
  });
  persistWishlist(items);
  renderWishlist();
  renderSmartInsights();
  renderMindsetWidgets();
}

/** Delete a wishlist item by id */
function deleteWishlistItem(id) {
  persistWishlist(loadWishlist().filter(item => item.id !== id));
  renderWishlist();
  renderSmartInsights();
  renderMindsetWidgets();
}

// Tracks which wishlist item is being edited (null = add mode)
let editingWishlistId = null;

/** Overwrite a wishlist item in-place, preserving id and createdAt */
function updateWishlistItem(id, name, price, note, imageUrl, analysisData, category, url) {
  const items = loadWishlist();
  const idx   = items.findIndex(i => i.id === id);
  if (idx === -1) return;
  items[idx] = {
    ...items[idx],
    name:                     name.trim(),
    price:                    price || null,
    note:                     note.trim() || null,
    imageUrl:                 imageUrl || items[idx].imageUrl,
    category:                 category || null,
    productUrl:               url || items[idx].productUrl || null,
    expected_lifespan:        analysisData.lifespan        || null,
    uses_per_month:           analysisData.usesPerMonth    || null,
    replaces_recurring_cost:  analysisData.replacesRecurring,
    recurring_cost_per_month: analysisData.recurringCost   || null,
    event_tag:                analysisData.eventTag        || null,
  };
  persistWishlist(items);
  renderWishlist();
  renderSmartInsights();
  renderMindsetWidgets();
}

/** Populate the wishlist form with an existing item and switch to edit mode */
function editWishlistItem(id) {
  const item = loadWishlist().find(i => i.id === id);
  if (!item) return;

  editingWishlistId = id;

  wishlistNameEl.value          = item.name;
  wishlistPriceEl.value         = item.price !== null ? item.price : '';
  wishlistNoteEl.value          = item.note  || '';
  wishlistCategoryEl.value      = item.category || '';
  wishlistUrlEl.value           = item.productUrl || '';
  wishlistLifespanEl.value      = item.expected_lifespan        || '';
  wishlistUsesPerMonthEl.value  = item.uses_per_month           || '';
  wishlistEventTagEl.value      = item.event_tag                || '';
  wishlistReplacesEl.checked    = item.replaces_recurring_cost  || false;
  wishlistRecurringField.hidden = !item.replaces_recurring_cost;
  wishlistRecurringCostEl.value = item.recurring_cost_per_month || '';

  if (item.imageUrl) {
    pendingImageUrl = item.imageUrl;
    showProductPreview(item.name, item.imageUrl);
  }

  document.getElementById('wishlist-submit-btn').textContent    = 'Update Item';
  document.getElementById('wishlist-cancel-edit').hidden        = false;
  document.getElementById('wishlist-submit-status').hidden      = true;

  document.getElementById('wishlist').scrollIntoView({ behavior: 'smooth' });
  setTimeout(() => wishlistNameEl.focus(), 400);
}

/** Reset the wishlist form back to add mode */
function cancelWishlistEdit() {
  editingWishlistId = null;
  wishlistForm.reset();
  wishlistRecurringField.hidden = true;
  clearProductPreview();
  fetchStatus.textContent = '';
  fetchStatus.className   = 'url-fetcher__hint';
  document.getElementById('wishlist-submit-btn').textContent = 'Add to Wishlist';
  document.getElementById('wishlist-cancel-edit').hidden     = true;
  document.getElementById('wishlist-submit-status').hidden   = true;
}

/** Show a brief confirmation banner after a new item is added */
function showWishlistConfirmation(name) {
  const statusEl = document.getElementById('wishlist-submit-status');
  statusEl.textContent = `✓ "${name}" added to your wishlist`;
  statusEl.hidden = false;
  setTimeout(() => { statusEl.hidden = true; }, 3000);

  // Briefly highlight the freshly prepended card
  setTimeout(() => {
    const newCard = wishlistListEl.querySelector('.wishlist-card');
    if (newCard) {
      newCard.classList.add('wishlist-card--new');
      newCard.addEventListener('animationend', () => newCard.classList.remove('wishlist-card--new'), { once: true });
    }
  }, 60);
}

/** Load a wishlist item into the Product Value calculator and run the analysis */
function calculateWishlistItem(id) {
  const item = loadWishlist().find(i => i.id === id);
  if (!item) return;

  // Switch to Product Value tab
  setCalculatorMode('product-value');

  // Reset manual-edit flag so auto-detect can run
  pvFields.brand._manuallyEdited = false;

  // Product name
  pvFields.name.value = item.name;

  // Auto-detect brand from name → fills brand + lifespan + rep card
  const brandKey = detectBrandFromName(item.name);
  if (brandKey) {
    applyDetectedBrand(brandKey, true);
  } else {
    pvFields.brand.value = '';
    repCard.hidden = true;
    document.getElementById('pv-brand-badge').hidden = true;
  }

  // Price
  pvFields.price.value = item.price !== null ? item.price : '';
  document.getElementById('pv-price-badge').hidden = item.price === null;

  // Lifespan — prefer the saved wishlist value over the brand default
  if (item.expected_lifespan) {
    pvFields.lifespan.value = item.expected_lifespan;
    document.getElementById('pv-lifespan-hint').textContent = 'Loaded from your wishlist';
    document.getElementById('pv-lifespan-badge').hidden = false;
  }

  // Usage — if saved as monthly, set the toggle to "per month"
  if (item.uses_per_month) {
    pvUsagePeriod = 'month';
    pvFields.uses.value = item.uses_per_month;
  } else {
    pvUsagePeriod = 'week';
    pvFields.uses.value = '';
  }
  document.querySelectorAll('.pv-period-btn').forEach(b => {
    b.classList.toggle('pv-period-btn--active', b.dataset.period === pvUsagePeriod);
  });

  // Clear any previous results / errors
  pvResults.hidden = true;
  lastPvCalc = null;
  lastPvData = null;

  // Status hint
  const statusEl = document.getElementById('pv-autofill-status');
  statusEl.textContent = 'Loaded from your wishlist — review the details and hit Calculate.';
  statusEl.className = 'field__hint pv-autofill-status--ok';

  // Scroll to calculator
  document.getElementById('calculator').scrollIntoView({ behavior: 'smooth' });

  // If all required fields are present, auto-calculate after scroll lands
  const hasAll = item.name && item.price &&
                 pvFields.brand.value && pvFields.lifespan.value && pvFields.uses.value;
  if (hasAll) {
    setTimeout(() => {
      _skipEmotionModal = true;
      pvForm.dispatchEvent(new Event('submit', { cancelable: true }));
    }, 650);
  } else {
    // Focus the first field still needing a value
    setTimeout(() => {
      if (!pvFields.price.value)    { pvFields.price.focus(); return; }
      if (!pvFields.brand.value)    { pvFields.brand.focus(); return; }
      if (!pvFields.uses.value)     { pvFields.uses.focus();  return; }
      if (!pvFields.lifespan.value) { pvFields.lifespan.focus(); }
    }, 450);
  }
}

// Active category filter — 'All' means show everything
let activeWishlistFilter = 'All';

/** Render category filter pills above the wishlist list */
function renderWishlistFilters(allItems) {
  const filtersEl  = document.getElementById('wishlist-filters');
  const categories = [...new Set(allItems.map(i => i.category).filter(Boolean))];

  if (categories.length < 2) { filtersEl.hidden = true; return; }

  filtersEl.hidden   = false;
  filtersEl.innerHTML = ['All', ...categories].map(cat => `
    <button class="wishlist-filter-btn${cat === activeWishlistFilter ? ' wishlist-filter-btn--active' : ''}"
            data-filter="${escapeHtml(cat)}">${escapeHtml(cat)}</button>
  `).join('');
}

/** Render the wishlist section */
function renderWishlist() {
  const allItems = loadWishlist();

  renderWishlistFilters(allItems);

  if (allItems.length === 0) {
    wishlistListEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">🛍️</div>
        <p class="empty-state__text">Your wishlist is empty.<br>Add something you've been eyeing and decide if it's worth it.</p>
      </div>`;
    return;
  }

  const items = activeWishlistFilter === 'All'
    ? allItems
    : allItems.filter(i => i.category === activeWishlistFilter);

  if (items.length === 0) {
    wishlistListEl.innerHTML = `<p class="insights-hint" style="padding:var(--space-md) 0">No items in the <strong>${escapeHtml(activeWishlistFilter)}</strong> category.</p>`;
    return;
  }

  const _ws        = _cache[SETTINGS_KEY] || {};
  const _monthlyExp = Number(_ws.monthlyExp) || 0;
  const _wsSavings  = Number(_ws.savings)    || 0;
  const _runway     = (_monthlyExp > 0 && _wsSavings > 0) ? _wsSavings / _monthlyExp : null;

  wishlistListEl.innerHTML = items.map(item => {
    const imageHtml = item.imageUrl
      ? `<img class="wishlist-card__image" src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}" loading="lazy" onerror="this.style.display='none'" />`
      : '';

    const priceHtml = item.price !== null
      ? `<span class="wishlist-card__price">${formatMoney(item.price)}</span>`
      : `<span class="wishlist-card__price" style="color:var(--clr-text-muted);font-size:0.85rem;">No price set</span>`;

    const runwayHtml = (_runway !== null && item.price && _monthlyExp > 0) ? (() => {
      const daysLost = Math.round((item.price / _monthlyExp) * 30);
      if (daysLost < 1) return '';
      const thin = _runway < 3;
      return `<p class="wishlist-card__runway${thin ? ' wishlist-card__runway--warn' : ''}">~${daysLost} day${daysLost === 1 ? '' : 's'} of runway${thin ? ' · runway is thin' : ''}</p>`;
    })() : '';

    // Avoid wrapping in hardcoded quotes — use CSS quotes instead
    const noteHtml = item.note
      ? `<p class="wishlist-card__note">${escapeHtml(item.note)}</p>`
      : '';

    const categoryHtml = item.category
      ? `<span class="wishlist-card__category">${escapeHtml(item.category)}</span>`
      : '';

    const hasSmartData = item.uses_per_month || item.expected_lifespan ||
                         item.replaces_recurring_cost || item.event_tag;
    const smartPromptHtml = !hasSmartData
      ? `<p class="wishlist-card__smart-prompt">Add usage details to unlock Buy / Wait / Skip insights ↓</p>`
      : '';

    return `
      <div class="wishlist-card" data-id="${item.id}">
        ${imageHtml}
        <div class="wishlist-card__header">
          <span class="wishlist-card__name">${escapeHtml(item.name)}</span>
          <span class="wishlist-card__date">${formatDate(item.createdAt)}</span>
        </div>
        ${categoryHtml}
        ${priceHtml}
        ${runwayHtml}
        ${noteHtml}
        ${smartPromptHtml}
        <div class="wishlist-card__actions">
          <button class="btn btn--primary"   data-waction="calculate" data-id="${item.id}">Calculate it</button>
          <button class="btn btn--secondary" data-waction="edit"      data-id="${item.id}">Edit</button>
          ${item.productUrl ? `<a href="${escapeHtml(item.productUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn--ghost">Link ↗</a>` : ''}
          <button class="btn btn--ghost"     data-waction="delete"    data-id="${item.id}">Remove</button>
        </div>
      </div>`;
  }).join('');
}

// Category filter pill clicks
document.getElementById('wishlist-filters').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-filter]');
  if (!btn) return;
  activeWishlistFilter = btn.dataset.filter;
  renderWishlist();
});

/** Wishlist form submit — handles both add and edit modes */
wishlistForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name     = wishlistNameEl.value.trim();
  const price    = parseFloat(wishlistPriceEl.value) || null;
  const note     = wishlistNoteEl.value.trim();
  const category = wishlistCategoryEl.value || null;

  const errEl = document.getElementById('err-wishlistName');
  if (!name) {
    errEl.textContent = 'Please enter an item name.';
    wishlistNameEl.classList.add('input--error');
    return;
  }
  errEl.textContent = '';
  wishlistNameEl.classList.remove('input--error');

  const analysisData = {
    lifespan:          parseFloat(wishlistLifespanEl.value)       || null,
    usesPerMonth:      parseFloat(wishlistUsesPerMonthEl.value)   || null,
    replacesRecurring: wishlistReplacesEl.checked,
    recurringCost:     parseFloat(wishlistRecurringCostEl.value)  || null,
    eventTag:          wishlistEventTagEl.value.trim()            || null,
  };

  const productUrl = wishlistUrlEl.value.trim() || null;

  if (editingWishlistId) {
    updateWishlistItem(editingWishlistId, name, price, note, pendingImageUrl, analysisData, category, productUrl);
    showToast('Item updated', 'ok');
  } else {
    addWishlistItem(name, price, note, pendingImageUrl, analysisData, category, productUrl);
    showWishlistConfirmation(name);
  }

  // Reset form and state
  editingWishlistId = null;
  wishlistForm.reset();
  wishlistRecurringField.hidden = true;
  clearProductPreview();
  fetchStatus.textContent = '';
  fetchStatus.className   = 'url-fetcher__hint';
  document.getElementById('wishlist-submit-btn').textContent = 'Add to Wishlist';
  document.getElementById('wishlist-cancel-edit').hidden     = true;
});

// Clear wishlist name error on input
wishlistNameEl.addEventListener('input', () => {
  document.getElementById('err-wishlistName').textContent = '';
  wishlistNameEl.classList.remove('input--error');
});

/** Wishlist list actions — event delegation */
wishlistListEl.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-waction]');
  if (!btn) return;
  const { waction, id } = btn.dataset;
  if (waction === 'delete')    deleteWishlistItem(id);
  if (waction === 'calculate') calculateWishlistItem(id);
  if (waction === 'edit')      editWishlistItem(id);
});

document.getElementById('wishlist-cancel-edit').addEventListener('click', cancelWishlistEdit);

// ─── Smart Wishlist Insights ──────────────────────────────────────────────────

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

function _siReason(decision, m, eventMatch) {
  const $$ = v => v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
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

let _biasCardDismissed = false;

function _getBiasAwareness() {
  if (_biasCardDismissed) return null;
  const entries = loadSaved();
  const positives = entries.filter(e => ['worth-it', 'excellent', 'consistent', 'decent'].includes(e.verdict)).length;
  const negatives = entries.filter(e => ['probably-not', 'no-savings', 'budget-risk', 'use-more', 'better-alt'].includes(e.verdict)).length;
  const total = positives + negatives;
  if (total < 5) return null;
  if (positives / total >= 0.8) {
    return { type: 'optimist', message: 'Pattern noticed: you tend to see most things as "Worth It". Everyone\'s financial lens is shaped by their past — if you grew up comfortable, you may naturally underestimate risk. Not wrong, just worth knowing.' };
  }
  if (negatives / total >= 0.8) {
    return { type: 'avoider', message: 'Pattern noticed: you rarely see purchases as "Worth It". If you grew up with financial stress, you may avoid genuinely good investments out of habit. Not wrong — just worth noticing.' };
  }
  return null;
}

function renderSmartInsights() {
  const el = document.getElementById('insights-content');
  if (!el) return;

  if (!el._biasListenerAdded) {
    el.addEventListener('click', (e) => {
      if (e.target.matches('.bias-card__dismiss')) {
        _biasCardDismissed = true;
        el.querySelector('.bias-card')?.remove();
      }
    });
    el._biasListenerAdded = true;
  }

  const wishlistItems  = loadWishlist();
  const calendarEvents = loadCalendarEvents();
  const biasInfo       = _getBiasAwareness();
  const biasHtml       = biasInfo
    ? `<div class="bias-card"><button class="bias-card__dismiss" aria-label="Dismiss">✕</button><p class="bias-card__text">${biasInfo.message}</p></div>`
    : '';

  if (wishlistItems.length === 0) {
    el.innerHTML = biasHtml + '<p class="insights-hint">Add items to your wishlist to see Smart Insights.</p>';
    return;
  }

  const hasData = wishlistItems.some(item =>
    item.uses_per_month || item.expected_lifespan ||
    item.replaces_recurring_cost || item.event_tag
  );

  if (!hasData) {
    el.innerHTML = biasHtml + `<p class="insights-hint">Expand <strong>Smart analysis details</strong> on any wishlist item to unlock Buy / Wait / Skip insights.</p>`;
    return;
  }

  const insights = analyzeWishlist(wishlistItems, calendarEvents);
  const groups = {
    'Buy Now':      insights.filter(i => i.decision === 'Buy Now'),
    'Wait':         insights.filter(i => i.decision === 'Wait'),
    'Not Worth It': insights.filter(i => i.decision === 'Not Worth It'),
  };

  const $$ = v => v === null
    ? 'N/A'
    : v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

  const badgeClass = {
    'Buy Now':      'insight-badge--buy',
    'Wait':         'insight-badge--wait',
    'Not Worth It': 'insight-badge--no',
  };

  el.innerHTML = biasHtml + ['Buy Now', 'Wait', 'Not Worth It'].map(decision => {
    const items = groups[decision];
    if (items.length === 0) return '';
    return `
      <section class="insights-group">
        <h3 class="insights-group__title">${decision}</h3>
        <div class="insights-grid">
          ${items.map(item => `
            <article class="insight-card">
              <div class="insight-card__header">
                <h4 class="insight-card__name">${escapeHtml(item.name)}</h4>
                <span class="insight-badge ${badgeClass[item.decision]}">${item.decision}</span>
              </div>
              <p class="insight-card__reason">${escapeHtml(item.reason)}</p>
              <dl class="insight-metrics">
                <div>
                  <dt>Cost per use</dt>
                  <dd>${$$(item.metrics.cost_per_use)}</dd>
                </div>
                <div>
                  <dt>Payback</dt>
                  <dd>${item.metrics.payback_months === null ? 'N/A' : item.metrics.payback_months + ' mo'}</dd>
                </div>
              </dl>
            </article>
          `).join('')}
        </div>
      </section>`;
  }).join('');
}

// ─── Money Mindset: widgets ───────────────────────────────────────────────────

function renderMindsetWidgets() {
  const container = document.getElementById('mindset-widgets');
  if (!container) return;

  const s           = _cache[SETTINGS_KEY] || {};
  const savings     = Number(s.savings)       || 0;
  const earmarked   = Number(s.earmarked)     || 0;
  const monthlyExp  = Number(s.monthlyExp)    || 0;
  const budget      = Number(s.discretionary) || 0;
  const wishlistTotal = loadWishlist().reduce((sum, item) => sum + (Number(item.price) || 0), 0);

  const hasAny = savings > 0 || monthlyExp > 0 || budget > 0;
  if (!hasAny) {
    container.innerHTML = '<p class="insights-hint">Fill in your financial profile above to see runway, flexibility fund, and "enough" budget insights.</p>';
    return;
  }

  let html = '<div class="mindset-widgets-grid">';

  // Feature 7: Flexibility Fund
  if (savings > 0) {
    const flex    = Math.max(0, savings - earmarked);
    const noFlex  = flex === 0;
    html += `
      <div class="mindset-widget">
        <div class="mindset-widget__icon">🛟</div>
        <div class="mindset-widget__body">
          <h4 class="mindset-widget__title">Flexibility Fund</h4>
          <p class="mindset-widget__desc">Savings with no job — your options, your freedom.</p>
          <p class="mindset-widget__amount${noFlex ? ' mindset-widget__amount--warn' : ''}">${formatMoney(flex)}</p>
          <p class="mindset-widget__sub">unallocated savings</p>
          ${earmarked > 0 ? `<p class="mindset-widget__meta">${formatMoney(savings)} total − ${formatMoney(earmarked)} earmarked</p>` : ''}
          ${noFlex ? '<p class="mindset-widget__alert">All your savings have a job — keep some unassigned for life\'s surprises.</p>' : ''}
        </div>
      </div>`;
  }

  // Feature 5: Financial Runway
  if (savings > 0 && monthlyExp > 0) {
    const runway      = savings / monthlyExp;
    const amtClass    = runway < 3 ? ' mindset-widget__amount--warn' : runway >= 6 ? ' mindset-widget__amount--good' : '';
    html += `
      <div class="mindset-widget">
        <div class="mindset-widget__icon">⏱️</div>
        <div class="mindset-widget__body">
          <h4 class="mindset-widget__title">Financial Runway</h4>
          <p class="mindset-widget__desc">How long you could go without income.</p>
          <p class="mindset-widget__amount${amtClass}">${runway.toFixed(1)} months</p>
          <p class="mindset-widget__sub">at ${formatMoney(monthlyExp)}/mo expenses</p>
          ${runway < 3 ? '<p class="mindset-widget__alert">Under 3 months — not the best time for non-essential purchases.</p>' : ''}
          ${runway >= 6 ? '<p class="mindset-widget__note-good">Solid runway — room for considered purchases.</p>' : ''}
        </div>
      </div>`;
  }

  // Feature 4: "Enough" Budget
  if (budget > 0) {
    const gap    = wishlistTotal - budget;
    const isOver = gap > 0;
    html += `
      <div class="mindset-widget">
        <div class="mindset-widget__icon">🎯</div>
        <div class="mindset-widget__body">
          <h4 class="mindset-widget__title">Your "Enough" Budget</h4>
          <p class="mindset-widget__desc">Monthly limit vs. your wishlist total.</p>
          <div class="mindset-enough-row">
            <div class="mindset-enough-col">
              <span class="mindset-enough-col__val">${formatMoney(budget)}</span>
              <span class="mindset-enough-col__label">your limit</span>
            </div>
            <span class="mindset-enough-sep">vs.</span>
            <div class="mindset-enough-col${isOver ? ' mindset-enough-col--over' : ''}">
              <span class="mindset-enough-col__val">${formatMoney(wishlistTotal)}</span>
              <span class="mindset-enough-col__label">wishlist total</span>
            </div>
          </div>
          ${isOver
            ? `<p class="mindset-widget__alert">You're ${formatMoney(gap)} over your "enough" limit — worth prioritizing.</p>`
            : `<p class="mindset-widget__note-good">Wishlist is within your "enough" budget.</p>`}
        </div>
      </div>`;
  }

  html += '</div>';
  container.innerHTML = html;
}

// ─── Money Mindset: profile form ──────────────────────────────────────────────

function loadProfileSettings() {
  const s = _cache[SETTINGS_KEY] || {};
  [
    ['profile-daily-cost',    'dailyCost'],
    ['profile-monthly-exp',   'monthlyExp'],
    ['profile-savings',       'savings'],
    ['profile-earmarked',     'earmarked'],
    ['profile-discretionary', 'discretionary'],
  ].forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el && s[key]) el.value = s[key];
  });
}

document.getElementById('profile-save-btn').addEventListener('click', () => {
  _cache[SETTINGS_KEY] = {
    dailyCost:     parseFloat(document.getElementById('profile-daily-cost').value)    || 0,
    monthlyExp:    parseFloat(document.getElementById('profile-monthly-exp').value)   || 0,
    savings:       parseFloat(document.getElementById('profile-savings').value)       || 0,
    earmarked:     parseFloat(document.getElementById('profile-earmarked').value)     || 0,
    discretionary: parseFloat(document.getElementById('profile-discretionary').value) || 0,
  };
  _fsSave(SETTINGS_KEY, _cache[SETTINGS_KEY]);

  const statusEl = document.getElementById('profile-save-status');
  if (statusEl) {
    statusEl.textContent = '✓ Profile saved';
    statusEl.hidden = false;
    setTimeout(() => { statusEl.hidden = true; }, 2500);
  }

  renderMindsetWidgets();
  renderWishlist();
});

// ─── Calculator mode tabs ────────────────────────────────────────────────────

const modeVsService    = document.getElementById('mode-vs-service');
const modeProductValue = document.getElementById('mode-product-value');
let currentMode = 'vs-service';

function setCalculatorMode(mode) {
  currentMode = mode;

  document.querySelectorAll('.calc-tab').forEach(t => {
    const active = t.dataset.mode === mode;
    t.classList.toggle('calc-tab--active', active);
    t.setAttribute('aria-selected', active);
  });

  modeVsService.hidden    = mode !== 'vs-service';
  modeProductValue.hidden = mode !== 'product-value';
}

document.querySelector('.calc-tabs').addEventListener('click', (e) => {
  const tab = e.target.closest('.calc-tab');
  if (!tab) return;
  const mode = tab.dataset.mode;
  if (mode === currentMode) return;
  setCalculatorMode(mode);
});

// ─── Brand Reputation Database ────────────────────────────────────────────────

/**
 * Key: lowercase brand name.
 * score: 1–5 quality rating
 * label: short descriptor shown in the UI
 * note: one-sentence explanation shown to the user
 * lifespanMonths: typical lifespan used as the default suggestion
 */
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
  'zara':            { score: 3.0, label: 'Budget fragrance',       note: 'Decent dupes at low prices — lighter longevity.',      lifespanMonths: 6  },
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

/** Return a color string based on score */
function scoreColor(score) {
  if (score >= 4.5) return 'var(--clr-green)';
  if (score >= 3.5) return '#6fa86f';
  if (score >= 2.5) return 'var(--clr-yellow)';
  if (score >= 1.5) return '#c08040';
  return 'var(--clr-red)';
}

/** Render five dots (filled / empty) for a given score */
function reputationDots(score, color) {
  const filled = Math.round(score);
  return Array.from({ length: 5 }, (_, i) =>
    `<span class="rep-dot ${i < filled ? 'rep-dot--filled' : ''}" style="--rep-color:${color}"></span>`
  ).join('');
}

// ─── Product Value: DOM refs ──────────────────────────────────────────────────

const pvForm        = document.getElementById('pv-form');
const pvFields      = {
  name:     document.getElementById('pv-name'),
  price:    document.getElementById('pv-price'),
  brand:    document.getElementById('pv-brand'),
  uses:     document.getElementById('pv-uses'),
  lifespan: document.getElementById('pv-lifespan'),
  altBrand: document.getElementById('pv-alt-brand'),
  altPrice: document.getElementById('pv-alt-price'),
};
const repCard       = document.getElementById('reputation-card');
const repCardAlt    = document.getElementById('reputation-card-alt');
const pvResults     = document.getElementById('pv-results');

// ─── Product Value: brand lookup → populate reputation card ──────────────────

function showRepCard(brand, cardEl, dotsEl, scoreEl, labelEl, noteEl, lifespanEl) {
  const info = lookupBrand(brand);
  if (!info) { cardEl.hidden = true; return null; }

  const color = scoreColor(info.score);
  dotsEl.innerHTML   = reputationDots(info.score, color);
  scoreEl.textContent = `${info.score}/5`;
  scoreEl.style.color = color;
  labelEl.textContent = info.label;
  if (noteEl)     noteEl.textContent = info.note;
  if (lifespanEl) lifespanEl.textContent = `Typical lifespan: ~${info.lifespanMonths} months`;

  cardEl.hidden = false;
  return info;
}

// ─── Product Value: brand / name auto-detect helpers ─────────────────────────

/** Scan BRANDS keys against a product name string; returns the best-matching key or null */
function detectBrandFromName(name) {
  if (!name) return null;
  const lower = name.toLowerCase();
  let bestKey = null, bestLen = 0;
  for (const key of Object.keys(BRANDS)) {
    if (lower.includes(key) && key.length > bestLen) {
      bestKey = key;
      bestLen = key.length;
    }
  }
  return bestKey;
}

/** Apply a detected brand key to the brand field + lifespan + rep card */
function applyDetectedBrand(key, markAsAutoDetected) {
  const info = BRANDS[key];
  if (!info) return;
  const displayName = key.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  pvFields.brand.value = displayName;
  document.getElementById('pv-brand-badge').hidden = !markAsAutoDetected;

  showRepCard(
    pvFields.brand.value,
    repCard,
    document.getElementById('rep-dots'),
    document.getElementById('rep-score'),
    document.getElementById('rep-label'),
    document.getElementById('rep-note'),
    document.getElementById('rep-lifespan'),
  );

  if (!pvFields.lifespan.value) {
    pvFields.lifespan.value = info.lifespanMonths;
    document.getElementById('pv-lifespan-hint').textContent =
      `Auto-filled from ${displayName} reputation data`;
    document.getElementById('pv-lifespan-badge').hidden = false;
  }
}

// Product name input → auto-detect brand as user types
pvFields.name.addEventListener('input', () => {
  document.getElementById('err-pv-name').textContent = '';
  pvFields.name.classList.remove('input--error');

  const key = detectBrandFromName(pvFields.name.value);
  if (key && !pvFields.brand._manuallyEdited) {
    applyDetectedBrand(key, true);
    const statusEl = document.getElementById('pv-autofill-status');
    statusEl.textContent = `Brand detected: ${pvFields.brand.value}. Lifespan auto-filled. Just enter your usage below.`;
    statusEl.className = 'field__hint pv-autofill-status--ok';
  }
});

// Mark brand field as manually edited so auto-detect doesn't override it
pvFields.brand.addEventListener('input', () => {
  pvFields.brand._manuallyEdited = true;
  document.getElementById('pv-brand-badge').hidden = true;

  const info = showRepCard(
    pvFields.brand.value,
    repCard,
    document.getElementById('rep-dots'),
    document.getElementById('rep-score'),
    document.getElementById('rep-label'),
    document.getElementById('rep-note'),
    document.getElementById('rep-lifespan'),
  );
  if (info && !pvFields.lifespan.value) {
    pvFields.lifespan.value = info.lifespanMonths;
    document.getElementById('pv-lifespan-hint').textContent =
      `Auto-filled from ${pvFields.brand.value.trim()} reputation data`;
    document.getElementById('pv-lifespan-badge').hidden = false;
  }
  document.getElementById('err-pv-brand').textContent = '';
  pvFields.brand.classList.remove('input--error');
});

// Alt brand input
pvFields.altBrand.addEventListener('input', () => {
  showRepCard(
    pvFields.altBrand.value,
    repCardAlt,
    document.getElementById('rep-alt-dots'),
    document.getElementById('rep-alt-score'),
    document.getElementById('rep-alt-label'),
    null, null,
  );
});

// ─── Product Value: AI Fill button ────────────────────────────────────────────

const pvAutofillStatusEl  = document.getElementById('pv-autofill-status');
const pvAutofillBtnText   = document.getElementById('pv-autofill-btn-text');
const pvAutofillBtn       = document.getElementById('pv-btn-autofill');

function setPvAutofillLoading(loading) {
  if (loading) {
    pvAutofillBtnText.innerHTML = '<span class="spinner"></span>';
    pvAutofillBtn.disabled = true;
  } else {
    pvAutofillBtnText.textContent = '✨ AI Fill';
    pvAutofillBtn.disabled = false;
  }
}

pvAutofillBtn.addEventListener('click', async () => {
  const query = pvFields.name.value.trim();
  if (!query) {
    pvAutofillStatusEl.textContent = 'Enter a product name first.';
    pvAutofillStatusEl.className = 'field__hint pv-autofill-status--err';
    return;
  }

  setPvAutofillLoading(true);
  pvAutofillStatusEl.textContent = 'Searching for product…';
  pvAutofillStatusEl.className = 'field__hint';

  try {
    const res = await fetch(`/api/search-product?q=${encodeURIComponent(query)}`, {
      signal: AbortSignal.timeout(12000),
    });

    if (res.status === 404) {
      pvAutofillStatusEl.innerHTML = 'AI Fill needs the site deployed on Vercel. Enter price manually.';
      pvAutofillStatusEl.className = 'field__hint pv-autofill-status--err';
      return;
    }
    if (!res.ok) throw new Error(`Server returned ${res.status}`);

    const data = await res.json();
    const filled = [];

    if (data.price) {
      pvFields.price.value = data.price;
      document.getElementById('pv-price-badge').hidden = false;
      filled.push('price');
    }

    // Auto-detect brand from returned product name if brand not yet set
    const nameToCheck = data.name || query;
    if (!pvFields.brand._manuallyEdited) {
      const key = detectBrandFromName(nameToCheck);
      if (key) { applyDetectedBrand(key, true); filled.push('brand', 'lifespan'); }
    }

    pvAutofillStatusEl.textContent = filled.length
      ? `Auto-filled: ${filled.join(', ')}. Just enter your usage below.`
      : 'No results found — fill in brand and price manually.';
    pvAutofillStatusEl.className = filled.length
      ? 'field__hint pv-autofill-status--ok'
      : 'field__hint pv-autofill-status--err';

  } catch {
    pvAutofillStatusEl.textContent = 'Could not fetch product info — enter price manually.';
    pvAutofillStatusEl.className = 'field__hint pv-autofill-status--err';
  } finally {
    setPvAutofillLoading(false);
  }
});

// ─── Product Value: week / month usage toggle ─────────────────────────────────

let pvUsagePeriod = 'week'; // 'week' | 'month'

document.querySelector('.pv-period-toggle').addEventListener('click', (e) => {
  const btn = e.target.closest('.pv-period-btn');
  if (!btn) return;
  pvUsagePeriod = btn.dataset.period;
  document.querySelectorAll('.pv-period-btn').forEach(b => {
    b.classList.toggle('pv-period-btn--active', b.dataset.period === pvUsagePeriod);
  });
});

// ─── Product Value: calculation ───────────────────────────────────────────────

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

const PV_VERDICT_CONFIG = {
  'excellent': {
    label: 'Excellent investment ✓',
    css:   'verdict-badge--worth-it',
    text:  'Quality brand, low cost per use — this is exactly what a smart purchase looks like.',
  },
  'worth-it': {
    label: 'Worth it ✓',
    css:   'verdict-badge--worth-it',
    text:  'Solid quality with reasonable cost per use. You\'re getting good value here.',
  },
  'decent': {
    label: 'Decent value',
    css:   'verdict-badge--consistent',
    text:  'Mid-tier brand at a fair cost per use. Will do the job — just don\'t expect it to last as long as a premium option.',
  },
  'use-more': {
    label: 'Use it more to justify',
    css:   'verdict-badge--consistent',
    text:  'This is a quality brand but the cost per use is high given your planned usage. You\'ll get more value if you use it frequently.',
  },
  'budget-risk': {
    label: 'Budget risk',
    css:   'verdict-badge--probably-not',
    text:  'Lower-quality brand at a price that\'s hard to justify. A slightly more expensive option would likely cost less per use over time.',
  },
  'better-alt': {
    label: 'Better alternative exists',
    css:   'verdict-badge--probably-not',
    text:  'Your comparison shows the alternative may offer better long-term value once replacements are factored in.',
  },
};

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

// ─── Product Value: display results ──────────────────────────────────────────

function showProductValueResults(data, calc, isEmotional = false) {
  const v = PV_VERDICT_CONFIG[calc.verdict];

  // Header
  document.getElementById('pv-results-name').textContent = data.name;
  const badge = document.getElementById('pv-verdict-badge');
  badge.textContent = v.label;
  badge.className   = `verdict-badge ${v.css}`;

  // Reputation row under header
  const repRow  = document.getElementById('pv-rep-row');
  const repDots = document.getElementById('pv-rep-dots');
  const repText = document.getElementById('pv-rep-text');
  if (calc.repInfo) {
    const color = scoreColor(calc.repInfo.score);
    repDots.innerHTML = reputationDots(calc.repInfo.score, color);
    repText.textContent = `${data.brand} — ${calc.repInfo.label} · ${calc.repInfo.note}`;
    repRow.hidden = false;
  } else {
    repRow.hidden = true;
  }

  // Stats
  document.getElementById('pv-stat-per-use').textContent =
    calc.costPerUse !== null ? formatMoney(calc.costPerUse) : 'N/A';
  document.getElementById('pv-stat-monthly').textContent  = formatMoney(calc.monthlyCost);
  document.getElementById('pv-stat-total').textContent    = formatMoney(data.price);
  document.getElementById('pv-stat-lifespan').textContent = `${data.lifespan} months`;

  // Comparison block
  const cmpBlock = document.getElementById('pv-comparison');
  if (calc.comparison) {
    const c = calc.comparison;
    document.getElementById('cmp-period').textContent     = `${data.lifespan} months`;
    document.getElementById('cmp-main-brand').textContent = data.brand || 'Your pick';
    document.getElementById('cmp-main-price').textContent = formatMoney(data.price);
    document.getElementById('cmp-main-detail').textContent= `1 item · ${data.lifespan} months`;
    document.getElementById('cmp-alt-brand').textContent  = c.altBrandName;
    document.getElementById('cmp-alt-price').textContent  = formatMoney(c.altTotal);
    document.getElementById('cmp-alt-detail').textContent =
      `${c.altUnits} item${c.altUnits > 1 ? 's' : ''} · ~${c.altLifespan} months each`;

    const summaryEl = document.getElementById('cmp-summary');
    if (c.savings > 0) {
      summaryEl.textContent = `${data.brand} saves you ${formatMoney(c.savings)} over ${data.lifespan} months vs ${c.altBrandName}.`;
      summaryEl.className = 'comparison-block__summary comparison-block__summary--win';
    } else if (c.savings < 0) {
      summaryEl.textContent = `${c.altBrandName} saves you ${formatMoney(Math.abs(c.savings))} over ${data.lifespan} months — but with lower quality.`;
      summaryEl.className = 'comparison-block__summary comparison-block__summary--lose';
    } else {
      summaryEl.textContent = `Both options cost the same over ${data.lifespan} months.`;
      summaryEl.className = 'comparison-block__summary';
    }
    cmpBlock.hidden = false;
  } else {
    cmpBlock.hidden = true;
  }

  // Verdict text + humility note
  document.getElementById('pv-verdict-text').textContent = v.text;
  const pvHumilityEl = document.getElementById('pv-humility-note');
  if (pvHumilityEl) pvHumilityEl.textContent = HUMILITY_NOTES[calc.verdict] || '';

  // Compounding, freedom score, emotional flag
  const pvExtrasEl = document.getElementById('pv-results-extras');
  if (pvExtrasEl) pvExtrasEl.innerHTML = _buildResultExtras(data.price, isEmotional, 'price');

  pvResults.hidden = false;
  pvResults.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ─── Product Value: form validation ──────────────────────────────────────────

function validatePvForm(data) {
  let valid = true;
  [['pv-name', data.name, 'Please enter a product name.'],
   ['pv-price', data.price > 0, 'Enter a price greater than $0.'],
   ['pv-brand', data.brand, 'Please enter a brand name.'],
   ['pv-uses', data.uses > 0, `Enter how many times per ${pvUsagePeriod} you'll use it.`],
   ['pv-lifespan', data.lifespan > 0, 'Enter an expected lifespan.'],
  ].forEach(([id, ok, msg]) => {
    const errEl   = document.getElementById(`err-${id}`);
    const inputEl = pvFields[id.replace('pv-', '')] || document.getElementById(id);
    if (!ok) {
      if (errEl)   errEl.textContent = msg;
      if (inputEl) inputEl.classList.add('input--error');
      valid = false;
    } else {
      if (errEl)   errEl.textContent = '';
      if (inputEl) inputEl.classList.remove('input--error');
    }
  });
  return valid;
}

// ─── Product Value: form events ───────────────────────────────────────────────

let lastPvCalc = null;
let lastPvData = null;

pvForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const rawUses = parseFloat(pvFields.uses.value) || 0;
  const usesPerMonth = pvUsagePeriod === 'week' ? rawUses * (52 / 12) : rawUses;
  const data = {
    name:          pvFields.name.value.trim(),
    price:         parseFloat(pvFields.price.value) || 0,
    brand:         pvFields.brand.value.trim(),
    uses:          usesPerMonth,
    usageDisplay:  `${rawUses} × per ${pvUsagePeriod}`,
    lifespan:      parseFloat(pvFields.lifespan.value) || 0,
    altBrand:      pvFields.altBrand.value.trim(),
    altPrice:      parseFloat(pvFields.altPrice.value) || 0,
  };
  if (!validatePvForm(data)) return;

  const calc = calculateProductValue(data);
  lastPvData = data;
  lastPvCalc = calc;

  if (_skipEmotionModal) {
    _skipEmotionModal = false;
    showProductValueResults(data, calc, false);
    return;
  }
  showEmotionModal((isEmotional) => showProductValueResults(data, calc, isEmotional));
});

document.getElementById('pv-btn-save').addEventListener('click', () => {
  if (!lastPvCalc || !lastPvData) {
    _skipEmotionModal = true;
    pvForm.dispatchEvent(new Event('submit', { cancelable: true }));
    if (!lastPvCalc) return;
  }
  savePvCalculation(lastPvData, lastPvCalc);
});

document.getElementById('pv-btn-clear').addEventListener('click', () => {
  pvForm.reset();
  repCard.hidden    = true;
  repCardAlt.hidden = true;
  pvResults.hidden  = true;
  lastPvCalc = null;
  lastPvData = null;
  pvFields.brand._manuallyEdited = false;
  pvUsagePeriod = 'week';
  document.querySelectorAll('.pv-period-btn').forEach(b => {
    b.classList.toggle('pv-period-btn--active', b.dataset.period === 'week');
  });
  document.getElementById('pv-brand-badge').hidden   = true;
  document.getElementById('pv-price-badge').hidden   = true;
  document.getElementById('pv-lifespan-badge').hidden = true;
  document.getElementById('pv-lifespan-hint').textContent = 'Auto-filled when brand is detected';
  pvAutofillStatusEl.textContent = 'Type a product name — brand & lifespan auto-detect as you type. Hit AI Fill to look up the price.';
  pvAutofillStatusEl.className = 'field__hint';
});

// ─── Saving product-value results ─────────────────────────────────────────────

function savePvCalculation(data, calc) {
  const entries = loadSaved();
  entries.unshift({
    id:          Date.now().toString(),
    mode:        'product-value',
    name:        data.name,
    productName: `${data.name} (${data.brand})`,
    price:       data.price,
    brand:       data.brand,
    uses:        data.uses,
    repScore:    calc.repInfo?.score ?? null,
    repLabel:    calc.repInfo?.label ?? null,
    costPerUse:  calc.costPerUse,
    monthlyCost: calc.monthlyCost,
    lifespan:    data.lifespan,
    altBrand:    data.altBrand,
    altPrice:    data.altPrice,
    verdict:     calc.verdict,
    comparison:  calc.comparison,
    createdAt:   new Date().toISOString(),
  });
  persistSaved(entries);
  renderSaved();
}

// ─── Calendar ──────────────────────────────────────────────────────────────────

// ─── Calendar: DOM references ──────────────────────────────────────────────────

const calendarTitle      = document.getElementById('calendar-title');
const calendarGrid       = document.getElementById('calendar-grid');
const prevMonthBtn       = document.getElementById('prev-month');
const nextMonthBtn       = document.getElementById('next-month');
const eventFormCard      = document.getElementById('event-form-card');
const eventFormTitle     = document.getElementById('event-form-title');
const eventForm          = document.getElementById('event-form');
const eventDateInput     = document.getElementById('event-date');
const eventTitleInput    = document.getElementById('event-title');
const eventDescInput     = document.getElementById('event-description');
const eventBudgetInput   = document.getElementById('event-budget');
const cancelEventBtn     = document.getElementById('cancel-event');
const eventsContainer    = document.getElementById('events-container');
const suggestionsCard    = document.getElementById('suggestions-card');
const suggestionsContent = document.getElementById('suggestions-content');
const generateSuggestionsBtn = document.getElementById('generate-suggestions');

// ─── Calendar: state ───────────────────────────────────────────────────────────

let currentCalendarDate = new Date();
let editingEventId = null;

// ─── Calendar: event storage ───────────────────────────────────────────────────

function loadCalendarEvents() {
  return _cache[CALENDAR_EVENTS_KEY];
}

function saveCalendarEvents(events) {
  _cache[CALENDAR_EVENTS_KEY] = events;
  _fsSave(CALENDAR_EVENTS_KEY, events);
}

// ─── Calendar: rendering ───────────────────────────────────────────────────────

function renderCalendar() {
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();

  // Update title
  calendarTitle.textContent = new Date(year, month).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });

  // Clear grid
  calendarGrid.innerHTML = '';

  // Add day headers
  const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  dayHeaders.forEach(day => {
    const header = document.createElement('div');
    header.className = 'calendar-day-header';
    header.textContent = day;
    calendarGrid.appendChild(header);
  });

  // Get first day of month and last day
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - firstDay.getDay());

  const endDate = new Date(lastDay);
  endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()));

  // Generate calendar days
  const currentDate = new Date(startDate);
  const events = loadCalendarEvents();

  while (currentDate <= endDate) {
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day';

    if (currentDate.getMonth() !== month) {
      dayEl.classList.add('other-month');
    }

    // Check if today
    const today = new Date();
    if (currentDate.toDateString() === today.toDateString()) {
      dayEl.classList.add('today');
    }

    // Day number
    const dayNumber = document.createElement('div');
    dayNumber.className = 'calendar-day-number';
    dayNumber.textContent = currentDate.getDate();
    dayEl.appendChild(dayNumber);

    // Events for this day — compare ISO date strings to avoid timezone shifts
    const isoDay = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2,'0')}-${String(currentDate.getDate()).padStart(2,'0')}`;
    const dayEvents = events.filter(event => event.date === isoDay);

    const dayEventsEl = document.createElement('div');
    dayEventsEl.className = 'calendar-events';

    dayEvents.slice(0, 2).forEach(event => {
      const eventEl = document.createElement('div');
      eventEl.className = 'calendar-event';
      eventEl.textContent = event.title;
      eventEl.title = event.title;
      dayEventsEl.appendChild(eventEl);
    });

    if (dayEvents.length > 2) {
      const moreEl = document.createElement('div');
      moreEl.className = 'calendar-event';
      moreEl.textContent = `+${dayEvents.length - 2} more`;
      dayEventsEl.appendChild(moreEl);
    }

    dayEl.appendChild(dayEventsEl);

    // Snapshot the date so the closure captures a fixed value, not the shared mutable object
    const capturedDate = new Date(currentDate);
    dayEl.addEventListener('click', () => openEventForm(capturedDate));

    calendarGrid.appendChild(dayEl);
    currentDate.setDate(currentDate.getDate() + 1);
  }
}

function renderEventsList() {
  const todayStr = new Date().toISOString().split('T')[0];
  const events = loadCalendarEvents()
    .filter(event => event.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (events.length === 0) {
    eventsContainer.innerHTML = '<p style="color: var(--clr-text-muted); text-align: center; padding: 2rem;">No upcoming events. Click on a calendar day to add one!</p>';
    suggestionsCard.hidden = true;
    return;
  }

  suggestionsCard.hidden = false;

  eventsContainer.innerHTML = events.map(event => `
    <div class="event-item" data-event-id="${event.id}">
      <div class="event-item__content">
        <div class="event-item__title">${escapeHtml(event.title)}</div>
        <div class="event-item__date">${formatEventDate(event.date)}</div>
        ${event.description ? `<div class="event-item__description">${escapeHtml(event.description)}</div>` : ''}
        ${event.budget ? `<div class="event-item__budget">Budget: $${event.budget}</div>` : ''}
      </div>
      <div class="event-item__actions">
        <button class="btn btn--ghost" data-action="edit">Edit</button>
        <button class="btn btn--ghost" data-action="delete" style="color: var(--clr-red);">Delete</button>
      </div>
    </div>
  `).join('');
}

// ─── Calendar: event form ──────────────────────────────────────────────────────

function openEventForm(date, event = null) {
  editingEventId = event ? event.id : null;
  eventFormTitle.textContent = event ? 'Edit Event' : 'Add Event';

  if (event) {
    eventDateInput.value = event.date;
    eventTitleInput.value = event.title;
    eventDescInput.value = event.description || '';
    eventBudgetInput.value = event.budget || '';
  } else {
    eventDateInput.value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    eventTitleInput.value = '';
    eventDescInput.value = '';
    eventBudgetInput.value = '';
  }

  eventFormCard.hidden = false;
  eventTitleInput.focus();
}

function closeEventForm() {
  eventFormCard.hidden = true;
  editingEventId = null;
  eventForm.reset();
}

function saveEvent() {
  const date = eventDateInput.value;
  const title = eventTitleInput.value.trim();
  const description = eventDescInput.value.trim();
  const budget = parseFloat(eventBudgetInput.value) || null;

  if (!date || !title) return;

  const events = loadCalendarEvents();
  const eventData = {
    id: editingEventId || Date.now().toString(),
    date,
    title,
    description: description || null,
    budget
  };

  if (editingEventId) {
    const index = events.findIndex(e => e.id === editingEventId);
    if (index !== -1) events[index] = eventData;
  } else {
    events.push(eventData);
  }

  saveCalendarEvents(events);
  renderCalendar();
  renderEventsList();
  closeEventForm();
}

// ─── Calendar: Claude AI suggestions ──────────────────────────────────────────

async function generatePurchaseSuggestions() {
  const todayStr = new Date().toISOString().split('T')[0];
  const events = loadCalendarEvents()
    .filter(event => event.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  if (events.length === 0) {
    suggestionsContent.innerHTML = '<p>No upcoming events to generate suggestions for. Add some events first!</p>';
    return;
  }

  generateSuggestionsBtn.disabled   = true;
  generateSuggestionsBtn.textContent = 'Thinking…';
  suggestionsContent.innerHTML = `
    <div class="suggestions-loading">
      <span class="spinner" style="border-color:rgba(90,138,106,.3);border-top-color:var(--clr-green);"></span>
      <span>Asking Claude for purchase suggestions…</span>
    </div>`;

  try {
    const response = await fetch('/api/claude-suggestions', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ events, wishlist: loadWishlist() }),
      signal:  AbortSignal.timeout(30000),
    });

    if (response.status === 404) {
      suggestionsContent.innerHTML = `<p style="color:var(--clr-red);font-size:0.9rem;">Deploy this site to Vercel and add <code>ANTHROPIC_API_KEY</code> to your environment variables to enable AI suggestions.</p>`;
      return;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server error ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data.suggestions) || data.suggestions.length === 0) {
      throw new Error('No suggestions received — try adding more event details.');
    }

    const scoreClass = s =>
      s === 'Worth it' ? 'verdict-badge--worth-it' :
      s === 'Conditionally worth it' ? 'verdict-badge--consistent' :
      'verdict-badge--probably-not';

    suggestionsContent.innerHTML = data.suggestions.map(s => `
      <div class="suggestion-item">
        <div class="suggestion-item__title">${escapeHtml(s.title)}</div>
        <div class="suggestion-item__for">For: ${escapeHtml(s.forEvent || '')}</div>
        <div class="suggestion-item__reasoning">${escapeHtml(s.reasoning || '')}</div>
        <div class="suggestion-item__meta">
          ${s.priceRange ? `<span class="suggestion-item__price">${escapeHtml(s.priceRange)}</span>` : ''}
          ${s.worthItScore ? `<span class="verdict-badge ${scoreClass(s.worthItScore)}">${escapeHtml(s.worthItScore)}</span>` : ''}
        </div>
        <a href="#calculator" class="suggestion-item__action" style="margin-top:var(--space-sm);">Calculate if it's worth it →</a>
      </div>
    `).join('');

  } catch (error) {
    const msg = error.name === 'TimeoutError' ? 'Request timed out — please try again.' : error.message;
    suggestionsContent.innerHTML = `<p style="color:var(--clr-red);font-size:0.9rem;">${escapeHtml(msg)}</p>`;
  } finally {
    generateSuggestionsBtn.disabled   = false;
    generateSuggestionsBtn.textContent = 'Generate New Suggestions';
  }
}

// ─── Calendar: utility functions ──────────────────────────────────────────────

function formatEventDate(dateString) {
  // Parse as local date to avoid timezone shifts (YYYY-MM-DD input)
  const [y, m, d] = dateString.split('-').map(Number);
  const date    = new Date(y, m - 1, d);
  const today   = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((date - today) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays > 1 && diffDays < 7) return `In ${diffDays} days`;

  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ─── Calendar: event listeners ────────────────────────────────────────────────

prevMonthBtn.addEventListener('click', () => {
  currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
  renderCalendar();
});

nextMonthBtn.addEventListener('click', () => {
  currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
  renderCalendar();
});

eventForm.addEventListener('submit', (e) => {
  e.preventDefault();
  saveEvent();
});

cancelEventBtn.addEventListener('click', closeEventForm);

eventsContainer.addEventListener('click', (e) => {
  const button = e.target.closest('[data-action]');
  if (!button) return;

  const eventItem = button.closest('.event-item');
  const eventId = eventItem.dataset.eventId;
  const events = loadCalendarEvents();
  const event = events.find(e => e.id === eventId);

  if (button.dataset.action === 'edit') {
    openEventForm(new Date(event.date), event);
  } else if (button.dataset.action === 'delete') {
    if (confirm('Are you sure you want to delete this event?')) {
      const updatedEvents = events.filter(e => e.id !== eventId);
      saveCalendarEvents(updatedEvents);
      renderCalendar();
      renderEventsList();
    }
  }
});

generateSuggestionsBtn.addEventListener('click', generatePurchaseSuggestions);

// ─── App init ─────────────────────────────────────────────────────────────────

async function initApp() {
  try {
    // Wait for Firebase to restore any persisted auth session before deciding
    // whether to create a new anonymous user. Calling signInAnonymously() before
    // the restore completes causes a new UID to be issued every reload, losing data.
    const existingUser = await new Promise((resolve, reject) => {
      const unsubscribe = auth.onAuthStateChanged(user => { unsubscribe(); resolve(user); }, reject);
    });

    if (existingUser) {
      _uid = existingUser.uid;
    } else {
      const cred = await auth.signInAnonymously();
      _uid = cred.user.uid;
    }

    const [saved, wishlist, events, settings] = await Promise.all([
      _fsLoad(STORAGE_KEY),
      _fsLoad(WISHLIST_KEY),
      _fsLoad(CALENDAR_EVENTS_KEY),
      _fsLoad(SETTINGS_KEY),
    ]);

    if (saved)     _cache[STORAGE_KEY]         = saved;
    if (wishlist)  _cache[WISHLIST_KEY]         = wishlist;
    if (events)    _cache[CALENDAR_EVENTS_KEY]  = events;
    if (settings)  _cache[SETTINGS_KEY]         = settings;
  } catch (err) {
    console.warn('[Firebase] init failed — running with empty data:', err.message);
  }

  renderSaved();
  renderWishlist();
  renderSmartInsights();
  renderCalendar();
  renderEventsList();
  renderMindsetWidgets();
  loadProfileSettings();

  // Reveal the page now that real data is rendered
  const loadingEl = document.getElementById('app-loading');
  if (loadingEl) loadingEl.classList.add('app-loading--hidden');
}

initApp();

// ─── Navigation ───────────────────────────────────────────────────────────────

// Mobile hamburger toggle
const _navHamburger = document.getElementById('nav-hamburger');
const _navLinks     = document.getElementById('nav-links');
if (_navHamburger && _navLinks) {
  _navHamburger.addEventListener('click', () => {
    const isOpen = _navLinks.classList.toggle('nav__links--open');
    _navHamburger.setAttribute('aria-expanded', String(isOpen));
  });
  // Close the menu when a link is tapped
  _navLinks.addEventListener('click', (e) => {
    if (e.target.matches('.nav__link')) {
      _navLinks.classList.remove('nav__links--open');
      _navHamburger.setAttribute('aria-expanded', 'false');
    }
  });
}

function updateNavActive() {
  const navLinks = document.querySelectorAll('.nav__link');
  const sections = document.querySelectorAll('section[id]');

  let current = '';
  sections.forEach(section => {
    const sectionTop = section.offsetTop;
    const sectionHeight = section.clientHeight;
    if (window.scrollY >= sectionTop - 100) {
      current = section.getAttribute('id');
    }
  });

  navLinks.forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('href') === `#${current}`) {
      link.classList.add('active');
    }
  });
}

window.addEventListener('scroll', updateNavActive);
updateNavActive(); // Initial call
