/**
 * Fail if vi/en locale trees differ in leaf key paths (after mergeDeep build).
 * Usage: node scripts/check-locale-parity.mjs
 */
import { STRINGS } from '../src/locales/buildStrings.js';

function leafPaths(obj, prefix = '', out = []) {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    out.push(prefix);
    return out;
  }
  const keys = Object.keys(obj).sort();
  if (keys.length === 0) {
    out.push(prefix);
    return out;
  }
  for (const k of keys) {
    const next = prefix ? `${prefix}.${k}` : k;
    leafPaths(obj[k], next, out);
  }
  return out;
}

function diff(a, b) {
  const setA = new Set(a);
  const setB = new Set(b);
  return {
    onlyA: a.filter((p) => !setB.has(p)),
    onlyB: b.filter((p) => !setA.has(p)),
  };
}

const viPaths = leafPaths(STRINGS.vi);
const enPaths = leafPaths(STRINGS.en);
const { onlyA: onlyVi, onlyB: onlyEn } = diff(viPaths, enPaths);

if (onlyVi.length === 0 && onlyEn.length === 0) {
  console.log(`Locale parity OK (${viPaths.length} leaf paths)`);
  process.exit(0);
}

console.error('Locale parity FAILED — vi/en leaf keys differ');
if (onlyVi.length) {
  console.error(`\nOnly in vi (${onlyVi.length}):`);
  onlyVi.slice(0, 50).forEach((p) => console.error(`  - ${p}`));
  if (onlyVi.length > 50) console.error(`  … +${onlyVi.length - 50} more`);
}
if (onlyEn.length) {
  console.error(`\nOnly in en (${onlyEn.length}):`);
  onlyEn.slice(0, 50).forEach((p) => console.error(`  - ${p}`));
  if (onlyEn.length > 50) console.error(`  … +${onlyEn.length - 50} more`);
}
process.exit(1);
