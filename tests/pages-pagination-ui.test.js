'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file, folder = 'src') => fs.readFileSync(path.join(__dirname, '..', folder, file), 'utf8');

test('Pages loads the pagination helper before the editor application', () => {
  const html = read('index.html');
  assert.ok(html.indexOf('src="page-pagination.js"') >= 0);
  assert.ok(html.indexOf('src="page-pagination.js"') < html.indexOf('src="app.js"'));
});

test('Pages editor renders one labelled paper surface per flowing page', () => {
  const app = read('app.js');
  assert.ok(app.includes('function paginatePagesDocument()'));
  assert.ok(app.includes('pages-document-page'));
  assert.ok(app.includes('pagePagination.paginateBlocks'));
  assert.ok(app.includes("setAttribute('aria-label', `Page ${pageIndex + 1}`)"));
});

test('Pages stores document content without transient page-surface wrappers', () => {
  const app = read('app.js');
  assert.ok(app.includes('function serializePagesDocument()'));
  assert.ok(app.includes("node.classList.contains('pages-document-page')"));
  assert.ok(app.includes('serializePagesDocument()'));
  assert.ok(app.includes('activeDoc().html = serializePagesDocument()'));
});

test('Pages Insert ribbon includes an explicit page-break command', () => {
  const app = read('app.js');
  assert.ok(app.includes('function insertPagesPageBreak()'));
  assert.ok(app.includes('data-pages-page-break'));
  assert.ok(app.includes("'Page break'"));
});

test('safe document import keeps only the exact page-break marker attribute on HR elements', () => {
  const app = read('app.js');
  assert.ok(app.includes("child.tagName === 'HR'"));
  assert.ok(app.includes("attr.name === 'data-pages-page-break'"));
  assert.ok(app.includes("attr.value === 'true'"));
});

test('PDF export respects the selected supported paper size', () => {
  const app = read('app.js');
  const main = read('main.js');
  assert.ok(app.includes('pageSize: pageLayout.normalizePageLayout(activeDoc().pageSettings || {}).size'));
  assert.ok(main.includes("['A4', 'Letter', 'Legal'].includes(payload?.pageSize)"));
  assert.ok(main.includes("pageSize: requestedPageSize"));
});

test('print CSS isolates Pages and preserves page boundaries', () => {
  const css = read('styles.css');
  assert.ok(css.includes('.pages-document-page'));
  assert.ok(css.includes('@media print'));
  assert.ok(css.includes('break-after:page'));
  assert.ok(css.includes('page-break-after:always'));
});

test('DOCX extraction walks through visual page wrappers without merging a page into one paragraph', () => {
  const app = read('app.js');
  assert.ok(app.includes("if (el.classList?.contains('pages-document-page')) { el.childNodes.forEach(n=>walk(n,type)); return; }"));
});
