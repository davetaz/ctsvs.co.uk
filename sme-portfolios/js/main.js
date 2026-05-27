import { buildDataset } from './aggregate.js';
import { buildMonthExportCsv, downloadCsv, exportFilename } from './export.js';
import { parseRevenueFile } from './parse-revenue.js';
import { parsePortfoliosFile } from './parse-teams.js';
import { bindUiHandlers, clearDataset, getDataset, setDataset, setStatus } from './ui.js';

/** @type {Map<string, import('./parse-teams.js').PortfolioEntry> | null} */
let portfolioMap = null;

/** @type {Awaited<ReturnType<typeof parseRevenueFile>> | null} */
let revenueParsed = null;

function showError(message) {
  setStatus(`<p class="error">${escapeHtml(message)}</p>`);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function tryBuild() {
  if (!portfolioMap || !revenueParsed) {
    setStatus(
      '<p>Upload both CSV files to continue.</p>' +
        `<ul>
          <li>Property list (portfolios): ${portfolioMap ? '✓ loaded' : 'waiting'}</li>
          <li>Revenue breakdown: ${revenueParsed ? '✓ loaded' : 'waiting'}</li>
        </ul>`,
    );
    return;
  }

  try {
    const dataset = buildDataset(
      revenueParsed.months,
      revenueParsed.properties,
      portfolioMap,
    );
    setDataset(dataset);

    const { stats } = dataset;
    const monthRange =
      dataset.months.length > 0
        ? `${dataset.months[dataset.months.length - 1].label} → ${dataset.months[0].label}`
        : '—';

    let warnings = '';
    if (stats.unmappedCount > 0) {
      warnings += `<p class="warn">${stats.unmappedCount} propert${stats.unmappedCount === 1 ? 'y' : 'ies'} in revenue with no portfolio mapping.</p>`;
    }
    if (stats.unassignedCount > 0) {
      warnings += `<p class="warn">${stats.unassignedCount} propert${stats.unassignedCount === 1 ? 'y' : 'ies'} marked Unassigned (empty portfolio in property list).</p>`;
    }

    setStatus(
      `<p class="success">Data loaded successfully.</p>
      <ul>
        <li>Properties: ${stats.propertyCount}</li>
        <li>Portfolios: ${stats.portfolioCount}</li>
        <li>Months: ${dataset.months.length} (${monthRange})</li>
      </ul>
      ${warnings}`,
    );
  } catch (err) {
    showError(err instanceof Error ? err.message : String(err));
    clearDataset();
  }
}

async function handlePortfoliosFile(file) {
  if (!file) return;
  try {
    portfolioMap = await parsePortfoliosFile(file, Papa);
    tryBuild();
  } catch (err) {
    portfolioMap = null;
    showError(`Property list: ${err instanceof Error ? err.message : String(err)}`);
    clearDataset();
  }
}

async function handleRevenueFile(file) {
  if (!file) return;
  try {
    revenueParsed = await parseRevenueFile(file, Papa);
    tryBuild();
  } catch (err) {
    revenueParsed = null;
    showError(`Revenue file: ${err instanceof Error ? err.message : String(err)}`);
    clearDataset();
  }
}

function handleExport(monthKey) {
  const dataset = getDataset();
  if (!dataset) return;
  const csv = buildMonthExportCsv(dataset, monthKey);
  downloadCsv(csv, exportFilename(monthKey));
}

bindUiHandlers({ onExport: handleExport });

document.getElementById('file-portfolios')?.addEventListener('change', (e) => {
  const input = /** @type {HTMLInputElement} */ (e.target);
  handlePortfoliosFile(input.files?.[0] ?? null);
});

document.getElementById('file-revenue')?.addEventListener('change', (e) => {
  const input = /** @type {HTMLInputElement} */ (e.target);
  handleRevenueFile(input.files?.[0] ?? null);
});

setStatus('<p>Upload both CSV files to continue.</p>');
