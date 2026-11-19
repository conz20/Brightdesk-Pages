'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const theme = require('../src/pages-theme');

test('Pages theme defaults safely to light mode', () => {
  assert.equal(theme.normalizeTheme(undefined), 'light');
  assert.equal(theme.normalizeTheme(null), 'light');
  assert.equal(theme.normalizeTheme('unexpected'), 'light');
});

test('Pages theme accepts only the explicit dark and light modes', () => {
  assert.equal(theme.normalizeTheme('dark'), 'dark');
  assert.equal(theme.normalizeTheme('light'), 'light');
});
