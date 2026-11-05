const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('renderer exposes language selection and catalogue installation only', () => {
  const html = read('src/index.html');
  const app = read('src/app.js');
  const preload = read('src/preload.js');
  const main = read('src/main.js');
  assert.match(html, /id="display-language"/);
  assert.match(html, /id="proofing-language"/);
  assert.match(html, /id="proofing-dictionary"/);
  assert.match(app, /installCatalogueDictionary\(item\.id\)/);
  for (const forbidden of ['import-language-pack', 'import-spelling-dictionary']) assert.doesNotMatch(html, new RegExp(forbidden));
  for (const forbidden of ['importLanguagePack', 'removeLanguagePack', 'importDictionary', 'removeDictionary']) assert.doesNotMatch(preload, new RegExp(forbidden));
  for (const forbidden of ["ipcMain.handle('languages:import'", "ipcMain.handle('languages:remove'", "ipcMain.handle('dictionaries:import'", "ipcMain.handle('dictionaries:remove'"]) assert.doesNotMatch(main, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('dictionary centre clearly describes immutable dictionary and licence records', () => {
  const html = read('src/index.html');
  assert.match(html, /licences, source details and author credits cannot be edited, replaced or removed/);
});


test('fresh suite installs activate only implemented apps; standalone installs lock to one app', () => {
  const app = read('src/app.js');
  assert.match(app, /installableCatalog\.map\(item => item\.id\)/);
  assert.match(app, /state\.setupComplete = state\.installedApps\.length > 0/);
  assert.match(app, /if \(launchAppId\) \{ state\.app = launchAppId; state\.view = 'workspace'; \}/);
  assert.match(app, /launchAppId && app !== launchAppId/);
});

test('Windows installer displays the Brightdesk licence and offers a normal setup flow', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.build.nsis.oneClick, false);
  assert.equal(pkg.build.nsis.license, 'TERMS_AND_CONDITIONS.txt');
  assert.equal(pkg.build.pkg.license, 'TERMS_AND_CONDITIONS.txt');
  assert.ok(pkg.build.mac.target.includes('pkg'));
  assert.equal(pkg.build.nsis.createDesktopShortcut, true);
  assert.equal(pkg.build.nsis.createStartMenuShortcut, true);
});

test('desktop installer workflow requires explicit build and release approval', () => {
  const workflow = read('.github/workflows/desktop-installers.yml');
  assert.match(workflow, /node-version: 24\\.22\\.2/);
  assert.match(workflow, /npm ci --no-audit --no-fund/);
  assert.ok(workflow.includes('npm run dist:desktop:${{ matrix.platform }}'));
  assert.ok(workflow.includes('npm run verify:desktop:${{ matrix.platform }}'));
  assert.match(workflow, /build_installers:[\\s\\S]*?default: false/);
  assert.match(workflow, /publish_release:[\\s\\S]*?default: false/);
  assert.match(workflow, /inputs\\.build_installers == true/);
  assert.match(workflow, /inputs\\.publish_release == true/);
  assert.match(workflow, /contents: write/);
  assert.match(workflow, /uses: softprops\\/action-gh-release/);
  assert.match(workflow, /github\\.event_name == 'workflow_dispatch' && inputs\\.publish_release == true/);
});
