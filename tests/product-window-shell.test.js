'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', 'src');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const shellCss = fs.readFileSync(path.join(root, 'product-window.css'), 'utf8');
const appCss = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

test('individual product launch opens its focused workspace', () => {
  assert.match(app, /if \(launchAppId\) document\.documentElement\.classList\.add\('is-product-window'\)/);
  assert.match(app, /Boolean\(launchAppId\)/);
  assert.match(app, /PRODUCT WORKSPACE/);
});

test('product window retains its labelled navigation and fills the workspace', () => {
  assert.match(html, /href="product-window\.css"/);
  assert.match(shellCss, /html\.is-product-window body\s*\{[^}]*display:\s*flex;/s);
  assert.match(shellCss, /html\.is-product-window \.sidebar\s*\{[^}]*display:\s*flex\s*!important;/s);
  assert.doesNotMatch(shellCss, /html\.is-product-window \.sidebar\s*\{\s*display:\s*none/i);
  assert.match(shellCss, /html\.is-product-window \.workspace\s*\{[^}]*flex:\s*1 1 auto/s);
});


test('Pages matches the canonical shared adaptive navigation widths', () => {
  assert.match(shellCss, /--bd-product-navigation-expanded-width, 232px/);
  assert.match(shellCss, /--bd-product-navigation-compact-width, 76px/);
  assert.match(shellCss, /--bd-product-navigation-expanded-width, 232px\)[^}]*min-width:/s);
  assert.match(shellCss, /html\.is-product-window \.sidebar\.is-compact \.nav > span\s*\{[^}]*clip:\s*rect\(/s);
});

test('compact product labels remain available to assistive technology', () => {
  const compactLabelRule = shellCss.match(/html\.is-product-window \.sidebar\.is-compact \.nav > span\s*\{([^}]*)\}/);
  assert.ok(compactLabelRule, 'compact navigation labels must have a screen-reader-only rule');
  assert.match(compactLabelRule[1], /position:\s*absolute/i);
  assert.match(compactLabelRule[1], /clip:\s*rect\(/i);
  assert.doesNotMatch(compactLabelRule[1], /display:\s*none/i);
});

test('mobile navigation overlay is scoped to an individual product window', () => {
  assert.match(shellCss, /html\.is-product-window\s+body\.sidebar-mobile-open::before\s*\{/);
  assert.doesNotMatch(shellCss, /(^|\n)body\.sidebar-mobile-open::before\s*\{/);
});


test('legacy fixed-width navigation rules are restricted to the Suite shell', () => {
  assert.match(appCss, /html:not\(\.is-product-window\) \.sidebar\s*\{[^}]*width:\s*192px;/s);
  assert.match(appCss, /html:not\(\.is-product-window\) \.sidebar-toggle\s*\{\s*display:\s*none;/s);
  assert.doesNotMatch(appCss, /(^|\n)\.sidebar\.is-compact \.nav > span\s*\{[^}]*display:\s*initial\s*!important/s);
  assert.match(appCss, /html:not\(\.is-product-window\) \.sidebar\.is-compact \.nav > span,/);
  assert.doesNotMatch(appCss, /^\.sidebar\.is-compact \.brand > div,/m)
});
