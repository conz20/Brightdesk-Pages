'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative));
const text = relative => read(relative).toString('utf8');

test('loads the approved Inter faces from local files only', () => {
  const html = text('src/index.html');
  const css = text('src/fonts.css');
  assert.match(html, /href="fonts\.css"/);
  assert.match(css, /font-family:\s*"Inter"/);
  assert.match(css, /font-weight:\s*100\s+900/);
  assert.match(css, /font-style:\s*normal/);
  assert.match(css, /font-style:\s*italic/);
  assert.match(css, /url\("\.\/assets\/fonts\/inter\/Inter\[opsz,wght\]\.ttf"\)/);
  assert.match(css, /url\("\.\/assets\/fonts\/inter\/Inter-Italic\[opsz,wght\]\.ttf"\)/);
  assert.match(css, /font-optical-sizing:\s*auto/);
  assert.doesNotMatch(css, /https?:\/\//);
});

test('includes valid Inter variable binaries and the complete OFL 1.1 text', () => {
  for (const file of ['src/assets/fonts/inter/Inter[opsz,wght].ttf','src/assets/fonts/inter/Inter-Italic[opsz,wght].ttf']) {
    const bytes = read(file);
    assert.deepEqual([...bytes.subarray(0,4)], [0,1,0,0]);
    assert.ok(bytes.byteLength > 800_000);
  }
  assert.match(text('src/licenses/fonts/inter-OFL.txt'), /^Copyright 2020 The Inter Project Authors/);
  assert.match(text('src/licenses/fonts/inter-OFL.txt'), /SIL OPEN FONT LICENSE Version 1\.1/);
  assert.match(text('src/licenses/fonts/README.md'), /Inter 4\.1/);
});
