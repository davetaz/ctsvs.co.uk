import {
  REVENUE_TYPES,
  drillDown,
  drillDownCompare,
  sumPortfolioMonthType,
  sumPortfolioMonthAllTypes,
} from './aggregate.js';

/** @type {import('./aggregate.js').AppDataset | null} */
let dataset = null;

/** @type {{ monthKey: string, portfolio: string, revenueType: string, mode: 'single' | 'compare', monthKeyB?: string } | null} */
let drillContext = null;

const els = {
  status: () => document.getElementById('upload-status'),
  dashboard: () => document.getElementById('dashboard'),
  monthSelect: () => document.getElementById('filter-month'),
  portfolioSelect: () => document.getElementById('filter-portfolio'),
  summaryHead: () => document.getElementById('summary-thead'),
  summaryBody: () => document.getElementById('summary-tbody'),
  drillTitle: () => document.getElementById('drill-title'),
  drillHead: () => document.getElementById('drill-thead'),
  drillBody: () => document.getElementById('drill-tbody'),
  drillPanel: () => document.getElementById('drill-panel'),
  compareMonthA: () => document.getElementById('compare-month-a'),
  compareMonthB: () => document.getElementById('compare-month-b'),
  comparePortfolio: () => document.getElementById('compare-portfolio'),
  compareHead: () => document.getElementById('compare-thead'),
  compareBody: () => document.getElementById('compare-tbody'),
  exportMonth: () => document.getElementById('export-month'),
};

/** @returns {import('./aggregate.js').AppDataset | null} */
export function getDataset() {
  return dataset;
}

/**
 * @param {import('./aggregate.js').AppDataset} data
 */
export function setDataset(data) {
  dataset = data;
  drillContext = null;
  populateMonthSelects();
  populatePortfolioSelects();
  els.dashboard()?.classList.remove('hidden');
  renderSummary();
  renderCompare();
  hideDrill();
}

export function clearDataset() {
  dataset = null;
  drillContext = null;
  els.dashboard()?.classList.add('hidden');
}

/**
 * @param {string} html
 */
export function setStatus(html) {
  const el = els.status();
  if (el) el.innerHTML = html;
}

function populateMonthSelects() {
  if (!dataset) return;
  const options = dataset.months
    .map((m) => `<option value="${m.sortKey}">${m.label}</option>`)
    .join('');

  for (const select of [
    els.monthSelect(),
    els.compareMonthA(),
    els.compareMonthB(),
    els.exportMonth(),
  ]) {
    if (!select) continue;
    const prev = select.value;
    select.innerHTML = options;
    if (prev && [...select.options].some((o) => o.value === prev)) {
      select.value = prev;
    }
  }

  const monthSelect = els.monthSelect();
  if (monthSelect && dataset.months.length) {
    monthSelect.value = dataset.months[0].sortKey;
  }
  const compareA = els.compareMonthA();
  const compareB = els.compareMonthB();
  if (compareA && compareB && dataset.months.length >= 2) {
    compareA.value = dataset.months[1].sortKey;
    compareB.value = dataset.months[0].sortKey;
  }
  const exportMonth = els.exportMonth();
  if (exportMonth && monthSelect) {
    exportMonth.value = monthSelect.value;
  }
}

function populatePortfolioSelects() {
  if (!dataset) return;
  const portfolioOpts =
    '<option value="">All portfolios</option>' +
    dataset.portfolios
      .map((t) => `<option value="${escapeAttr(t)}">${escapeHtml(t)}</option>`)
      .join('');

  const portfolioSelect = els.portfolioSelect();
  if (portfolioSelect) portfolioSelect.innerHTML = portfolioOpts;

  const comparePortfolio = els.comparePortfolio();
  if (comparePortfolio) comparePortfolio.innerHTML = portfolioOpts;
}

function getMonthLabel(sortKey) {
  return dataset?.months.find((m) => m.sortKey === sortKey)?.label ?? sortKey;
}

function getSelectedMonth() {
  return els.monthSelect()?.value ?? dataset?.months[0]?.sortKey ?? '';
}

