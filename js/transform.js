/**
 * Quote-export CSV -> flat importer rows.
 *
 * The export is a two-level file: a `Quote` row carries the header fields, and
 * the `Product` rows that follow it are its line items. The importer wants one
 * row per line item with the quote's header fields repeated on every row.
 *
 * Pure functions only — no DOM. The colors mirror the fills in
 * docs/before-after.xlsx, which is how the stakeholders marked the mapping.
 */

/**
 * Importer-rows columns, in order, with the mapping color from the spreadsheet.
 */
export const OUTPUT_COLUMNS = [
  { key: 'quote', label: 'Quote', color: '#c00000' },
  { key: 'quoteNo', label: 'Quote No', color: '#ffc000' },
  { key: 'status', label: 'Status', color: '#ed7d31' },
  { key: 'dateTime', label: 'Date Time', color: '#ffff00' },
  { key: 'type', label: 'Type', color: '#66ff33' },
  { key: 'item', label: 'Item', color: '#92d050' },
  { key: 'sku', label: 'SKU', color: '#00b0f0' },
  { key: 'quantity', label: 'Quantity', color: '#7030a0' },
  { key: 'originalPrice', label: 'Original Price', color: '#ed7d31' },
  { key: 'quotePrice', label: 'Quote Price', color: '#00b050' },
  { key: 'total', label: 'Total', color: '#4472c4' },
  { key: 'name', label: 'Name', color: '#a5a5a5' },
  { key: 'company', label: 'Company', color: '#44546a' },
  { key: 'email', label: 'Email', color: '#ccffff' },
];

export const OUTPUT_HEADER = OUTPUT_COLUMNS.map((c) => c.label);

/**
 * Transactions Pro (QuickBooks) columns, in order. Columns B and C are
 * intentionally blank — the importer template expects two empty columns there,
 * so they carry empty labels and empty cells. Colors follow the stakeholders'
 * sample image: blue = quote id, yellow = static fill-down, green = from the
 * export.
 */
export const TPRO_COLUMNS = [
  { key: 'quoteId', label: 'Quote #', color: '#00b0f0' },
  { key: 'blank1', label: '', color: null },
  { key: 'blank2', label: '', color: null },
  { key: 'shippingMethod', label: 'Shipping Method', color: '#ffff00' },
  { key: 'paymentMethod', label: 'Payment Method', color: '#ffff00' },
  { key: 'qty', label: 'Qty', color: '#a9d08e' },
  { key: 'sku', label: 'SKU', color: '#a9d08e' },
];

export const TPRO_HEADER = TPRO_COLUMNS.map((c) => c.label);

/** Defaults for the static fill-down cells, overridable from the UI. */
export const TPRO_DEFAULTS = {
  shippingMethod: 'BIBO - BestWay',
  paymentMethod: 'Purchase Order',
};

/** Column positions in the export. Row 0 names quote fields, row 1 product fields. */
const QUOTE_COLS = { quoteNo: 1, dateTime: 2, name: 3, email: 4, company: 5, status: 6, total: 7 };
const PRODUCT_COLS = { productNo: 1, productName: 2, sku: 3, qty: 4, price: 5, quotePrice: 6 };

const cell = (row, i) => (row[i] ?? '').trim();

/** Pull the FC number out of a quote number like "RR Books Quote FC29". */
export function fcNumberOf(quoteNo) {
  const m = /FC\s*0*(\d+)/i.exec(quoteNo ?? '');
  return m ? Number(m[1]) : null;
}

/**
 * Group export rows into quotes with their line items.
 * @param {string[][]} rows
 * @returns {Array<object>}
 */
export function parseQuotes(rows) {
  const quotes = [];
  let current = null;

  for (const row of rows) {
    const type = cell(row, 0);

    if (/^quote$/i.test(type)) {
      const quoteNo = cell(row, QUOTE_COLS.quoteNo);
      current = {
        type,
        quoteNo,
        fc: fcNumberOf(quoteNo),
        dateTime: cell(row, QUOTE_COLS.dateTime),
        name: cell(row, QUOTE_COLS.name),
        email: cell(row, QUOTE_COLS.email),
        company: cell(row, QUOTE_COLS.company),
        status: cell(row, QUOTE_COLS.status),
        total: cell(row, QUOTE_COLS.total),
        products: [],
      };
      quotes.push(current);
      continue;
    }

    if (/^product$/i.test(type)) {
      // A product row before any quote row means a malformed file; skip it.
      if (!current) continue;
      current.products.push({
        type,
        productNo: cell(row, PRODUCT_COLS.productNo),
        productName: cell(row, PRODUCT_COLS.productName),
        sku: cell(row, PRODUCT_COLS.sku),
        qty: cell(row, PRODUCT_COLS.qty),
        price: cell(row, PRODUCT_COLS.price),
        quotePrice: cell(row, PRODUCT_COLS.quotePrice),
      });
    }
    // Anything else (the "Product No, Product Name, ..." sub-header, the top
    // header, blank separator rows) is ignored.
  }

  return quotes;
}

