'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const catalog = require('../src/app-catalog');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('app catalogue contains exactly the ten approved first-release apps', () => {
  assert.deepEqual(catalog.map(app => app.id), ['pages','sheets','slides','notes','database','forms','lists','planner','todo','loop']);
  assert.deepEqual(catalog.map(app => app.name), ['Brightdesk Pages','Brightdesk Sheets','Brightdesk Decks','Brightdesk Notes','Brightdesk Database','Brightdesk Forms','Brightdesk Lists','Brightdesk Planner','Brightdesk To Do','Brightdesk Workspace']);
  assert.equal(catalog.filter(app => app.availability === 'available').length, 10);
  assert.equal(catalog.filter(app => app.availability === 'planned').length, 0);
});

test('every app has a unique id, release version and user-facing details', () => {
  const ids = catalog.map(app => app.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const app of catalog) {
    assert.match(app.moduleVersion, /^\d+\.\d+\.\d+$/);
    assert.ok(app.name && app.subtitle && app.description && app.icon);
  }
});

test('first release version is consistently 0.1.0 across package, available apps and shell', () => {
  const pkg = JSON.parse(read('package.json'));
  const html = read('src/index.html');
  assert.equal(pkg.version, '0.1.0');
  for (const app of catalog) assert.equal(app.moduleVersion, pkg.version);
  assert.match(html, /Version 0\.1\.0/);
  assert.match(html, /Brightdesk 0\.1\.0/);
});

test('Brightdesk keeps its own identity and does not claim Microsoft affiliation', () => {
  const readme = read('README.md');
  assert.match(readme, /independent/i);
  assert.match(readme, /not affiliated with Microsoft/i);
});

test('automatic updates stay disabled until a real GitHub owner is configured', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.deepEqual(pkg.build.publish, []);
  assert.match(read('src/main.js'), /Automatic updates will be available after the Brightdesk GitHub release repository is configured/);
});

test('the main app rail keeps the four core apps as the permanent base rail', () => {
  const html = read('src/index.html');
  for (const name of ['Brightdesk Pages','Brightdesk Sheets','Brightdesk Decks','Brightdesk Notes']) assert.match(html, new RegExp('<b>' + name + '</b>'));
  for (const oldName of ['<b>Word</b>','<b>Excel</b>','<b>PowerPoint</b>','<b>OneNote</b>']) assert.doesNotMatch(html, new RegExp(oldName));
});

test('catalog is hard-limited to the ten approved Brightdesk apps', () => {
  assert.deepEqual(catalog.map(item => item.id), ['pages','sheets','slides','notes','database','forms','lists','planner','todo','loop']);
  const forbidden = ['teams','outlook','onedrive','diagrams','stories','video','whiteboard','bookings','sharepoint','powerapps','powerautomate','analytics','projects','viva','places','copilot'];
  for (const id of forbidden) assert.equal(catalog.some(item => item.id === id), false, `forbidden app present: ${id}`);
});

test('the canonical product scope lock matches the executable catalogue', () => {
  const scope = read('PRODUCT_SCOPE_LOCK.md');
  for (const name of catalog.map(item => item.name)) assert.ok(scope.includes(name), `scope lock missing ${name}`);
  for (const excluded of ['Outlook','OneDrive','Teams']) assert.match(scope, new RegExp('\\b' + excluded + '\\b'));
  assert.match(scope, /scope can change only when the user explicitly instructs/i);
});

test('all catalogue modules have independent Brightdesk metadata', () => {
  for (const item of catalog) {
    assert.ok(item.id && item.name && item.description && item.moduleVersion);
    assert.equal(typeof item.microsoftReference, 'string');
  }
});

test('all ten integrated apps are marked installable', () => {
  assert.deepEqual(catalog.filter(item => item.availability === 'available').map(item => item.id), ['pages','sheets','slides','notes','database','forms','lists','planner','todo','loop']);
});

