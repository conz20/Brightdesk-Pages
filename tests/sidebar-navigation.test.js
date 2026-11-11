'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('product navigation stays slim while keeping every icon and text label visible', () => {
  const html = read('src/index.html');
  const js = read('src/app.js');
  const css = read('src/styles.css');
  const shellCss = read('src/product-window.css');

  assert.ok(html.includes('id="sidebar-toggle"'));
  assert.ok(html.includes('aria-controls="sidebar-nav"'));
  assert.ok(html.includes('aria-label="Brightdesk'));
  assert.ok(html.includes('<span><b'));
  assert.ok(js.includes('function setSidebarState(state)'));
  assert.ok(js.includes('mobileSidebarOpen'));
  assert.ok(js.includes('window.innerWidth <= 640'));
  assert.doesNotMatch(js, /window\.innerWidth\s*<=\s*1007/);
  assert.doesNotMatch(js, /setSidebarState\('compact'\)/);
  assert.ok(css.includes('width: 232px;'));
  assert.ok(css.includes('width: 76px;'));
  assert.ok(css.includes('.sidebar.is-open-mobile'));
  assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'));
  assert.ok(shellCss.includes('var(--bd-product-navigation-expanded-width, 232px)'));
  assert.ok(shellCss.includes('var(--bd-product-navigation-compact-width, 76px)'));
  assert.match(shellCss, /html\.is-product-window \.sidebar\.is-open-mobile\s*\{[^}]*position:\s*fixed;[^}]*inset:\s*0 auto 0 0;/s);
});