/**
 * Parse what the user typed into the FC box.
 * Accepts "29", "FC29", "29-33", "fc29 - fc33", separated by commas,
 * semicolons, or whitespace.
 * @param {string} input
 * @returns {{numbers: number[], invalid: string[]}}
 */
export function parseFcList(input) {
  const numbers = [];
  const invalid = [];
  const seen = new Set();

  const push = (n) => {
    if (seen.has(n)) return;
    seen.add(n);
    numbers.push(n);
  };

  for (const rawToken of String(input ?? '').split(/[,;\s]+/)) {
    const token = rawToken.trim();
    if (!token) continue;

    const range = /^(?:fc)?0*(\d+)\s*(?:-|–|—|to|\.\.)\s*(?:fc)?0*(\d+)$/i.exec(token);
    if (range) {
      let [, a, b] = range;
      let from = Number(a);
      let to = Number(b);
      if (from > to) [from, to] = [to, from];
      for (let n = from; n <= to; n++) push(n);
      continue;
    }

    const single = /^(?:fc)?0*(\d+)$/i.exec(token);
    if (single) { push(Number(single[1])); continue; }

    invalid.push(token);
  }

  return { numbers, invalid };
}

/** One output row per line item, header fields repeated. */
export function flattenQuote(quote) {
  return quote.products.map((p) => [
    quote.type || 'Quote',
    quote.quoteNo,
    quote.status,
    quote.dateTime,
    p.type || 'Product',
    p.productName,
    p.sku,
    p.qty,
    p.price,
    p.quotePrice,
    quote.total,
    quote.name,
    quote.company,
    quote.email,
  ]);
}

/** One Transactions Pro row per line item; quote id and statics repeat. */
export function flattenQuoteTpro(quote, opts = {}) {
  const { shippingMethod = TPRO_DEFAULTS.shippingMethod, paymentMethod = TPRO_DEFAULTS.paymentMethod } = opts;
  // The quote id is what follows "FC" in the quote number, as a plain number.
  const quoteId = quote.fc === null || quote.fc === undefined ? '' : String(quote.fc);
  return quote.products.map((p) => [
    quoteId,
    '',
    '',
    shippingMethod,
    paymentMethod,
    p.qty,
    p.sku,
  ]);
}

/**
 * Pick the quotes the user asked for, in the order they typed them.
 *
 * @param {string[][]} rows parsed CSV rows
 * @param {string} fcInput raw text from the FC box
 * @returns {{picked: object[], matched: number[], missing: number[],
 *            invalid: string[], quotes: object[], available: number[]}}
 */
export function selectQuotes(rows, fcInput) {
  const quotes = parseQuotes(rows);
  const available = quotes.map((q) => q.fc).filter((n) => n !== null);
  const { numbers, invalid } = parseFcList(fcInput);

  const byFc = new Map();
  for (const q of quotes) {
    if (q.fc === null) continue;
    // Later entries with the same FC number win: the export grows by appending.
    byFc.set(q.fc, q);
  }

  const picked = [];
  const matched = [];
  const missing = [];

  for (const n of numbers) {
    const q = byFc.get(n);
    if (q) { picked.push(q); matched.push(n); } else { missing.push(n); }
  }

  return { picked, matched, missing, invalid, quotes, available };
}

/**
 * Importer-rows pipeline: export rows + FC numbers -> flat rows.
 * @returns {{header: string[], rows: string[][], matched: number[], missing: number[],
 *            invalid: string[], quotes: object[], available: number[]}}
 */
export function buildOutput(rows, fcInput) {
  const { picked, ...rest } = selectQuotes(rows, fcInput);
  return { header: OUTPUT_HEADER, rows: picked.flatMap(flattenQuote), ...rest };
}

/**
 * Transactions Pro pipeline: export rows + FC numbers -> flat rows.
 * @param {string[][]} rows
 * @param {string} fcInput
 * @param {{shippingMethod?: string, paymentMethod?: string}} [opts]
 */
export function buildTransactionsPro(rows, fcInput, opts = {}) {
  const { picked, ...rest } = selectQuotes(rows, fcInput);
  return { header: TPRO_HEADER, rows: picked.flatMap((q) => flattenQuoteTpro(q, opts)), ...rest };
}
