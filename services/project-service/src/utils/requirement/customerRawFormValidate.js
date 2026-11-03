/**
 * Customer Raw workbook — form validation (sheets + headers).
 * RULE-FORM-01 / RULE-NO-CONTENT-QUOTA-01: sheets+headers gate `ok` (no content volume block).
 * Soft contentWarnings (actor / behavior) do not flip `ok` — import + DataGate warn only.
 */

const XLSX = require('xlsx');
const {
  CUSTOMER_RAW_TEMPLATE_TYPE,
  CUSTOMER_RAW_SHEETS,
  CUSTOMER_RAW_SHEET_COLUMNS,
} = require('../../constants/customerRawTemplate.constants');
const {
  isCustomerRawTemplateType,
  looksLikeCustomerRawWorkbook,
  readMeta,
} = require('./customerRawContextParse');
const { normHeader } = require('./requirementTemplateTextNorm');

const SAMPLE_CAP = 12;

const ACTOR_HEADER_ALIASES = new Set(
  ['user / actor', 'user/actor', 'actor', 'user'].map((h) => normHeader(h))
);
const BEHAVIOR_HEADER_ALIASES = new Set(
  ['requirement', 'functional requirement', 'requirement statement', 'feature'].map((h) =>
    normHeader(h)
  )
);
const ID_HEADER_ALIASES = new Set(
  ['requirement id', 'req id', 'id', 'requirement no'].map((h) => normHeader(h))
);

function loadWorkbook(bufferOrWb) {
  if (bufferOrWb && typeof bufferOrWb === 'object' && Array.isArray(bufferOrWb.SheetNames)) {
    return bufferOrWb;
  }
  const buffer = Buffer.isBuffer(bufferOrWb)
    ? bufferOrWb
    : Buffer.from(bufferOrWb || []);
  if (!buffer.length) return null;
  return XLSX.read(buffer, { type: 'buffer', cellDates: true });
}

function sheetMatrix(workbook, sheetName) {
  const ws = workbook.Sheets[sheetName];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false }) || [];
}

function headerRowOfSheet(workbook, sheetName) {
  const matrix = sheetMatrix(workbook, sheetName);
  const row = matrix.find((r) =>
    Array.isArray(r) && r.some((c) => String(c || '').trim() !== '')
  );
  return (row || []).map((c) => String(c || '').trim()).filter(Boolean);
}

function headerSetNormalized(headers) {
  return new Set(headers.map((h) => normHeader(h)).filter(Boolean));
}

function findHeaderIndex(matrix) {
  for (let i = 0; i < matrix.length; i += 1) {
    const row = matrix[i];
    if (!Array.isArray(row)) continue;
    if (row.some((c) => String(c || '').trim() !== '')) return i;
  }
  return -1;
}

function columnIndexMap(headerRow) {
  const map = { actor: -1, behavior: -1, id: -1 };
  (headerRow || []).forEach((cell, idx) => {
    const key = normHeader(cell);
    if (!key) return;
    if (map.actor < 0 && ACTOR_HEADER_ALIASES.has(key)) map.actor = idx;
    if (map.behavior < 0 && BEHAVIOR_HEADER_ALIASES.has(key)) map.behavior = idx;
    if (map.id < 0 && ID_HEADER_ALIASES.has(key)) map.id = idx;
  });
  return map;
}

function cellAt(row, idx) {
  if (idx < 0 || !Array.isArray(row)) return '';
  return String(row[idx] ?? '').trim();
}

/**
 * Soft scan 03_Requirement — missing User/Actor or Requirement (mô tả hành vi).
 * Never blocks form `ok`.
 */
