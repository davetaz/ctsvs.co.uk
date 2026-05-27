import { REVENUE_TYPES } from './parse-revenue.js';
import { hasNonZeroMonth } from './aggregate.js';

/**
 * @param {string} value
 * @returns {string}
 */
function escapeCsv(value) {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * @param {import('./aggregate.js').AppDataset} dataset
 * @param {string} monthKey
 * @returns {string}
 */
export function buildMonthExportCsv(dataset, monthKey) {
  const headers = ['Property ID', 'Address', 'Portfolio', ...REVENUE_TYPES];
  const lines = [headers.map(escapeCsv).join(',')];

  const rows = dataset.properties
    .filter((p) => hasNonZeroMonth(p, monthKey))
    .sort(
      (a, b) =>
        a.portfolio.localeCompare(b.portfolio) ||
        a.propertyId.localeCompare(b.propertyId, undefined, { numeric: true }),
    );

  for (const p of rows) {
    const month = p.months[monthKey] ?? {};
    const cells = [
      p.propertyId,
      p.address,
      p.portfolio,
      ...REVENUE_TYPES.map((t) => formatNumber(month[t] ?? 0)),
    ];
    lines.push(cells.map(escapeCsv).join(','));
  }

  return lines.join('\r\n');
}

/**
 * @param {number} n
 * @returns {string}
 */
function formatNumber(n) {
  if (Number.isInteger(n) || n === Math.floor(n)) {
    return String(n);
  }
  return n.toFixed(2);
}

/**
 * @param {string} csv
 * @param {string} filename
 */
export function downloadCsv(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * @param {string} monthKey
 * @returns {string}
 */
export function exportFilename(monthKey) {
  return `portfolio-income_${monthKey}_properties.csv`;
}
