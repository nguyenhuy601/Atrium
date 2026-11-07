/**
 * Playwright helpers — bắt lệch chiều cao card KPI / chart (bug GIỜ KH/TT).
 * @param {import('@playwright/test').Page} page
 * @param {string} selector
 * @param {{ maxDeltaPx?: number }} [opts]
 */
export async function assertEqualElementHeights(page, selector, opts = {}) {
  const maxDeltaPx = opts.maxDeltaPx ?? 2;
  const heights = await page.$$eval(selector, (els) =>
    els.map((el) => Math.round(el.getBoundingClientRect().height))
  );
  if (heights.length < 2) {
    throw new Error(`assertEqualElementHeights: need ≥2 nodes for ${selector}, got ${heights.length}`);
  }
  const min = Math.min(...heights);
  const max = Math.max(...heights);
  if (max - min > maxDeltaPx) {
    throw new Error(
      `Layout height mismatch for ${selector}: heights=[${heights.join(', ')}] delta=${max - min}px (max allowed ${maxDeltaPx})`
    );
  }
  return heights;
}

/** Overview redesign markers — fail nếu browser vẫn phục vụ bundle/HMR cũ. */
export async function assertOverviewRedesignMounted(page) {
  await page.waitForSelector('[data-testid="overview-kpi-strip"]', { timeout: 20_000 });
  const markers = await page.evaluate(() => ({
    kpiStrip: Boolean(document.querySelector('[data-testid="overview-kpi-strip"]')),
    kpiCards: document.querySelectorAll('[data-testid="overview-kpi-card"]').length,
    charts: Boolean(document.querySelector('[data-testid="overview-charts-grid"]')),
    typeChart: Boolean(document.getElementById('overview-type-breakdown')),
    assigneeBars: Boolean(document.getElementById('overview-assignee-bars')),
    legacyDivideKpi: Boolean(document.querySelector('.divide-x.divide-y')),
  }));
  if (!markers.kpiStrip || markers.kpiCards < 4) {
    throw new Error(`Overview redesign missing KPI strip/cards: ${JSON.stringify(markers)}`);
  }
  if (markers.legacyDivideKpi) {
    throw new Error('Legacy divide-x KPI strip still mounted — hard-refresh / Vite HMR stale');
  }
  if (!markers.charts || !markers.typeChart || !markers.assigneeBars) {
    throw new Error(`Overview charts redesign incomplete: ${JSON.stringify(markers)}`);
  }
  return markers;
}
