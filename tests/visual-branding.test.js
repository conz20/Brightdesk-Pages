'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const product = "Pages";
const accent = "#5966C9";
const iconPath = "src/assets/icons/pages.svg";

test(product + ' uses the approved Brightdesk visual contract and its original icon', () => {
  const css = fs.readFileSync(path.join(root, 'src', 'design-system.css'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  const brief = fs.readFileSync(path.join(root, 'docs', 'BRIGHTDESK_DESIGN.md'), 'utf8');
  const icon = fs.readFileSync(path.join(root, iconPath), 'utf8');

  assert.ok(css.includes('#F3F6FA'), 'shared workspace canvas must be pale');
  assert.ok(css.includes('#14233F') && css.includes('#0D1930'), 'navigation must use approved deep navy');
  assert.match(css, /\.sidebar\s*\{[^}]*background:var\(--bd-nav-background\)/s);
  const accents = [...css.matchAll(/--bd-accent\s*:\s*(#[0-9a-fA-F]{6})/g)];
  assert.ok(accents.length > 0, 'product accent token must exist');
  assert.equal(accents.at(-1)[1].toUpperCase(), accent);
  assert.ok(fs.existsSync(path.join(root, iconPath)), 'approved original icon must exist');
  assert.ok(html.includes(path.basename(iconPath)), 'running product interface must reference its original icon');
  assert.match(icon, /<svg[^>]+role="img"/);
  assert.ok(readme.includes('docs/BRIGHTDESK_DESIGN.md'), 'README must link the local approved design brief');
  assert.ok(brief.includes('BRIGHTDESK_VISUAL_STANDARD.md'), 'local brief must point to the canonical suite standard');
  assert.ok(brief.includes(accent), 'local brief must retain this product accent');
});
