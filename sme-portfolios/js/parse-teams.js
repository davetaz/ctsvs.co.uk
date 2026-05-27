/**
 * @typedef {Object} PortfolioEntry
 * @property {string} portfolio
 * @property {{ streetName: string, streetNumber: string, flat: string, area: string, location: string, postcode: string }} address
 */

/**
 * Reads the Team column from the property list CSV (PF portfolio codes).
 * @param {Record<string, string>} row
 * @returns {PortfolioEntry}
 */
function rowToEntry(row) {
  const portfolioRaw = String(row.Team ?? row.team ?? row.Portfolio ?? '').trim();
  return {
    portfolio: portfolioRaw || 'Unassigned',
    address: {
      streetName: trim(row.Streetname ?? row.StreetName ?? ''),
      streetNumber: trim(row.Streetnumber ?? row.StreetNumber ?? ''),
      flat: trim(row.Flatnumber ?? row.FlatNumber ?? ''),
      area: trim(row.Area ?? ''),
      location: trim(row.Location ?? ''),
      postcode: trim(row.Postcode ?? ''),
    },
  };
}

function trim(v) {
  return String(v ?? '').trim();
}

/**
 * @param {Record<string, string>[]} rows
 * @returns {Map<string, PortfolioEntry>}
 */
export function parsePortfoliosRows(rows) {
  const map = new Map();

  for (const row of rows) {
    const id = String(row.PropertyID ?? row['Property ID'] ?? row.propertyId ?? '').trim();
    if (!id) continue;
    map.set(id, rowToEntry(row));
  }

  return map;
}

/** @deprecated Use parsePortfoliosRows */
export const parseTeamsRows = parsePortfoliosRows;

/**
 * @param {File} file
 * @param {typeof Papa} Papa
 * @returns {Promise<Map<string, PortfolioEntry>>}
 */
export function parsePortfoliosFile(file, Papa) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        try {
          resolve(parsePortfoliosRows(results.data));
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

/** @deprecated Use parsePortfoliosFile */
export const parseTeamsFile = parsePortfoliosFile;
