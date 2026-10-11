/**
 * Minimal RFC 4180 CSV parse/serialize. Pure functions, no DOM — the tests
 * import this module directly in Node.
 */

/**
 * Parse CSV text into an array of row arrays.
 * Handles quoted fields, embedded commas/newlines, escaped "" quotes, CRLF,
 * and a UTF-8 BOM. Blank trailing lines are dropped.
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCsv(text) {
  const src = text.replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let i = 0;

  const endField = () => { row.push(field); field = ''; };
  const endRow = () => { endField(); rows.push(row); row = []; };

  while (i < src.length) {
    const ch = src[i];

    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 2; continue; }
        quoted = false; i++; continue;
      }
      field += ch; i++; continue;
    }

    if (ch === '"' && field === '') { quoted = true; i++; continue; }
    if (ch === ',') { endField(); i++; continue; }
    if (ch === '\r') { i++; continue; }
    if (ch === '\n') { endRow(); i++; continue; }
    field += ch; i++;
  }

  if (field !== '' || row.length > 0) endRow();
  while (rows.length && rows[rows.length - 1].every((c) => c.trim() === '')) rows.pop();
  return rows;
}

/** Quote a single field only when it needs it. */
export function escapeField(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Serialize rows to CSV text with CRLF line endings (what Excel expects).
 * @param {Array<Array<string|number>>} rows
 * @returns {string}
 */
export function toCsv(rows) {
  return rows.map((r) => r.map(escapeField).join(',')).join('\r\n');
}

/**
 * Serialize rows to TSV — the clipboard format that pastes into spreadsheet
 * cells. Tabs and newlines inside a field are flattened to spaces, since TSV
 * has no quoting.
 * @param {Array<Array<string|number>>} rows
 * @returns {string}
 */
export function toTsv(rows) {
  return rows
    .map((r) => r.map((c) => String(c ?? '').replace(/[\t\r\n]+/g, ' ')).join('\t'))
    .join('\n');
}
