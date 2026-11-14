'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const pagination = require('../src/page-pagination');

test('packs document blocks into pages without exceeding the available height', () => {
  assert.deepEqual(
    pagination.paginateBlocks([{ height: 200 }, { height: 300 }, { height: 400 }], 500),
    [[0, 1], [2]]
  );
});

test('starts a new page when a block would overflow the current page', () => {
  assert.deepEqual(
    pagination.paginateBlocks([{ height: 240 }, { height: 280 }, { height: 180 }], 500),
    [[0], [1, 2]]
  );
});

test('respects explicit page breaks before a block', () => {
  assert.deepEqual(
    pagination.paginateBlocks([
      { height: 100 },
      { height: 100, pageBreakBefore: true },
      { height: 100 }
    ], 500),
    [[0], [1, 2]]
  );
});

test('keeps a single block that is taller than a page on its own page', () => {
  assert.deepEqual(
    pagination.paginateBlocks([{ height: 720 }, { height: 120 }], 500),
    [[0], [1]]
  );
});

test('does not create empty pages for leading or trailing explicit breaks', () => {
  assert.deepEqual(
    pagination.paginateBlocks([
      { height: 10, pageBreakBefore: true },
      { height: 10, pageBreakBefore: true }
    ], 500),
    [[0], [1]]
  );
});

test('treats invalid and negative block heights as zero', () => {
  assert.deepEqual(
    pagination.paginateBlocks([{ height: Number.NaN }, { height: -10 }, { height: 20 }], 20),
    [[0, 1, 2]]
  );
});

test('rejects invalid page content heights', () => {
  assert.throws(() => pagination.paginateBlocks([], 0), RangeError);
  assert.throws(() => pagination.paginateBlocks([], Number.POSITIVE_INFINITY), RangeError);
});