function scanRequirementContentWarnings(workbook) {
  const empty = {
    missingActor: 0,
    missingOutcome: 0,
    rowCount: 0,
    samples: [],
  };
  if (!workbook) return empty;
  const sheetName = CUSTOMER_RAW_SHEETS.REQUIREMENT;
  const matrix = sheetMatrix(workbook, sheetName);
  const headerIdx = findHeaderIndex(matrix);
  if (headerIdx < 0) return empty;
  const cols = columnIndexMap(matrix[headerIdx]);
  if (cols.actor < 0 && cols.behavior < 0) return empty;

  let missingActor = 0;
  let missingOutcome = 0;
  let rowCount = 0;
  const samples = [];

  for (let r = headerIdx + 1; r < matrix.length; r += 1) {
    const row = matrix[r];
    if (!Array.isArray(row)) continue;
    const id = cellAt(row, cols.id);
    const behavior = cellAt(row, cols.behavior);
    const actor = cellAt(row, cols.actor);
    // Skip fully blank rows
    if (!id && !behavior && !actor) continue;
    // Skip guidance-only rows without an id/behavior anchor
    if (!id && !behavior) continue;
    rowCount += 1;
    const flags = [];
    if (cols.actor >= 0 && !actor) {
      missingActor += 1;
      flags.push('missing_actor');
    }
    if (cols.behavior >= 0 && !behavior) {
      missingOutcome += 1;
      flags.push('missing_outcome');
    }
    if (flags.length && samples.length < SAMPLE_CAP) {
      samples.push({
        sheet: sheetName,
        row: r + 1,
        requirementId: id || null,
        flags,
      });
    }
  }

  return { missingActor, missingOutcome, rowCount, samples };
}

function emptyContentWarnings() {
  return { missingActor: 0, missingOutcome: 0, rowCount: 0, samples: [] };
}

/**
 * @param {Buffer|object} bufferOrWorkbook
 * @returns {{
 *   ok: boolean,
 *   templateType: string,
 *   templateVersion: string,
 *   recognizedAsCustomerRaw: boolean,
 *   missingSheets: string[],
 *   missingHeadersBySheet: Record<string, string[]>,
 *   presentSheets: string[],
 *   contentWarnings: { missingActor: number, missingOutcome: number, rowCount: number, samples: object[] },
 * }}
 */
function validateCustomerRawForm(bufferOrWorkbook) {
  const workbook = loadWorkbook(bufferOrWorkbook);
  if (!workbook) {
    return {
      ok: false,
      templateType: '',
      templateVersion: '',
      recognizedAsCustomerRaw: false,
      missingSheets: Object.values(CUSTOMER_RAW_SHEETS),
      missingHeadersBySheet: {},
      presentSheets: [],
      contentWarnings: emptyContentWarnings(),
      errorCode: 'EMPTY_BUFFER',
    };
  }

  const meta = readMeta(workbook);
  const recognizedAsCustomerRaw =
    isCustomerRawTemplateType(meta.templateType) || looksLikeCustomerRawWorkbook(workbook);

  const expectedSheets = Object.values(CUSTOMER_RAW_SHEETS);
  const nameSet = new Set((workbook.SheetNames || []).map((n) => String(n || '')));
  const presentSheets = expectedSheets.filter((s) => nameSet.has(s));
  const missingSheets = expectedSheets.filter((s) => !nameSet.has(s));

  const missingHeadersBySheet = {};
  for (const sheetName of expectedSheets) {
    if (!nameSet.has(sheetName)) continue;
    const expected = CUSTOMER_RAW_SHEET_COLUMNS[sheetName] || [];
    const headers = headerRowOfSheet(workbook, sheetName);
    const have = headerSetNormalized(headers);
    const missing = expected.filter((col) => !have.has(normHeader(col)));
    if (missing.length) missingHeadersBySheet[sheetName] = missing;
  }

  const ok =
    recognizedAsCustomerRaw &&
    missingSheets.length === 0 &&
    Object.keys(missingHeadersBySheet).length === 0;

  const contentWarnings = scanRequirementContentWarnings(workbook);

  return {
    ok,
    templateType: meta.templateType || (recognizedAsCustomerRaw ? CUSTOMER_RAW_TEMPLATE_TYPE : ''),
    templateVersion: meta.templateVersion || '',
    recognizedAsCustomerRaw,
    missingSheets,
    missingHeadersBySheet,
    presentSheets,
    contentWarnings,
    errorCode: ok ? null : 'CUSTOMER_RAW_FORM_INVALID',
  };
}

module.exports = {
  validateCustomerRawForm,
  scanRequirementContentWarnings,
  loadWorkbook,
};
