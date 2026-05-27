import { formatUkAddress, hasAddressParts } from './address.js';
import { REVENUE_TYPES } from './parse-revenue.js';

/**
 * @typedef {Object} AddressParts
 * @property {string} streetName
 * @property {string} streetNumber
 * @property {string} flat
 * @property {string} area
 * @property {string} location
 * @property {string} postcode
 */

/**
 * @typedef {Object} PropertyRecord
 * @property {string} propertyId
 * @property {AddressParts} addressFromRevenue
 * @property {string} status
 * @property {Record<string, Record<string, number>>} months
 */

/**
 * @typedef {Object} EnrichedProperty
 * @property {string} propertyId
 * @property {string} portfolio
 * @property {string} address
 * @property {string} status
 * @property {Record<string, Record<string, number>>} months
 */

/**
 * @typedef {Object} AppDataset
 * @property {{ label: string, sortKey: string, startCol: number }[]} months
 * @property {EnrichedProperty[]} properties
 * @property {string[]} portfolios
 * @property {{ unmappedCount: number, unassignedCount: number, propertyCount: number, portfolioCount: number }} stats
 */

const NO_MAPPING = 'No portfolio mapping';

/**
 * @param {import('./parse-teams.js').PortfolioEntry | undefined} portfolioEntry
 * @param {AddressParts} revenueAddress
 * @returns {string}
 */
function resolveAddress(portfolioEntry, revenueAddress) {
  if (portfolioEntry && hasAddressParts(portfolioEntry.address)) {
    return formatUkAddress(portfolioEntry.address);
  }
  return formatUkAddress(revenueAddress);
}

/**
 * @param {PropertyRecord[]} properties
 * @param {Map<string, import('./parse-teams.js').PortfolioEntry>} portfolioMap
 * @returns {EnrichedProperty[]}
 */
export function enrichProperties(properties, portfolioMap) {
  return properties.map((p) => {
    const entry = portfolioMap.get(p.propertyId);
    const portfolio = entry ? entry.portfolio : NO_MAPPING;
    return {
      propertyId: p.propertyId,
      portfolio,
      address: resolveAddress(entry, p.addressFromRevenue),
      status: p.status,
      months: p.months,
    };
  });
}

/**
 * @param {EnrichedProperty[]} properties
 * @returns {string[]}
 */
export function collectPortfolios(properties) {
  const set = new Set(properties.map((p) => p.portfolio));
  const order = ['PF1', 'PF2', 'PF3', 'PF4', 'Unassigned', NO_MAPPING];
  return [...set].sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
}

/**
 * @param {EnrichedProperty[]} properties
 * @returns {{ unmappedCount: number, unassignedCount: number, propertyCount: number, portfolioCount: number }}
 */
export function buildStats(properties) {
  return {
    propertyCount: properties.length,
    portfolioCount: new Set(properties.map((p) => p.portfolio)).size,
    unmappedCount: properties.filter((p) => p.portfolio === NO_MAPPING).length,
    unassignedCount: properties.filter((p) => p.portfolio === 'Unassigned').length,
  };
}

/**
 * @param {AppDataset} dataset
 * @param {string} monthKey
 * @param {string} portfolio
 * @param {string} revenueType
 * @returns {number}
 */
export function sumPortfolioMonthType(dataset, monthKey, portfolio, revenueType) {
  let total = 0;
  for (const p of dataset.properties) {
    if (p.portfolio !== portfolio) continue;
    total += p.months[monthKey]?.[revenueType] ?? 0;
  }
  return total;
}

/**
 * @param {AppDataset} dataset
 * @param {string} monthKey
 * @param {string} portfolio
 * @returns {number}
 */
export function sumPortfolioMonthAllTypes(dataset, monthKey, portfolio) {
  let total = 0;
  for (const type of REVENUE_TYPES) {
    total += sumPortfolioMonthType(dataset, monthKey, portfolio, type);
  }
  return total;
}

/**
 * @param {EnrichedProperty} property
 * @param {string} monthKey
 * @returns {number}
 */
export function propertyMonthTotal(property, monthKey) {
  const month = property.months[monthKey];
  if (!month) return 0;
  return REVENUE_TYPES.reduce((s, t) => s + (month[t] ?? 0), 0);
}

/**
 * @param {EnrichedProperty} property
 * @param {string} monthKey
 * @returns {boolean}
 */
export function hasNonZeroMonth(property, monthKey) {
  return propertyMonthTotal(property, monthKey) !== 0;
}

/**
 * @param {AppDataset} dataset
 * @param {string} monthKey
 * @param {string} portfolio
 * @param {string} revenueType
 * @returns {{ propertyId: string, address: string, amount: number, rowTotal: number }[]}
 */
export function drillDown(dataset, monthKey, portfolio, revenueType) {
  const rows = [];
  for (const p of dataset.properties) {
    if (p.portfolio !== portfolio) continue;
    const amount = p.months[monthKey]?.[revenueType] ?? 0;
    if (amount === 0) continue;
    rows.push({
      propertyId: p.propertyId,
      address: p.address,
      amount,
      rowTotal: propertyMonthTotal(p, monthKey),
    });
  }
  rows.sort((a, b) => b.amount - a.amount);
  return rows;
}

/**
 * @param {AppDataset} dataset
 * @param {string} monthKeyA
 * @param {string} monthKeyB
 * @param {string} portfolio
 * @param {string} revenueType
 * @returns {{ propertyId: string, address: string, amountA: number, amountB: number, change: number }[]}
 */
export function drillDownCompare(dataset, monthKeyA, monthKeyB, portfolio, revenueType) {
  const rows = [];
  for (const p of dataset.properties) {
    if (p.portfolio !== portfolio) continue;
    const amountA = p.months[monthKeyA]?.[revenueType] ?? 0;
    const amountB = p.months[monthKeyB]?.[revenueType] ?? 0;
    if (amountA === 0 && amountB === 0) continue;
    rows.push({
      propertyId: p.propertyId,
      address: p.address,
      amountA,
      amountB,
      change: amountB - amountA,
    });
  }
  rows.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  return rows;
}

/**
 * @param {{ label: string, sortKey: string, startCol: number }[]} months
 * @param {PropertyRecord[]} properties
 * @param {Map<string, import('./parse-teams.js').PortfolioEntry>} portfolioMap
 * @returns {AppDataset}
 */
export function buildDataset(months, properties, portfolioMap) {
  const enriched = enrichProperties(properties, portfolioMap);
  return {
    months,
    properties: enriched,
    portfolios: collectPortfolios(enriched),
    stats: buildStats(enriched),
  };
}

export { REVENUE_TYPES, NO_MAPPING };
