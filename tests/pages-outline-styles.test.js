'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = name => fs.readFileSync(path.join(__dirname, '..', 'src', name), 'utf8');

test('Pages workspace includes a searchable document outline next to the page canvas', () => {
  const html = read('index.html');
  const app = read('app.js');
  assert.match(html, /id="pages-navigation-pane"/);
  assert.match(html, /id="pages-outline-search"/);
  assert.match(html, /id="pages-outline"/);
  assert.match(app, /function refreshPagesOutline/);
  assert.match(app, /querySelectorAll('h1,h2,h3')/);
  assert.match(app, /pages-outline-item/);
});

test('Pages Home ribbon exposes real paragraph style commands', () => {
  const app = read('app.js');
  const html = read('index.html');
  const styles = read('styles.css');
  assert.match(app, /pages-style-gallery/);
  assert.match(app, /applyPagesParagraphStyle/);
  assert.match(app, /formatBlock/);
  assert.match(app, /pages-doc-title/);
  assert.match(app, /\{ label: 'Title', styleKey: 'title'/);
  assert.match(html, /class="pages-editor-layout"/);
  assert.match(styles, /\.pages-style-gallery/);
  assert.match(styles, /\.pages-navigation-pane/);
});

test('document outline rebuilds after editing and is refreshed after a document is rendered', () => {
  const app = read('app.js');
  assert.match(app, /editor\.addEventListener\('input',[\s\S]*?refreshPagesOutline\(\)/);
  assert.match(app, /editor\.innerHTML = state\.app === 'pages' \? safeHtml\(doc\.html\) : ''[\s\S]*?refreshPagesOutline\(\)/);
});
