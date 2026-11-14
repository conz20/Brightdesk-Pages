'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = name => fs.readFileSync(path.join(__dirname, '..', 'src', name), 'utf8');

test('Pages document ruler is present in the writing canvas', () => {
  const html = read('index.html');
  for (const id of ['pages-ruler-wrap', 'pages-ruler', 'pages-ruler-left-margin', 'pages-ruler-right-margin', 'pages-ruler-ticks']) {
    assert.ok(html.includes('id="' + id + '"'), id + ' exists');
  }
  assert.match(html, /aria-label="Horizontal ruler in centimetres"/);
});

test('Pages ruler is built from the selected paper size and margin settings', () => {
  const app = read('app.js');
  assert.match(app, /function updatePagesRuler/);
  assert.match(app, /pageLayout\\.getRulerMarks\\(settings, 'cm'\\)/);
  assert.match(app, /pageLayout\\.PAGE_MARGINS\\[settings\\.margin\\]/);
  assert.match(app, /function applyPageLayout[\\s\\S]*?updatePagesRuler\\(\\)/);
});

test('Pages View ribbon can show and hide the ruler accessibly', () => {
  const app = read('app.js');
  assert.match(app, /showRuler: true/);
  assert.match(app, /Show ruler/);
  assert.match(app, /setAttribute\\('aria-pressed', String\\(state\\.showRuler\\)\\)/);
  assert.match(app, /updatePagesRuler\\(\\)/);
});

test('ruler is hidden outside Pages and when the user switches it off', () => {
  const app = read('app.js');
  assert.match(app, /state\\.app === 'pages' && state\\.showRuler/);
  assert.match(app, /wrap\\.hidden = !visible/);
});
