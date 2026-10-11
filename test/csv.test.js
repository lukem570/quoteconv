import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, toCsv, toTsv, escapeField } from '../js/csv.js';

test('parses quoted fields, embedded commas and escaped quotes', () => {
  assert.deepEqual(parseCsv('a,"b,1",c\r\nd,"he said ""hi""",'), [
    ['a', 'b,1', 'c'],
    ['d', 'he said "hi"', ''],
  ]);
});

test('parses newlines inside quoted fields', () => {
  assert.deepEqual(parseCsv('a,"two\nlines"\nb,c'), [['a', 'two\nlines'], ['b', 'c']]);
});

test('strips a BOM and trailing blank lines', () => {
  assert.deepEqual(parseCsv('﻿a,b\n\n\n'), [['a', 'b']]);
});

test('keeps empty leading and trailing fields', () => {
  assert.deepEqual(parseCsv(',Product No,,'), [['', 'Product No', '', '']]);
});

test('escapeField quotes only when needed', () => {
  assert.equal(escapeField('plain'), 'plain');
  assert.equal(escapeField('a,b'), '"a,b"');
  assert.equal(escapeField('say "hi"'), '"say ""hi"""');
  assert.equal(escapeField(undefined), '');
});

test('toCsv round-trips through parseCsv', () => {
  const rows = [['Quote', 'RR Books Quote FC29'], ['Product', 'The Fox, the Goat, and the Well']];
  assert.deepEqual(parseCsv(toCsv(rows)), rows);
});

test('toCsv uses CRLF', () => {
  assert.equal(toCsv([['a'], ['b']]), 'a\r\nb');
});

test('toTsv flattens tabs and newlines', () => {
  assert.equal(toTsv([['a\tb', 'c\nd']]), 'a b\tc d');
});
