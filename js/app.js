/**
 * DOM wiring only. All parsing/mapping lives in js/csv.js and js/transform.js
 * so it can be tested in Node.
 */
import { parseCsv, toCsv, toTsv } from './csv.js';
import {
  buildOutput, buildTransactionsPro, OUTPUT_COLUMNS, TPRO_COLUMNS,
} from './transform.js';

const $ = (id) => document.getElementById(id);
const fileInput = $('file');
const drop = $('drop');
const fcInput = $('fc');
const fileStatus = $('fileStatus');
const chips = $('chips');
const warn = $('warn');
const count = $('count');
const copyBtn = $('copy');
const downloadBtn = $('download');
const tableWrap = $('tableWrap');
const panel = $('panel');
const formatNote = $('formatNote');
const tproOptions = $('tproOptions');
const shippingMethod = $('shippingMethod');
const paymentMethod = $('paymentMethod');
const tabs = [...document.querySelectorAll('.tab')];

/** Columns whose fill is dark enough to need white header text. */
const DARK_COLORS = new Set(['#c00000', '#7030a0', '#44546a', '#4472c4', '#ed7d31', '#00b050']);

/**
 * The two output formats. Each knows its columns, how to build rows from the
 * uploaded export, which cells to right-align, and what to call the download.
 */
const FORMATS = {
  importer: {
    label: 'Importer rows',
    columns: OUTPUT_COLUMNS,
    note: 'One row per line item, with each quote’s header fields repeated across its items.',
    numeric: new Set(['quantity', 'originalPrice', 'quotePrice', 'total']),
    suffix: 'import',
    build: () => buildOutput(rows, fcInput.value),
  },
  tpro: {
    label: 'Custom',
    columns: TPRO_COLUMNS,
    note: 'QuickBooks / Transactions Pro layout: quote id (the number after “FC”), two blank columns, the static shipping and payment methods, then quantity and SKU per line item.',
    numeric: new Set(['quoteId', 'qty']),
    suffix: 'tpro',
    build: () => buildTransactionsPro(rows, fcInput.value, {
      shippingMethod: shippingMethod.value,
      paymentMethod: paymentMethod.value,
    }),
  },
};

let rows = [];          // parsed CSV of the uploaded export
let fileName = '';
let format = 'importer';
let output = { header: [], rows: [], matched: [], missing: [], invalid: [], available: [] };

function setFile(name, text) {
  fileName = name;
  rows = parseCsv(text);
  const { quotes, available } = buildOutput(rows, '');
  fileStatus.textContent = quotes.length
    ? `${name} — ${quotes.length} quote${quotes.length === 1 ? '' : 's'} found (quotes ${summarize(available)}).`
    : `${name} — no quote rows found. Is this the quote export?`;
  render();
}

/** "29, 30, 31, 52" -> "29–31, 52" so the status line stays short. */
function summarize(numbers) {
  const sorted = [...new Set(numbers)].sort((a, b) => a - b);
  const parts = [];
  let start = null;
  let prev = null;
  for (const n of sorted) {
    if (start === null) { start = prev = n; continue; }
    if (n === prev + 1) { prev = n; continue; }
    parts.push(start === prev ? `${start}` : `${start}–${prev}`);
    start = prev = n;
  }
  if (start !== null) parts.push(start === prev ? `${start}` : `${start}–${prev}`);
  return parts.join(', ') || 'none';
}

function selectFormat(next) {
  format = next;
  for (const tab of tabs) {
    const on = tab.dataset.format === next;
    tab.setAttribute('aria-selected', String(on));
    if (on) panel.setAttribute('aria-labelledby', tab.id);
  }
  tproOptions.hidden = next !== 'tpro';
  render();
}

function render() {
  const spec = FORMATS[format];
  formatNote.textContent = spec.note;
  output = spec.build();

  chips.replaceChildren(
    ...output.matched.map((n) => chip(`Quote ${n}`, '')),
    ...output.missing.map((n) => chip(`Quote ${n} not found`, 'missing')),
  );

  const problems = [];
  if (output.invalid.length) problems.push(`Could not read: ${output.invalid.join(', ')}`);
  if (output.missing.length) problems.push(`Not in this file: ${output.missing.map((n) => `quote ${n}`).join(', ')}`);
  if (!rows.length && fcInput.value.trim()) problems.push('Upload the quote export first.');
  warn.textContent = problems.join(' · ');

  count.textContent = output.rows.length
    ? `${output.rows.length} row${output.rows.length === 1 ? '' : 's'} from ${output.matched.length} quote${output.matched.length === 1 ? '' : 's'}`
    : '';

  copyBtn.disabled = downloadBtn.disabled = output.rows.length === 0;
  renderTable(spec);
}

function chip(text, cls) {
  const el = document.createElement('span');
  el.className = `chip ${cls}`.trim();
  el.textContent = text;
  return el;
}

