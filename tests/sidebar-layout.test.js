import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('desktop sidebar is slim while preserving readable navigation labels and captions', () => {
  assert.match(css, /\.sidebar\s*\{[^}]*width:\s*192px/);
  assert.match(css, /\.nav\s+small\s*\{[^}]*display:\s*block/);
  assert.match(css, /\.nav\s+b\s*\{[^}]*font-size/);
});

test('mobile navigation keeps its labels, captions and icons visible', () => {
  const mobile = [...css.matchAll(/@media\s*\(max-width:\s*720px\)\s*\{([^}]*(?:\}[^}]*)*)\}/g)].map(m => m[1]).join('\n');
  assert.match(mobile, /\.nav\s+small\s*\{[^}]*display:\s*block/);
  assert.doesNotMatch(mobile, /\.nav\s+small\s*\{[^}]*display:\s*none/);
});
