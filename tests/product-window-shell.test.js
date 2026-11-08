const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sourceRoot = path.join(__dirname, '..', 'src');
const appSource = fs.readFileSync(path.join(sourceRoot, 'app.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(sourceRoot, 'index.html'), 'utf8');
const shellCss = fs.readFileSync(path.join(sourceRoot, 'product-window.css'), 'utf8');

test('individual product launch enables product-window mode', () => {
  assert.match(appSource, /if \(launchAppId\) document\.documentElement\.classList\.add\('is-product-window'\)/);
  assert.match(appSource, /Boolean\(launchAppId\)/);
});

test('product-window mode identifies the product and keeps the Suite shell separate', () => {
  assert.match(appSource, /PRODUCT WORKSPACE/);
  assert.match(appSource, /product-title-icon/);
  assert.match(htmlSource, /href="product-window\.css"/);
  assert.match(shellCss, /html\.is-product-window body\s*\{[^}]*display:\s*flex;/s);
  assert.match(shellCss, /html\.is-product-window \.sidebar\s*\{[^}]*display:\s*flex\s*!important;/s);
      assert.doesNotMatch(shellCss, /html\.is-product-window \.sidebar\{display:none!important\}/);
  assert.match(shellCss, /html\.is-product-window \.workspace\s*\{[^}]*flex:1 1 auto/s);
});
