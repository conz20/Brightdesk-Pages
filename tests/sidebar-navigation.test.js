'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('product navigation adapts between expanded, compact and minimal states', () => {
  const html = read('src/index.html');
  const js = read('src/app.js');
  const css = read('src/styles.css');
  assert.ok(html.includes('id="sidebar-toggle"'));
  assert.ok(html.includes('aria-controls="sidebar-nav"'));
  assert.ok(html.includes('aria-label="Brightdesk Pages" title="Brightdesk Pages"'));
  assert.ok(html.includes('<svg class="app-icon manager-icon" viewBox="0 0 24 24"'));
  assert.ok(js.includes('function setSidebarState(state)'));
  assert.ok(js.includes('mobileSidebarOpen'));
  assert.ok(js.includes('window.innerWidth <= 640'));
  assert.ok(js.includes('window.innerWidth <= 1007'));
  assert.ok(css.includes('width: 232px;'));
  assert.ok(css.includes('width: 76px;'));
  assert.ok(css.includes('.sidebar.is-minimal'));
  assert.ok(css.includes('.sidebar.is-open-mobile'));
  assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'));
});
