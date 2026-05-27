/** @typedef {{ label: string, sortKey: string, startCol: number }} MonthBlock */

export const REVENUE_TYPES = [
  'Management Fees',
  'Rent Received',
  'Commission Income',
  'Direct Fee Payment General',
  'Other landlord fees',
  'All tenant fees',
  'LANDLORD Fee Refund',
  'TENANT Fee Refund',
];

const COLS_PER_MONTH = REVENUE_TYPES.length;
const FIXED_COLS = 8;

const MONTH_NAMES = {
  Jan: '01',
  Feb: '02',
  Mar: '03',
  Apr: '04',
  May: '05',
  Jun: '06',
  Jul: '07',
  Aug: '08',
  Sep: '09',
  Oct: '10',
  Nov: '11',
  Dec: '12',
};

/**
 * @param {string} label e.g. "2026 May"
 * @returns {string} YYYY-MM
 */
export function monthLabelToSortKey(label) {
  const trimmed = label.trim();
  const match = trimmed.match(/^(\d{4})\s+(\w{3})$/);
  if (!match) return trimmed;
  const mm = MONTH_NAMES[match[2]];
  if (!mm) return trimmed;
  return `${match[1]}-${mm}`;
}

/**
 * @param {string[][]} rows Papa-parsed matrix (header: false)
 * @returns {{ months: MonthBlock[], properties: import('./aggregate.js').PropertyRecord[] }}
 */
export function parseRevenueCsv(rows) {
  if (rows.length < 3) {
    throw new Error('Revenue CSV must have at least two header rows and one data row.');
  }

  const monthRow = rows[0];
  const typeRow = rows[1];

  if (monthRow.length < FIXED_COLS + COLS_PER_MONTH) {
    throw new Error('Revenue CSV header rows are too short.');
  }

  /** @type {MonthBlock[]} */
  const months = [];
  let col = FIXED_COLS;
  while (col < monthRow.length) {
    const label = (monthRow[col] || '').trim();
    if (!label) break;
    const sortKey = monthLabelToSortKey(label);
    months.push({ label, sortKey, startCol: col });
    col += COLS_PER_MONTH;
  }

  if (months.length === 0) {
    throw new Error('No month columns found in revenue CSV.');
  }

  for (let m = 0; m < months.length; m++) {
    const start = months[m].startCol;
    const blockTypes = typeRow.slice(start, start + COLS_PER_MONTH).map((t) => t.trim());
    for (let i = 0; i < REVENUE_TYPES.length; i++) {
      if (blockTypes[i] !== REVENUE_TYPES[i]) {
        throw new Error(
          `Unexpected column at month "${months[m].label}" position ${i}: got "${blockTypes[i]}", expected "${REVENUE_TYPES[i]}".`,
        );
      }
    }
  }

  /** @type {import('./aggregate.js').PropertyRecord[]} */
  const properties = [];

  for (let r = 2; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row.length) continue;

    const propertyId = String(row[0] ?? '').trim();
    if (!propertyId) continue;

    /** @type {Record<string, Record<string, number>>} */
    const monthsData = {};

    for (const month of months) {
      /** @type {Record<string, number>} */
      const typeValues = {};
      for (let i = 0; i < REVENUE_TYPES.length; i++) {
        const raw = row[month.startCol + i];
        const n = parseFloat(String(raw ?? '').replace(/,/g, '').trim());
        typeValues[REVENUE_TYPES[i]] = Number.isFinite(n) ? n : 0;
      }
      monthsData[month.sortKey] = typeValues;
    }

    properties.push({
      propertyId,
      addressFromRevenue: {
        streetName: trim(row[1]),
        streetNumber: trim(row[2]),
        flat: trim(row[3]),
        area: trim(row[4]),
        location: trim(row[5]),
        postcode: trim(row[6]),
      },
      status: trim(row[7]),
      months: monthsData,
    });
  }

  return { months, properties };
}

function trim(v) {
  return String(v ?? '').trim();
}

/**
 * @param {File} file
 * @param {typeof Papa} Papa
 * @returns {Promise<ReturnType<typeof parseRevenueCsv>>}
 */
export function parseRevenueFile(file, Papa) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete(results) {
        try {
          resolve(parseRevenueCsv(results.data));
        } catch (err) {
          reject(err);
        }
      },
      error(err) {
        reject(err);
      },
    });
  });
}
