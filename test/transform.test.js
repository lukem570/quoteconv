import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv } from '../js/csv.js';
import {
  buildOutput, flattenQuote, parseQuotes, parseFcList, fcNumberOf,
  OUTPUT_HEADER, OUTPUT_COLUMNS,
} from '../js/transform.js';

import { EXPORT_CSV, FC_NUMBERS, PRODUCT_COUNTS } from './fixtures.js';

const SAMPLE = parseCsv(EXPORT_CSV);

test('output header matches the importer format in docs/before-after.xlsx', () => {
  assert.deepEqual(OUTPUT_HEADER, [
    'Quote', 'Quote No', 'Status', 'Date Time', 'Type', 'Item', 'SKU', 'Quantity',
    'Original Price', 'Quote Price', 'Total', 'Name', 'Company', 'Email',
  ]);
  assert.equal(OUTPUT_COLUMNS.length, OUTPUT_HEADER.length);
});

test('fcNumberOf reads the FC number out of a quote number', () => {
  assert.equal(fcNumberOf('RR Books Quote FC29'), 29);
  assert.equal(fcNumberOf('RR Books Quote FC007'), 7);
  assert.equal(fcNumberOf('no number here'), null);
});

test('parseQuotes groups products under their quote and skips sub-headers', () => {
  const quotes = parseQuotes(SAMPLE);
  assert.equal(quotes.length, FC_NUMBERS.length);
  assert.deepEqual(quotes.map((q) => q.fc), FC_NUMBERS);

  const fc31 = quotes.find((q) => q.fc === 31);
  assert.equal(fc31.products.length, PRODUCT_COUNTS[31]);
  assert.equal(fc31.status, 'Draft');
  assert.equal(fc31.total, '175.88');
  assert.equal(fc31.dateTime, '7/24/2026 9:36');
  assert.equal(fc31.products[0].sku, '6TMBT');
  assert.equal(fc31.products[1].productName, 'The Fox, the Goat, and the Well - Level G/13');
});

test('parseFcList handles singles, ranges, FC prefixes and junk', () => {
  assert.deepEqual(parseFcList('29, 31-33, FC54'), { numbers: [29, 31, 32, 33, 54], invalid: [] });
  assert.deepEqual(parseFcList('fc33-fc31'), { numbers: [31, 32, 33], invalid: [] });
  assert.deepEqual(parseFcList('29 29 FC29'), { numbers: [29], invalid: [] });
  assert.deepEqual(parseFcList('30\n52'), { numbers: [30, 52], invalid: [] });
  assert.deepEqual(parseFcList('abc, 30'), { numbers: [30], invalid: ['abc'] });
  assert.deepEqual(parseFcList(''), { numbers: [], invalid: [] });
});

test('flattenQuote repeats the quote fields on every line item', () => {
  const quote = {
    type: 'Quote', quoteNo: 'RR Books Quote FC10', status: 'Draft',
    dateTime: '7/7/2026 11:07', total: '99.5', name: 'Gwen Jones',
    company: 'Pine School', email: 'gwen@school.edu',
    products: [
      { type: 'Product', productName: 'What Is My Name? - Level G/13', sku: '1WIMN', qty: '2', price: '6.75', quotePrice: '5.75' },
      { type: 'Product', productName: 'Stuck in the Muck - Level I/16', sku: '1SITM', qty: '2', price: '6.75', quotePrice: '5.75' },
    ],
  };
  assert.deepEqual(flattenQuote(quote), [
    ['Quote', 'RR Books Quote FC10', 'Draft', '7/7/2026 11:07', 'Product', 'What Is My Name? - Level G/13', '1WIMN', '2', '6.75', '5.75', '99.5', 'Gwen Jones', 'Pine School', 'gwen@school.edu'],
    ['Quote', 'RR Books Quote FC10', 'Draft', '7/7/2026 11:07', 'Product', 'Stuck in the Muck - Level I/16', '1SITM', '2', '6.75', '5.75', '99.5', 'Gwen Jones', 'Pine School', 'gwen@school.edu'],
  ]);
});

test('buildOutput emits one row per line item, in the order typed', () => {
  const out = buildOutput(SAMPLE, '31, 29');
  assert.deepEqual(out.matched, [31, 29]);
  assert.deepEqual(out.missing, []);
  assert.equal(out.rows.length, PRODUCT_COUNTS[31] + PRODUCT_COUNTS[29]);
  assert.equal(out.rows[0][1], 'RR Books Quote FC31');
  assert.equal(out.rows[PRODUCT_COUNTS[31]][1], 'RR Books Quote FC29');
  assert.equal(out.rows.every((r) => r.length === OUTPUT_HEADER.length), true);
});

test('buildOutput reports FC numbers not in the file', () => {
  const out = buildOutput(SAMPLE, '29, 99');
  assert.deepEqual(out.matched, [29]);
  assert.deepEqual(out.missing, [99]);
  assert.equal(out.rows.length, PRODUCT_COUNTS[29]);
});

test('buildOutput with no FC numbers produces no rows but still lists the file', () => {
  const out = buildOutput(SAMPLE, '');
  assert.deepEqual(out.rows, []);
  assert.deepEqual(out.available, FC_NUMBERS);
});

test('a range picks up every quote in it', () => {
  const out = buildOutput(SAMPLE, '29-31');
  assert.deepEqual(out.matched, [29, 30, 31]);
  assert.equal(out.rows.length, PRODUCT_COUNTS[29] + PRODUCT_COUNTS[30] + PRODUCT_COUNTS[31]);
});

test('product rows before any quote row are ignored', () => {
  const rows = parseCsv('Product,1,Orphan,SKU,1,1,1\nQuote,RR Books Quote FC1,1/1/2026,n,e,c,Draft,1\nProduct,1,Real,SKU,1,1,1');
  const out = buildOutput(rows, '1');
  assert.equal(out.rows.length, 1);
  assert.equal(out.rows[0][5], 'Real');
});

test('a later quote with the same FC number replaces the earlier one', () => {
  const rows = parseCsv([
    'Quote,RR Books Quote FC5,1/1/2026,old,e,c,Draft,1',
    'Product,1,Old item,SKU1,1,1,1',
    'Quote,RR Books Quote FC5,2/2/2026,new,e,c,Draft,2',
    'Product,1,New item,SKU2,1,2,2',
  ].join('\n'));
  const out = buildOutput(rows, '5');
  assert.equal(out.rows.length, 1);
  assert.equal(out.rows[0][5], 'New item');
});
