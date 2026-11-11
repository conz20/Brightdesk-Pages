'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('individual Pages navigation supports expanded and compact desktop states', () => {
  const html = read('src/index.html');
  const js = read('src/app.js');
  const shellCss = read('src/product-window.css');

  assert.ok(html.includes('id="sidebar-toggle"'));
  assert.ok(html.includes('aria-controls="sidebar-nav"'));
  assert.ok(html.includes('aria-label="Brightdesk Pages"'));
  assert.match(js, /window\.innerWidth\s*<=\s*640/);
  assert.match(js, /window\.innerWidth\s*<=\s*1007/);
  assert.ok(js.includes("setSidebarState(launchAppId && window.innerWidth <= 1007 ? 'compact' : 'expanded')"));
  assert.doesNotMatch(js, /mobileSidebarOpen|open-mobile|sidebar-mobile-open|window\\.innerWidth\\s*<=\\s*640/);
  assert.match(js, /classList\.toggle\('is-compact', sidebarState === 'compact'\)/);
  assert.match(shellCss, /--bd-product-navigation-expanded-width, 232px/);
  assert.match(shellCss, /--bd-product-navigation-compact-width, 76px/);
});

test('compact navigation remains accessible and respects reduced motion', () => {
  const shellCss = read('src/product-window.css');
  assert.match(shellCss, /html\.is-product-window \.sidebar\.is-compact \.nav > span\s*\{[^}]*clip:\s*rect\(/s);
  assert.match(shellCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});
