'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = name => fs.readFileSync(path.join(__dirname, '..', 'src', name), 'utf8');

test('Pages loads its local text-search helper before the workspace script', () => {
  const html = read('index.html');
  assert.ok(html.indexOf('src="text-search.js"') < html.indexOf('src="app.js"'));
});

test('Pages Find and Replace panel exposes accessible local document controls', () => {
  const html = read('index.html');
  for (const id of [
    'pages-find-toggle', 'pages-find-panel', 'pages-find-query', 'pages-replace-query',
    'pages-find-case', 'pages-find-whole-word', 'pages-find-next',
    'pages-replace-one', 'pages-replace-all', 'pages-find-status'
  ]) assert.ok(html.includes('id="' + id + '"'), id + ' exists');
  assert.match(html, /aria-live="polite"/);
});

test('Pages Find and Replace searches the active editor and persists changes', () => {
  const app = read('app.js');
  assert.match(app, /function getPagesSearchSegments/);
  assert.match(app, /function findPagesMatches/);
  assert.match(app, /function selectPagesSearchMatch/);
  assert.match(app, /function replacePagesMatch/);
  assert.match(app, /function replaceAllPagesMatches/);
  assert.match(app, /persist\(\)/);
});

test('Pages Home ribbon provides a command to open Find and Replace', () => {
  const app = read('app.js');
  assert.match(app, /Find & Replace/);
  assert.match(app, /pages-find-toggle/);
});


test('the text-search helper is exported to the context-isolated renderer without Node access', () => {
  const helper = read('text-search.js');
  assert.match(helper, /window\.BrightdeskTextSearch = api/);
  assert.match(helper, /typeof module !== 'undefined'/);
});
