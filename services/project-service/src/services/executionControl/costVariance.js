/**
 * Wave 5e — cost / hours variance (tool numbers only).
 */

/**
 * @param {{ actual: number, baseline: number, mode?: 'hours'|'money' }} input
 */
function computeCostVariance({ actual, baseline, mode = 'hours' } = {}) {
  const a = Number(actual);
  const b = Number(baseline);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) {
    return {
      ok: false,
      reason: 'insufficient_baseline',
      varianceRatio: null,
      varianceAbs: null,
      mode,
    };
  }
  const varianceAbs = a - b;
  const varianceRatio = a / b;
  return {
    ok: true,
    mode,
    actual: a,
    baseline: b,
    varianceAbs,
    varianceRatio,
    overrun: varianceRatio >= 1.2,
  };
}

/**
 * Simple EAC forecast: actual + remaining confirmed (hours mode).
 */
function forecastEacHours({ actualHours, remainingHours, remainingSource } = {}) {
  const actual = Number(actualHours) || 0;
  if (remainingSource !== 'confirmed' || !Number.isFinite(Number(remainingHours))) {
    return {
      completeness: 'PARTIAL',
      eacHours: null,
      reason: 'remaining_not_confirmed',
    };
  }
  return {
    completeness: 'FULL',
    eacHours: actual + Number(remainingHours),
  };
}

module.exports = {
  computeCostVariance,
  forecastEacHours,
};
