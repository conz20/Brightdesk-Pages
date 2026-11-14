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



test('superseded Pages pull-request checks are cancelled before they build a backlog', () => {
  const installer = read('.github/workflows/desktop-installers.yml');
  const freshness = read('.github/workflows/readme-freshness.yml');
  const branchKey = '${{ github.event.pull_request.head.ref || github.ref }}';
  const cancellation = 'cancel-in-progress: ${{ github.event_name == \'pull_request\' }}';

  assert.ok(installer.includes('group: brightdesk-pages-installers-' + branchKey));
  assert.ok(freshness.includes('group: brightdesk-pages-readme-' + branchKey));
  assert.ok(installer.includes(cancellation));
  assert.ok(freshness.includes(cancellation));
});

test('desktop installer workflow verifies native products and publishes only after version-tag builds pass', () => {
  const workflow = read('.github/workflows/desktop-installers.yml');
  assert.ok(workflow.includes('node-version: 24.22.2'));
  assert.ok(workflow.includes('run: npm ci --no-audit --no-fund'));
  assert.ok(workflow.includes('run: npm test'));
  assert.ok(workflow.includes('npm run dist:desktop:${{ matrix.platform }}'));
  assert.ok(workflow.includes('npm run verify:desktop:${{ matrix.platform }}'));
  assert.ok(workflow.includes("tags: ['v*']"));
  assert.doesNotMatch(workflow, /workflow_dispatch/);
  assert.doesNotMatch(workflow, /ubuntu-latest|windows-latest|macos-latest/);

  const prepare = workflow.split('  prepare-release:')[1]?.split('  release-assets:')[0] ?? '';
  const assets = workflow.split('  release-assets:')[1]?.split('  publish-release:')[0] ?? '';
  const publish = workflow.split('  publish-release:')[1] ?? '';

  for (const job of [prepare, assets, publish]) {
    assert.ok(job.includes("if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')"));
  }
  assert.ok(prepare.includes('draft: true'));
  assert.ok(assets.includes('draft: true'));
  assert.ok(assets.includes('fail_on_unmatched_files: true'));
  assert.ok(publish.includes('needs: release-assets'));
  assert.ok(publish.includes('draft: false'));
  assert.ok(workflow.includes('contents: read'));
});