test('standalone app packaging has independent product IDs and all three platform targets', () => {
  const configPath = path.join(root, 'electron-builder.app.config.js');
  const previousAppId = process.env.BRIGHTDESK_APP_ID;
  const artifactPattern = '$' + '{version}-' + '$' + '{arch}.' + '$' + '{ext}';
  try {
    for (const app of catalog) {
      process.env.BRIGHTDESK_APP_ID = app.id;
      delete require.cache[require.resolve(configPath)];
      const config = require(configPath);
      const displayName = app.name.replace(/^Brightdesk /, '');
      const slug = app.id === 'todo' ? 'To-Do' : displayName;
      assert.equal(config.appId, 'org.brightdesk.' + app.id);
      assert.equal(config.productName, 'Brightdesk ' + displayName);
      assert.equal(config.extraMetadata.brightdeskAppId, app.id);
      assert.equal(config.extraMetadata.desktopName, 'org.brightdesk.' + app.id + '.desktop');
      assert.equal(config.directories.output, path.join('release','apps',app.id));
      assert.equal(config.publish.length, 0);
      assert.equal(config.win.artifactName, 'Brightdesk-' + slug + '-' + artifactPattern);
      assert.equal(config.mac.artifactName, 'Brightdesk-' + slug + '-' + artifactPattern);
      assert.equal(config.linux.artifactName, 'brightdesk-' + slug.toLowerCase() + '-' + artifactPattern);
      assert.ok(config.mac.target.includes('dmg'));
      assert.ok(config.mac.target.includes('pkg'));
      assert.ok(config.mac.target.includes('zip'));
      assert.ok(config.linux.target.includes('AppImage'));
      assert.ok(config.linux.target.includes('deb'));
      assert.equal(config.linux.syncDesktopName, true);
    }
  } finally {
    if (previousAppId === undefined) delete process.env.BRIGHTDESK_APP_ID;
    else process.env.BRIGHTDESK_APP_ID = previousAppId;
    delete require.cache[require.resolve(configPath)];
  }
});

test('standalone builders accept only the approved apps and supported platforms', () => {
  const build = read('scripts/build-app.js');
  assert.match(build, /new Set\(\['pages', 'sheets', 'slides', 'notes', 'database', 'forms', 'lists', 'planner', 'todo', 'loop'\]\)/);
  assert.match(build, /if \(!apps\.has\(appId\) \|\| !targets\[platform\]\)/);
  assert.match(build, /'--publish', 'never'/);
  const verifier = read('scripts/verify-desktop-installers.js');
  assert.match(verifier, /Unknown approved Brightdesk product/);
  assert.match(verifier, /Unsupported platform/);
  assert.match(verifier, /PRODUCT_SLUGS/);
});

test('standalone installations open only their selected app and prevent app switching', () => {
  const main = read('src/main.js');
  const preload = read('src/preload.js');
  const renderer = read('src/app.js');
  assert.match(main, /const selectedProductId = packageConfig\.brightdeskAppId \|\| null/);
  assert.match(preload, /launchAppId/);
  assert.match(preload, /const supportedApps = new Set/);
  assert.match(renderer, /launchAppId && app !== launchAppId/);
  assert.match(renderer, /state\.installedApps = launchAppId \? \[launchAppId\]/);
});

test('Pages README describes its own product and the three installer families', () => {
  const readme = read('README.md');
  assert.match(readme, /^# Brightdesk Pages/m);
  assert.match(readme, /Create letters, reports and formatted documents/);
  for (const platform of ['Windows','macOS','Linux']) assert.ok(readme.includes(platform));
  assert.match(readme, /not affiliated with Microsoft/i);
});

test('every first-release app has original preview artwork and the launcher displays it', () => {
  for (const app of catalog) {
    const artwork = path.join(root,'src','assets','apps',app.id + '.svg');
    assert.ok(fs.existsSync(artwork), `missing artwork for ${app.name}`);
    assert.ok(fs.readFileSync(artwork,'utf8').trimStart().startsWith('<svg'));
  }
  const renderer = read('src/app.js');
  assert.ok(renderer.includes('assets/apps/'));
  assert.ok(renderer.includes('example screen'));
});
