'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = name => fs.readFileSync(path.join(__dirname, '..', 'src', name), 'utf8');

test('recovery operations are exposed only through sender-validated Electron IPC', () => {
  const main = read('main.js');
  assert.match(main, /ipcMain\.handle\('recovery:list'[\s\S]*?senderIsMain\(event\)[\s\S]*?recoveryService\.listSnapshots\(/);
  assert.match(main, /ipcMain\.handle\('recovery:save'[\s\S]*?senderIsMain\(event\)[\s\S]*?recoveryService\.saveSnapshot\(/);
  assert.match(main, /ipcMain\.handle\('recovery:read'[\s\S]*?senderIsMain\(event\)[\s\S]*?recoveryService\.readSnapshot\(/);
  assert.match(main, /ipcMain\.handle\('recovery:delete'[\s\S]*?senderIsMain\(event\)[\s\S]*?recoveryService\.deleteSnapshot\(/);
});

test('the context-isolated preload exposes only the four recovery operations', () => {
  const preload = read('preload.js');
  assert.match(preload, /listRecoveries: \(\) => ipcRenderer\.invoke\('recovery:list'\)/);
  assert.match(preload, /saveRecovery: \(snapshot\) => ipcRenderer\.invoke\('recovery:save', snapshot\)/);
  assert.match(preload, /readRecovery: \(id\) => ipcRenderer\.invoke\('recovery:read', id\)/);
  assert.match(preload, /deleteRecovery: \(id\) => ipcRenderer\.invoke\('recovery:delete', id\)/);
});

test('Pages provides explicit recover and discard actions for local recovery copies', () => {
  const html = read('index.html');
  const app = read('app.js');
  for (const id of ['recovery-banner', 'recovery-summary', 'recovery-open', 'recovery-discard']) {
    assert.ok(html.includes('id="' + id + '"'), id + ' is present in the workspace');
  }
  assert.match(app, /This copy is stored only on this device/);
  assert.match(app, /Recovered copy opened\. Save or export it as a new document/);
  assert.match(app, /Discard this recovery copy\?/);
});

test('Pages writes changed recovery snapshots every ten seconds and when leaving the window', () => {
  const app = read('app.js');
  assert.match(app, /window\.setInterval\(\(\) => \{ void flushPageRecovery\(\); \}, 10000\)/);
  assert.match(app, /window\.addEventListener\('blur', \(\) => \{ void flushPageRecovery\(\); \}\)/);
  assert.match(app, /document\.visibilityState === 'hidden'\) void flushPageRecovery\(\)/);
});


test('Pages recovery includes document style-set and watermark metadata', () => {
  const app = read('app.js');
  const service = read('recovery-service.js');
  assert.match(app, /styleSet: pagesStyleSets\.normalizeStyleSet\(doc\.styleSet\)/);
  assert.match(app, /watermark: pagesStyleSets\.normalizeWatermark\(doc\.watermark\)/);
  assert.match(service, /styleSet: normalizeStyleSet\(value\.styleSet\)/);
  assert.match(service, /watermark: normalizeWatermark\(value\.watermark\)/);
});
