'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = name => fs.readFileSync(path.join(__dirname, '..', 'src', name), 'utf8');

test('Pages workspace includes a searchable document outline next to the page canvas', () => {
  const html = read('index.html');
  const app = read('app.js');
  assert.ok(html.includes('id="pages-navigation-pane"'));
  assert.ok(html.includes('id="pages-outline-search"'));
  assert.ok(html.includes('id="pages-outline"'));
  assert.ok(app.includes('function refreshPagesOutline()'));
  assert.ok(app.includes("editor.querySelectorAll('h1,h2,h3')"));
  assert.ok(app.includes('pages-outline-item'));
});

test('Pages Home ribbon exposes real paragraph style commands', () => {
  const app = read('app.js');
  const html = read('index.html');
  const styles = read('styles.css');
  assert.ok(app.includes('pages-style-gallery'));
  assert.ok(app.includes('applyPagesParagraphStyle'));
  assert.ok(app.includes("document.execCommand('formatBlock'"));
  assert.ok(app.includes('pages-doc-title'));
  assert.ok(app.includes("{ label: 'Title', styleKey: 'title', style: 'title' }"));
  assert.ok(html.includes('class="pages-editor-layout"'));
  assert.ok(styles.includes('.pages-style-gallery'));
  assert.ok(styles.includes('.pages-navigation-pane'));
});

test('document outline rebuilds after editing and is refreshed after a document is rendered', () => {
  const app = read('app.js');
  const inputHandler = app.slice(app.indexOf("editor.addEventListener('input'"), app.indexOf("\n$('pages-outline-search')"));
  assert.ok(inputHandler.includes("activeDoc().html=serializePagesDocument()"));
  assert.ok(inputHandler.includes("schedulePagesPagination()"));
  assert.ok(inputHandler.includes("refreshPagesOutline()"));
  const renderIndex = app.indexOf("editor.innerHTML = state.app === 'pages' ? safeHtml(doc.html) : '';");
  const outlineIndex = app.indexOf('refreshPagesOutline();', renderIndex);
  assert.ok(renderIndex >= 0 && outlineIndex > renderIndex);
});
