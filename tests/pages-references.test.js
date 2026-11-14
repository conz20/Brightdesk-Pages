'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const references = require('../src/pages-references');

test('Pages table of contents accepts safe generated heading identifiers', () => {
  assert.equal(references.normalizeHeadingId('pages-heading-abc123'), 'pages-heading-abc123');
  assert.equal(references.normalizeHeadingId('pages-heading-0123456789abcdef'), 'pages-heading-0123456789abcdef');
  assert.equal(references.normalizeHeadingId('external-link'), null);
  assert.equal(references.normalizeHeadingId('pages-heading-../../bad'), null);
});

test('Pages table of contents includes only non-empty Heading 1–3 entries', () => {
  const entries = references.buildTocEntries([
    { id: 'pages-heading-a1', level: 1, text: '  Introduction  ' },
    { id: 'pages-heading-b2', level: 2, text: 'Background' },
    { id: 'pages-heading-c3', level: 3, text: 'Details' },
    { id: 'pages-heading-d4', level: 4, text: 'Unsupported level' },
    { id: 'pages-heading-e5', level: 1, text: '   ' },
    { id: 'not-safe', level: 1, text: 'Unsafe identifier' }
  ]);

  assert.deepEqual(entries, [
    { id: 'pages-heading-a1', level: 1, text: 'Introduction' },
    { id: 'pages-heading-b2', level: 2, text: 'Background' },
    { id: 'pages-heading-c3', level: 3, text: 'Details' }
  ]);
});

test('Pages table of contents removes duplicate identifiers and normalises whitespace', () => {
  const entries = references.buildTocEntries([
    { id: 'pages-heading-a1', level: 1, text: ' First   heading ' },
    { id: 'pages-heading-a1', level: 2, text: 'Duplicate id' },
    { id: 'pages-heading-b2', level: 2, text: 'Second\nheading' }
  ]);

  assert.deepEqual(entries, [
    { id: 'pages-heading-a1', level: 1, text: 'First heading' },
    { id: 'pages-heading-b2', level: 2, text: 'Second heading' }
  ]);
});
