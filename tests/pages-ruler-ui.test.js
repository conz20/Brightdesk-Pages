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
  assert.ok(html.includes('aria-label="Horizontal ruler in centimetres"'));
});

test('Pages ruler is built from the selected paper size and margin settings', () => {
  const app = read('app.js');
  assert.ok(app.includes('function updatePagesRuler()'));
  assert.ok(app.includes("pageLayout.getRulerMarks(settings, 'cm')"));
  assert.ok(app.includes('pageLayout.PAGE_MARGINS[settings.margin]'));
  const applyLayout = app.slice(app.indexOf('function applyPageLayout()'), app.indexOf('function changeEditorZoom'));
  assert.ok(applyLayout.includes('updatePagesRuler()'));
});

test('Pages View ribbon can show and hide the ruler accessibly', () => {
  const app = read('app.js');
  assert.ok(app.includes('showRuler: true'));
  assert.ok(app.includes('Show ruler'));
  assert.ok(app.includes("setAttribute('aria-pressed', String(state.showRuler))"));
});

test('ruler is hidden outside Pages and when the user switches it off', () => {
  const app = read('app.js');
  assert.ok(app.includes("state.app === 'pages' && state.showRuler"));
  assert.ok(app.includes('wrap.hidden = !visible'));
});
