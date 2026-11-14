'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { identity, termsRecord, fileSlug } = require('../scripts/capture-product-screenshot');

test('terms acceptance fixture is bound to the exact terms content', () => {
  const terms = Buffer.from('Brightdesk test terms v1\n', 'utf8');
  const acceptedAt = new Date('2026-11-14T12:00:00.000Z');
  const record = termsRecord(terms, { version: '0.1.0' }, acceptedAt);
  assert.equal(record.accepted, true);
  assert.equal(record.termsVersion, '1.0');
  assert.equal(record.termsSha256, crypto.createHash('sha256').update(terms).digest('hex'));
  assert.equal(record.acceptedAt, acceptedAt.toISOString());
  assert.equal(record.appVersion, '0.1.0');
});

test('capture only accepts an identified Brightdesk product package', () => {
  assert.deepEqual(identity({ brightdeskAppId: 'pages', build: { productName: 'Brightdesk Pages' } }), { id: 'pages', name: 'Brightdesk Pages' });
  assert.throws(() => identity({ brightdeskAppId: '../pages', build: { productName: 'Brightdesk Pages' } }));
  assert.throws(() => identity({ brightdeskAppId: 'pages', build: { productName: 'Unknown' } }));
});

test('capture filenames use approved customer product names', () => {
  assert.equal(fileSlug('slides'), 'decks');
  assert.equal(fileSlug('loop'), 'workspace');
  assert.equal(fileSlug('todo'), 'todo');
});
