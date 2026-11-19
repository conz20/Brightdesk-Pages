'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = name => fs.readFileSync(path.join(__dirname, '..', 'src', name), 'utf8');

test('Pages View exposes a saved Light/Dark workspace control', () => {
  const app = read('app.js');
  const html = read('index.html');
  const theme = read('pages-theme.js');
  assert.ok(app.includes('function applyPagesTheme()'));
  assert.ok(app.includes('function togglePagesTheme()'));
  assert.ok(app.includes("localStorage.setItem('brightdesk-pages-theme', state.theme)"));
  assert.ok(app.includes("state.theme = pagesTheme.normalizeTheme(localStorage.getItem('brightdesk-pages-theme'))"));
  assert.ok(app.includes("state.theme === 'dark' ? 'Light mode' : 'Dark mode'"));
  assert.ok(app.includes("document.documentElement.classList.toggle('pages-dark-mode', dark)"));
  assert.ok(html.includes('<script src="pages-theme.js"></script>'));
  assert.ok(theme.includes("const THEMES = Object.freeze(['light', 'dark'])"));
});

test('Pages Dark mode styles the workspace chrome while retaining light document pages', () => {
  const styles = read('styles.css');
  assert.ok(styles.includes('html.pages-dark-mode .workspace{'));
  assert.ok(styles.includes('html.pages-dark-mode .pages-navigation-pane{'));
  assert.ok(styles.includes('html.pages-dark-mode .pages-editor-column{'));
  assert.ok(styles.includes('html.pages-dark-mode .pages-document-page{color:#303348}'));
});
