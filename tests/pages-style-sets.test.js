'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const styles = require('../src/pages-style-sets');

test('Pages document style sets expose the approved Brightdesk, Editorial and Modern presets', () => {
  assert.deepEqual(Object.keys(styles.STYLE_SETS), ['brightdesk', 'editorial', 'modern']);
  assert.equal(styles.DEFAULT_STYLE_SET, 'brightdesk');
  assert.equal(styles.STYLE_SETS.editorial.name, 'Editorial');
  assert.equal(styles.STYLE_SETS.editorial.headingTone, 'plum');
  assert.equal(styles.STYLE_SETS.modern.headingTone, 'teal');
});

test('document style set selection falls back safely for missing or unknown identifiers', () => {
  assert.equal(styles.normalizeStyleSet('editorial'), 'editorial');
  assert.equal(styles.normalizeStyleSet('modern'), 'modern');
  assert.equal(styles.normalizeStyleSet('unknown'), 'brightdesk');
  assert.equal(styles.normalizeStyleSet(null), 'brightdesk');
});

test('watermark choices are restricted to none, draft and confidential', () => {
  assert.deepEqual(styles.WATERMARKS, ['none', 'draft', 'confidential']);
  assert.equal(styles.normalizeWatermark('draft'), 'draft');
  assert.equal(styles.normalizeWatermark('confidential'), 'confidential');
  assert.equal(styles.normalizeWatermark('external'), 'none');
  assert.equal(styles.normalizeWatermark(undefined), 'none');
});