function renderTable(spec) {
  if (!output.rows.length) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.id = 'empty';
    p.textContent = rows.length
      ? 'Enter quote numbers above to build the output.'
      : 'Output appears here once a file is loaded and quote numbers are entered.';
    tableWrap.replaceChildren(p);
    return;
  }

  const table = document.createElement('table');
  const thead = table.createTHead();
  const headRow = thead.insertRow();
  spec.columns.forEach((col, i) => {
    const th = document.createElement('th');
    th.scope = 'col';
    if (col.label) {
      th.textContent = col.label;
    } else {
      // Blank by design — label it for screen readers and as a visible hint.
      th.textContent = '(blank)';
      th.className = 'blank-col';
      th.setAttribute('aria-label', `Column ${i + 1}, intentionally blank`);
    }
    if (col.color) {
      th.style.setProperty('--col', col.color);
      if (DARK_COLORS.has(col.color)) th.style.setProperty('--col-fg', '#fff');
    }
    headRow.append(th);
  });

  const tbody = table.createTBody();
  for (const row of output.rows) {
    const tr = tbody.insertRow();
    row.forEach((value, i) => {
      const col = spec.columns[i];
      const td = tr.insertCell();
      td.textContent = value;
      if (col.color) td.style.setProperty('--col', col.color);
      if (spec.numeric.has(col.key)) td.className = 'num-cell';
    });
  }

  tableWrap.replaceChildren(table);
}

async function readFile(file) {
  if (!file) return;
  if (!/\.csv$/i.test(file.name) && file.type && !/csv|text/.test(file.type)) {
    fileStatus.textContent = `${file.name} is not a .csv file.`;
    return;
  }
  setFile(file.name, await file.text());
}

function downloadName() {
  const fcs = output.matched.length ? `quote${output.matched.join('-')}` : 'output';
  const base = fileName.replace(/\.csv$/i, '') || 'quoteconv';
  return `${base}-${fcs}-${FORMATS[format].suffix}.csv`.slice(0, 120);
}

async function copyOutput() {
  const text = toTsv([output.header, ...output.rows]);
  try {
    await navigator.clipboard.writeText(text);
    flash(copyBtn, 'Copied');
  } catch {
    flash(copyBtn, 'Copy blocked — select the table');
  }
}

function downloadCsv() {
  // Built and saved locally; the file never touches a server.
  const blob = new Blob(['﻿' + toCsv([output.header, ...output.rows])], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = downloadName();
  a.click();
  URL.revokeObjectURL(url);
  flash(downloadBtn, 'Saved');
}

function flash(button, message) {
  const original = button.dataset.label ?? button.textContent;
  button.dataset.label = original;
  button.textContent = message;
  setTimeout(() => { button.textContent = button.dataset.label; }, 1600);
}

/**
 * Local convenience only: sample/ is gitignored (it holds real customer data),
 * so the file is absent on the deployed site. Hide the button when it 404s
 * rather than leaving a control that cannot work.
 */
async function loadSample() {
  const sampleBtn = $('loadSample');
  try {
    const res = await fetch('sample/quote-export-sample.csv');
    if (!res.ok) throw new Error(String(res.status));
    setFile('quote-export-sample.csv', await res.text());
    if (!fcInput.value.trim()) {
      fcInput.value = '29-31';
      render();
    }
  } catch {
    sampleBtn.hidden = true;
    fileStatus.textContent = 'No sample file available here — choose a quote export CSV above.';
  }
}

fileInput.addEventListener('change', () => readFile(fileInput.files[0]));
fcInput.addEventListener('input', render);
shippingMethod.addEventListener('input', render);
paymentMethod.addEventListener('input', render);
copyBtn.addEventListener('click', copyOutput);
downloadBtn.addEventListener('click', downloadCsv);
$('loadSample').addEventListener('click', loadSample);

for (const tab of tabs) {
  tab.addEventListener('click', () => selectFormat(tab.dataset.format));
  tab.addEventListener('keydown', (e) => {
    const i = tabs.indexOf(tab);
    const next = e.key === 'ArrowRight' ? tabs[(i + 1) % tabs.length]
      : e.key === 'ArrowLeft' ? tabs[(i - 1 + tabs.length) % tabs.length]
      : null;
    if (!next) return;
    e.preventDefault();
    next.focus();
    selectFormat(next.dataset.format);
  });
}

for (const type of ['dragenter', 'dragover']) {
  drop.addEventListener(type, (e) => { e.preventDefault(); drop.classList.add('over'); });
}
for (const type of ['dragleave', 'drop']) {
  drop.addEventListener(type, () => drop.classList.remove('over'));
}
drop.addEventListener('drop', (e) => {
  e.preventDefault();
  readFile(e.dataTransfer?.files?.[0]);
});

selectFormat('importer');
