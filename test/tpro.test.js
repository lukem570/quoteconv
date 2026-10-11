import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, toCsv } from '../js/csv.js';
import {
  buildTransactionsPro, flattenQuoteTpro, selectQuotes,
  TPRO_HEADER, TPRO_COLUMNS, TPRO_DEFAULTS,
} from '../js/transform.js';
import { EXPORT_CSV, PRODUCT_COUNTS } from './fixtures.js';

const SAMPLE = parseCsv(EXPORT_CSV);

test('header matches the stakeholders’ sample image, with two blank columns', () => {
  assert.deepEqual(TPRO_HEADER, ['Quote #', '', '', 'Shipping Method', 'Payment Method', 'Qty', 'SKU']);
  assert.equal(TPRO_COLUMNS.length, 7);
  assert.deepEqual(TPRO_COLUMNS.slice(1, 3).map((c) => c.key), ['blank1', 'blank2']);
});

test('quote id is the number after FC, repeated on every line item', () => {
  const out = buildTransactionsPro(SAMPLE, '31');
  assert.equal(out.rows.length, PRODUCT_COUNTS[31]);
  assert.equal(out.rows.every((r) => r[0] === '31'), true);
});

test('row shape: id, two blanks, statics filled down, qty and sku from the export', () => {
  const out = buildTransactionsPro(SAMPLE, '29');
  assert.deepEqual(out.rows[0], ['29', '', '', 'BIBO - BestWay', 'Purchase Order', '1', '1KKMM']);
  assert.equal(out.rows.every((r) => r[1] === '' && r[2] === ''), true);
  assert.equal(out.rows.every((r) => r[3] === TPRO_DEFAULTS.shippingMethod), true);
  assert.equal(out.rows.every((r) => r[4] === TPRO_DEFAULTS.paymentMethod), true);
});

test('qty comes from the export, not hardcoded to 1', () => {
  const out = buildTransactionsPro(SAMPLE, '30');
  assert.deepEqual(out.rows.map((r) => r[5]), ['2', '2']);
  assert.deepEqual(out.rows.map((r) => r[6]), ['6WBAI', '6PWM']);
});

test('static values are overridable', () => {
  const out = buildTransactionsPro(SAMPLE, '54', { shippingMethod: 'Pickup', paymentMethod: 'Net 30' });
  assert.deepEqual(out.rows[0].slice(3, 5), ['Pickup', 'Net 30']);
});

test('multiple quotes keep their own ids, in the order typed', () => {
  const out = buildTransactionsPro(SAMPLE, '54, 29');
  assert.deepEqual(out.matched, [54, 29]);
  assert.deepEqual(
    out.rows.map((r) => r[0]),
    [...Array(PRODUCT_COUNTS[54]).fill('54'), ...Array(PRODUCT_COUNTS[29]).fill('29')],
  );
});

test('missing and invalid FC numbers are reported the same way as the other format', () => {
  const out = buildTransactionsPro(SAMPLE, '29, 99, abc');
  assert.deepEqual(out.matched, [29]);
  assert.deepEqual(out.missing, [99]);
  assert.deepEqual(out.invalid, ['abc']);
});

test('flattenQuoteTpro handles a quote with no FC number', () => {
  const quote = { fc: null, products: [{ qty: '1', sku: 'X' }] };
  assert.deepEqual(flattenQuoteTpro(quote), [['', '', '', 'BIBO - BestWay', 'Purchase Order', '1', 'X']]);
});

test('selectQuotes feeds both formats the same picked quotes', () => {
  const { picked, matched } = selectQuotes(SAMPLE, '31, 29');
  assert.deepEqual(matched, [31, 29]);
  assert.deepEqual(picked.map((q) => q.fc), [31, 29]);
});

test('blank columns survive CSV serialization as empty fields', () => {
  const out = buildTransactionsPro(SAMPLE, '54');
  const lines = toCsv([TPRO_HEADER, ...out.rows]).split('\r\n');
  assert.equal(lines[0], 'Quote #,,,Shipping Method,Payment Method,Qty,SKU');
  assert.equal(lines[1], '54,,,BIBO - BestWay,Purchase Order,1,CARS10-SET');
});
