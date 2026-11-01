'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createDesktopDownload, APP_SLUGS } = require('../src/desktop-downloads');

const expected = {
  pages: 'Pages',
  sheets: 'Sheets',
  slides: 'Decks',
  notes: 'Notes',
  database: 'Database',
  forms: 'Forms',
  lists: 'Lists',
  planner: 'Planner',
  todo: 'To-Do',
  loop: 'Workspace'
};

test('desktop installer download map covers exactly the approved ten Brightdesk products', () => {
  assert.deepEqual(APP_SLUGS, expected);
});

test('each Brightdesk product resolves to its own release asset on Windows, macOS and Linux', () => {
  for (const [appId, slug] of Object.entries(expected)) {
    const cases = [
      ['win32', `Brightdesk-${slug}-0.1.0-x64.exe`],
      ['darwin', `Brightdesk-${slug}-0.1.0-universal.dmg`],
      ['linux', `brightdesk-${slug.toLowerCase()}-0.1.0-x64.AppImage`]
    ];
    for (const [platform, filename] of cases) {
      const result = createDesktopDownload({ appId, platform, version: '0.1.0' });
      assert.equal(result.filename, filename, `${appId} on ${platform}`);
      assert.equal(result.url, `https://github.com/connormolloy12/Brightdesk-suite/releases/latest/download/${encodeURIComponent(filename)}`);
    }
  }
});

test('desktop installer download rejects names outside the approved Brightdesk catalogue', () => {
  assert.throws(() => createDesktopDownload({ appId: 'outlook', platform: 'darwin', version: '0.1.0' }), /not available/);
});

test('desktop installer download rejects unsupported operating systems', () => {
  assert.throws(() => createDesktopDownload({ appId: 'pages', platform: 'freebsd', version: '0.1.0' }), /not supported/);
});

test('desktop installer download validates the release version before building a URL', () => {
  assert.throws(() => createDesktopDownload({ appId: 'pages', platform: 'win32', version: '../latest' }), /valid release version/);
});

test('desktop installer verifier can verify one app repository without requiring the other nine apps', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const { expectedFilename, verifyStandaloneApps } = require('../scripts/verify-desktop-installers');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'brightdesk-one-product-'));
  try {
    const appDirectory = path.join(directory, 'pages');
    fs.mkdirSync(appDirectory, { recursive: true });
    for (const filename of expectedFilename('pages', 'mac', '0.1.0')) {
      fs.writeFileSync(path.join(appDirectory, filename), 'verified test installer');
    }
    const result = verifyStandaloneApps({ directory, platform: 'mac', version: '0.1.0', appId: 'pages' });
    assert.equal(result.appCount, 1);
    assert.equal(result.apps[0].appId, 'pages');
    assert.equal(result.fileCount, 3);
    assert.ok(fs.existsSync(path.join(appDirectory, 'Brightdesk-pages-SHA256SUMS-MAC.txt')));
    assert.throws(() => verifyStandaloneApps({ directory, platform: 'mac', version: '0.1.0', appId: 'outlook' }), /approved Brightdesk product/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
