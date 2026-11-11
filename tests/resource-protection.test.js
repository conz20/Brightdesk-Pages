const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('renderer exposes language selection and a browse-only dictionary catalogue', () => {
  const html = read('src/index.html');
  const app = read('src/app.js');
  const preload = read('src/preload.js');
  const main = read('src/main.js');
  assert.match(html, /id="display-language"/);
  assert.match(html, /id="proofing-language"/);
  assert.match(html, /id="proofing-dictionary"/);
  assert.match(app, /Not included in this build/);
  assert.doesNotMatch(app, /installCatalogueDictionary/);
  for (const forbidden of ['import-language-pack', 'import-spelling-dictionary']) assert.doesNotMatch(html, new RegExp(forbidden));
  for (const forbidden of ['importLanguagePack', 'removeLanguagePack', 'importDictionary', 'removeDictionary']) assert.doesNotMatch(preload, new RegExp(forbidden));
  for (const forbidden of [
    /ipcMain\.handle\('languages:import'/,
    /ipcMain\.handle\('languages:remove'/,
    /ipcMain\.handle\('dictionaries:import'/,
    /ipcMain\.handle\('dictionaries:remove'/
  ]) {
    assert.doesNotMatch(main, forbidden);
  }
  assert.doesNotMatch(main, /dictionaries:install-catalog/);
  assert.doesNotMatch(preload, /installCatalogueDictionary|dictionaries:install-catalog/);
});

test('dictionary centre explains local use and official Brightdesk update delivery', () => {
  const html = read('src/index.html');
  assert.match(html, /Installed dictionary resources are protected/);
  assert.match(html, /does not download dictionary files from third-party hosts at runtime/);
  assert.match(html, /Use installed dictionaries offline/);
  assert.match(html, /additional dictionary files can become available only when included in a verified official Brightdesk update/i);
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

test('desktop installer workflow verifies native products and keeps release publishing opt-in', () => {
  const workflow = read('.github/workflows/desktop-installers.yml');
  assert.ok(workflow.includes('node-version: 24.22.2'));
  assert.ok(workflow.includes('run: npm ci --no-audit --no-fund'));
  assert.ok(workflow.includes('run: npm test'));
  assert.ok(workflow.includes('npm run dist:desktop:'));
  assert.ok(workflow.includes('npm run verify:desktop:'));
  assert.ok(workflow.includes("if: github.event_name == 'workflow_dispatch' && inputs.build_installers == true"));
  assert.ok(workflow.includes("if: github.event_name == 'workflow_dispatch' && inputs.publish_release == true"));
  assert.ok(workflow.includes('contents: write'));
  assert.ok(workflow.includes('default: false'));
});
