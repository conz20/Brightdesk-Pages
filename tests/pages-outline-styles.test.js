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

test('safe document loading preserves only the approved Pages title paragraph class', () => {
  const app = read('app.js');
  assert.ok(app.includes("child.tagName === 'P' && attr.name === 'class' && attr.value === 'pages-doc-title'"));
  assert.ok(app.includes('!isSpan && !isPageBreak && !isTitleStyle'));
});


test('Pages Design ribbon offers selectable local style sets and watermark controls', () => {
  const app = read('app.js');
  const html = read('index.html');
  const styles = read('styles.css');
  const model = read('pages-style-sets.js');
  assert.ok(app.includes("pages: ['home', 'insert', 'design', 'layout', 'review', 'view']"));
  assert.ok(app.includes('function addPagesDesignGallery(toolbar)'));
  assert.ok(app.includes('function setPagesStyleSet(styleSetId)'));
  assert.ok(app.includes('function addPagesWatermarkControl(toolbar)'));
  assert.ok(app.includes('function setPagesPageColor(pageColor)'));
  assert.ok(app.includes('function setPagesPageBorder(pageBorder)'));
  assert.ok(app.includes('normalizePageColor(activeDoc().pageColor)'));
  assert.ok(app.includes('normalizePageBorder(activeDoc().pageBorder)'));
  assert.ok(app.includes('pagesStyleSets.normalizeWatermark(record.watermark)'));
  assert.ok(html.includes('<script src="pages-style-sets.js"></script>'));
  assert.ok(model.includes("name: 'Brightdesk'"));
  assert.ok(model.includes("name: 'Editorial'"));
  assert.ok(model.includes("name: 'Modern'"));
  assert.ok(styles.includes('.pages-design-card[aria-pressed="true"]'));
  assert.ok(styles.includes('#editor[data-style-set="editorial"]'));
  assert.ok(styles.includes('.pages-document-page[data-watermark="draft"]::before'));
  assert.ok(styles.includes('#editor[data-page-color="warm"]'));
  assert.ok(styles.includes('#editor[data-page-border="double"]'));
});


test('Pages References tab inserts and refreshes a linked table of contents', () => {
  const app = read('app.js');
  const html = read('index.html');
  const styles = read('styles.css');
  const references = read('pages-references.js');
  assert.ok(app.includes("pages: ['home', 'insert', 'design', 'layout', 'references', 'review', 'view']"));
  assert.ok(app.includes('function insertOrUpdatePagesTableOfContents()'));
  assert.ok(app.includes('function collectPagesTocEntries()'));
  assert.ok(app.includes('pagesReferences.buildTocEntries(rows)'));
  assert.ok(app.includes("addButton(references, 'Table of contents', insertOrUpdatePagesTableOfContents"));
  assert.ok(app.includes("child.tagName === 'A' && attr.name === 'href' && pagesReferences.normalizeHeadingHref(attr.value)"));
  assert.ok(app.includes("['H1','H2','H3'].includes(child.tagName) && attr.name === 'id'"));
  assert.ok(html.includes('<script src="pages-references.js"></script>'));
  assert.ok(references.includes('function normalizeHeadingHref(value)'));
  assert.ok(styles.includes('.pages-toc-level-2'));
  assert.ok(styles.includes('.pages-toc a:focus-visible'));
});
