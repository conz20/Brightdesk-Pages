'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('product navigation can collapse to an icon rail and expand accessibly', () => {
  const html = read('src/index.html');
  const js = read('src/app.js');
  const css = read('src/styles.css');
  assert.match(html, /id="sidebar-toggle"[^>]*aria-expanded="true"/);
  assert.match(html, /aria-label="Brightdesk Pages"[^>]*title="Brightdesk Pages"/);
  assert.match(html, /<svg class="app-icon manager-icon"[^>]*viewBox="0 0 24 24"/);
  assert.match(js, /function setSidebarCompact\(compact\)/);
  assert.match(js, /sidebarPreference/);
  assert.match(js, /window\\.innerWidth <= 640/);
  assert.match(js, /window\\.innerWidth <= 1007/);
  assert.match(js, /aria-expanded/);
  assert.match(css, /\.sidebar\.is-compact\s*\{[^}]*width:\s*76px/s);
  assert.match(css, /\.sidebar\.is-compact \.brand > div/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});