function getSelectedPortfolioFilter() {
  return els.portfolioSelect()?.value ?? '';
}

function formatMoney(n) {
  return n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPct(change, base) {
  if (base === 0) return '—';
  return `${((change / base) * 100).toFixed(1)}%`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s) {
  return escapeHtml(s);
}

export function renderSummary() {
  if (!dataset) return;

  const monthKey = getSelectedMonth();
  const portfolioFilter = getSelectedPortfolioFilter();
  const portfolios = portfolioFilter ? [portfolioFilter] : dataset.portfolios;

  const thead = els.summaryHead();
  const tbody = els.summaryBody();
  if (!thead || !tbody) return;

  thead.innerHTML =
    '<tr><th>Revenue type</th>' +
    portfolios.map((t) => `<th>${escapeHtml(t)}</th>`).join('') +
    '</tr>';

  const rows = [];

  for (const type of REVENUE_TYPES) {
    const cells = portfolios.map((portfolio) => {
      const amount = sumPortfolioMonthType(dataset, monthKey, portfolio, type);
      return `<td class="num clickable" data-action="drill" data-month="${escapeAttr(monthKey)}" data-portfolio="${escapeAttr(portfolio)}" data-type="${escapeAttr(type)}">${formatMoney(amount)}</td>`;
    });
    rows.push(`<tr><th scope="row">${escapeHtml(type)}</th>${cells.join('')}</tr>`);
  }

  const totalCells = portfolios.map((portfolio) => {
    const amount = sumPortfolioMonthAllTypes(dataset, monthKey, portfolio);
    return `<td class="num total">${formatMoney(amount)}</td>`;
  });
  rows.push(`<tr class="row-total"><th scope="row">All types</th>${totalCells.join('')}</tr>`);

  tbody.innerHTML = rows.join('');
}

export function renderCompare() {
  if (!dataset) return;

  const monthKeyA = els.compareMonthA()?.value ?? '';
  const monthKeyB = els.compareMonthB()?.value ?? '';
  const portfolioFilter = els.comparePortfolio()?.value ?? '';
  const portfolios = portfolioFilter ? [portfolioFilter] : dataset.portfolios;

  const labelA = getMonthLabel(monthKeyA);
  const labelB = getMonthLabel(monthKeyB);

  const thead = els.compareHead();
  const tbody = els.compareBody();
  if (!thead || !tbody) return;

  thead.innerHTML = `<tr>
    <th>Portfolio</th>
    <th>Revenue type</th>
    <th class="num">${escapeHtml(labelA)}</th>
    <th class="num">${escapeHtml(labelB)}</th>
    <th class="num">Change</th>
    <th class="num">% change</th>
  </tr>`;

  const rows = [];
  for (const portfolio of portfolios) {
    for (const type of REVENUE_TYPES) {
      const a = sumPortfolioMonthType(dataset, monthKeyA, portfolio, type);
      const b = sumPortfolioMonthType(dataset, monthKeyB, portfolio, type);
      const change = b - a;
      rows.push(`<tr class="clickable" data-action="drill-compare" data-month-a="${escapeAttr(monthKeyA)}" data-month-b="${escapeAttr(monthKeyB)}" data-portfolio="${escapeAttr(portfolio)}" data-type="${escapeAttr(type)}">
        <td>${escapeHtml(portfolio)}</td>
        <td>${escapeHtml(type)}</td>
        <td class="num">${formatMoney(a)}</td>
        <td class="num">${formatMoney(b)}</td>
        <td class="num ${change >= 0 ? 'positive' : 'negative'}">${formatMoney(change)}</td>
        <td class="num">${formatPct(change, a)}</td>
      </tr>`);
    }
  }

  tbody.innerHTML = rows.join('');
}

function hideDrill() {
  els.drillPanel()?.classList.add('hidden');
  drillContext = null;
}

/**
 * @param {{ monthKey: string, portfolio: string, revenueType: string, mode: 'single' | 'compare', monthKeyB?: string }} ctx
 */
function showDrill(ctx) {
  drillContext = ctx;
  const panel = els.drillPanel();
  panel?.classList.remove('hidden');

  const monthLabel = getMonthLabel(ctx.monthKey);
  const title = els.drillTitle();
  const thead = els.drillHead();
  const tbody = els.drillBody();
  if (!dataset || !title || !thead || !tbody) return;

  if (ctx.mode === 'single') {
    title.textContent = `${ctx.portfolio} · ${monthLabel} · ${ctx.revenueType}`;
    thead.innerHTML =
      '<tr><th>Property ID</th><th>Address</th><th class="num">Amount</th><th class="num">Month total</th></tr>';
    const rows = drillDown(dataset, ctx.monthKey, ctx.portfolio, ctx.revenueType);
    tbody.innerHTML =
      rows.length === 0
        ? '<tr><td colspan="4">No properties with non-zero amounts.</td></tr>'
        : rows
            .map(
              (r) => `<tr>
          <td>${escapeHtml(r.propertyId)}</td>
          <td>${escapeHtml(r.address)}</td>
          <td class="num">${formatMoney(r.amount)}</td>
          <td class="num">${formatMoney(r.rowTotal)}</td>
        </tr>`,
            )
            .join('');
  } else {
    const labelB = getMonthLabel(ctx.monthKeyB ?? '');
    title.textContent = `${ctx.portfolio} · ${ctx.revenueType} · ${monthLabel} vs ${labelB}`;
    thead.innerHTML =
      '<tr><th>Property ID</th><th>Address</th><th class="num">' +
      escapeHtml(monthLabel) +
      '</th><th class="num">' +
      escapeHtml(labelB) +
      '</th><th class="num">Change</th></tr>';
    const rows = drillDownCompare(
      dataset,
      ctx.monthKey,
      ctx.monthKeyB ?? '',
      ctx.portfolio,
      ctx.revenueType,
    );
    tbody.innerHTML =
      rows.length === 0
        ? '<tr><td colspan="5">No properties with amounts in either month.</td></tr>'
        : rows
            .map(
              (r) => `<tr>
          <td>${escapeHtml(r.propertyId)}</td>
          <td>${escapeHtml(r.address)}</td>
          <td class="num">${formatMoney(r.amountA)}</td>
          <td class="num">${formatMoney(r.amountB)}</td>
          <td class="num ${r.change >= 0 ? 'positive' : 'negative'}">${formatMoney(r.change)}</td>
        </tr>`,
            )
            .join('');
  }
}

export function getExportMonthKey() {
  const exportSelect = els.exportMonth();
  if (exportSelect?.value) return exportSelect.value;
  return getSelectedMonth();
}

export function bindUiHandlers({ onExport }) {
  document.getElementById('filter-month')?.addEventListener('change', () => {
    const exportMonth = els.exportMonth();
    const month = getSelectedMonth();
    if (exportMonth) exportMonth.value = month;
    renderSummary();
  });

  document.getElementById('filter-portfolio')?.addEventListener('change', renderSummary);

  for (const id of ['compare-month-a', 'compare-month-b', 'compare-portfolio']) {
    document.getElementById(id)?.addEventListener('change', renderCompare);
  }

  document.getElementById('summary-tbody')?.addEventListener('click', (e) => {
    const cell = e.target.closest('[data-action="drill"]');
    if (!cell || !dataset) return;
    showDrill({
      mode: 'single',
      monthKey: cell.dataset.month,
      portfolio: cell.dataset.portfolio,
      revenueType: cell.dataset.type,
    });
  });

  document.getElementById('compare-tbody')?.addEventListener('click', (e) => {
    const row = e.target.closest('[data-action="drill-compare"]');
    if (!row || !dataset) return;
    showDrill({
      mode: 'compare',
      monthKey: row.dataset.monthA,
      monthKeyB: row.dataset.monthB,
      portfolio: row.dataset.portfolio,
      revenueType: row.dataset.type,
    });
  });

  document.getElementById('drill-close')?.addEventListener('click', hideDrill);

  document.getElementById('btn-export')?.addEventListener('click', () => {
    if (!dataset) return;
    onExport(getExportMonthKey());
  });
}
