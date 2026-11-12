'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { assertRendererReady, createReadinessScript, createSidebarInteractionScript, runStartupVisualSmoke } = require('../src/startup-visual-smoke');
const { prepareSmokeUserData } = require('../scripts/brightdesk-private-runner/prepare-smoke-user-data');

test('renderer readiness requires the expected product and visible workspace', () => {
  const snapshot = {
    appTitle: 'Brightdesk Pages',
    hasMain: true,
    hasWorkspace: true,
    workspaceVisible: true,
    bodyTextLength: 120,
    visibleBrokenImages: 0,
    productWindow: true,
    welcomeHidden: true,
    ribbonTabCount: 5,
    launchAppId: 'pages',
    productEyebrow: 'PRODUCT WORKSPACE'
  };
  assert.equal(assertRendererReady(snapshot, 'Brightdesk Pages'), snapshot);
  assert.throws(() => assertRendererReady({ ...snapshot, workspaceVisible: false }, 'Brightdesk Pages'), /visible main workspace/);
  assert.throws(() => assertRendererReady({ ...snapshot, appTitle: 'Brightdesk Sheets' }, 'Brightdesk Pages'), /does not match/);
});

test('renderer readiness rejects static HTML until the individual Pages editor is fully initialised', () => {
  const staticMarkup = {
    appTitle: 'Brightdesk Pages',
    hasMain: true,
    hasWorkspace: true,
    workspaceVisible: true,
    bodyTextLength: 120,
    visibleBrokenImages: 0,
    productWindow: false,
    welcomeHidden: false,
    ribbonTabCount: 0,
    launchAppId: null
  };
  assert.throws(
    () => assertRendererReady(staticMarkup, 'Brightdesk Pages'),
    /fully initialised product workspace/
  );
});

test('renderer readiness rejects each incomplete Pages product-shell requirement independently', () => {
  const ready = {
    appTitle: 'Brightdesk Pages',
    hasMain: true,
    hasWorkspace: true,
    workspaceVisible: true,
    bodyTextLength: 120,
    visibleBrokenImages: 0,
    productWindow: true,
    welcomeHidden: true,
    ribbonTabCount: 5,
    launchAppId: 'pages',
    productEyebrow: 'PRODUCT WORKSPACE'
  };

  const incompleteStates = [
    ['product window shell is inactive', { productWindow: false }],
    ['welcome banner is still visible', { welcomeHidden: false }],
    ['ribbon tabs have not rendered', { ribbonTabCount: 0 }],
    ['launch ID belongs to another product', { launchAppId: 'sheets' }],
    ['product workspace heading is missing', { productEyebrow: 'OVERVIEW' }]
  ];

  for (const [description, change] of incompleteStates) {
    assert.throws(
      () => assertRendererReady({ ...ready, ...change }, 'Brightdesk Pages'),
      /fully initialised product workspace/,
      description
    );
  }
});

test('renderer probe waits for the product window shell and rendered ribbon, not static HTML defaults', () => {
  const source = createReadinessScript('Brightdesk Pages');
  assert.match(source, /classList\\.contains\\('is-product-window'\\)/);
  assert.match(source, /welcome\\.hidden/);
  assert.ok(source.includes("querySelectorAll('#ribbon-tabs .ribbon-tab')"));
  assert.match(source, /launchAppId/);
});

test('renderer probe waits for the actual Electron product workspace and records reduced motion', () => {
  const source = createReadinessScript('Brightdesk Pages');
  assert.match(source, /document\.getElementById\('app-title'\)/);
  assert.match(source, /document\.getElementById\('workspace'\)/);
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.match(source, /visibleBrokenImages/);
  assert.match(source, /productState\\(\\)\\.ready/);
  assert.match(source, /expectedAppId/);
});

test('workspace readiness waits for finite entrance animations to settle before capture', () => {
  const source = createReadinessScript('Brightdesk Pages');
  assert.match(source, /waitForFiniteAnimations\(\[workspace\]\)/);
  assert.match(source, /getAnimations\(\{ subtree: true \}\)/);
  assert.match(source, /animation\.finished/);
  assert.match(source, /1200/);
});

test('navigation interaction waits for the real sidebar width transition before capture', () => {
  const source = createSidebarInteractionScript();
  assert.match(source, /waitForFiniteAnimations\(\[sidebar, button\]\)/);
  assert.match(source, /getAnimations\(\{ subtree: true \}\)/);
  assert.match(source, /animation\.finished/);
});

test('navigation interaction probe clicks the actual product control and verifies compact state', () => {
  const source = createSidebarInteractionScript();
  assert.match(source, /document.getElementById\('sidebar-toggle'\)/);
  assert.match(source, /button\.click\(\)/);
  assert.match(source, /is-compact/);
  assert.match(source, /ariaExpanded/);
});

test('writes Electron PNG bytes for the workspace and a real navigation interaction', async () => {
  const directory = await fsp.mkdtemp(path.join(os.tmpdir(), 'brightdesk-visual-test-'));
  try {
    const png = Buffer.alloc(1200);
    Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]).copy(png, 0);
    png.writeUInt32BE(13, 8);
    png.write('IHDR', 12, 'ascii');
    png.writeUInt32BE(1440, 16);
    png.writeUInt32BE(900, 20);
    const result = await runStartupVisualSmoke({
      window: {
        webContents: {
          executeJavaScript: async script => script.includes('button.click()')
            ? { available: true, compact: true, ariaExpanded: 'false', sidebarWidth: 76 }
            : {
                appTitle: 'Brightdesk Pages', hasMain: true, hasWorkspace: true,
                workspaceVisible: true, bodyTextLength: 120, visibleBrokenImages: 0,
                productWindow: true, welcomeHidden: true, ribbonTabCount: 5,
                launchAppId: 'pages', productEyebrow: 'PRODUCT WORKSPACE',
                viewport: { width: 1440, height: 900 }, reducedMotion: false,
                workspaceAnimationName: 'bd-motion-enter', workspaceAnimationDuration: '180ms'
              },
          capturePage: async () => ({ getSize: () => ({ width: 1440, height: 900 }), toPNG: () => png })
        }
      },
      productName: 'Brightdesk Pages',
      screenshotDir: directory
    });
    assert.deepEqual(result.screenshot.workspace, { file: 'workspace.png', width: 1440, height: 900, bytes: png.length });
    assert.equal(result.screenshot.navigationCollapsed.sidebarWidth, 76);
    for (const name of ['workspace.png', 'navigation-collapsed.png']) {
      assert.deepEqual(await fsp.readFile(path.join(directory, name)), png);
    }
    const metadata = JSON.parse(await fsp.readFile(path.join(directory, 'workspace.json'), 'utf8'));
    const interactionMetadata = JSON.parse(await fsp.readFile(path.join(directory, 'navigation-collapsed.json'), 'utf8'));
    assert.equal(metadata.product, 'Brightdesk Pages');
    assert.equal(metadata.reducedMotion, false);
    assert.deepEqual(metadata.imageSize, { width: 1440, height: 900 });
    assert.equal(interactionMetadata.state, 'navigation-collapsed');
    assert.equal(interactionMetadata.ariaExpanded, 'false');
  } finally {
    await fsp.rm(directory, { recursive: true, force: true });
  }
});

test('smoke profile is isolated and accepts only the exact current terms digest', async () => {
  const directory = await fsp.mkdtemp(path.join(os.tmpdir(), 'brightdesk-terms-profile-'));
  try {
    const termsPath = path.join(directory, 'TERMS_AND_CONDITIONS.txt');
    const packagePath = path.join(directory, 'package.json');
    const profilePath = path.join(directory, 'user-data');
    const terms = 'Brightdesk test terms';
    fs.writeFileSync(termsPath, terms);
    fs.writeFileSync(packagePath, JSON.stringify({ version: '0.1.0' }));
    const record = prepareSmokeUserData(termsPath, packagePath, profilePath);
    assert.equal(record.termsSha256, crypto.createHash('sha256').update(terms).digest('hex'));
    assert.equal(record.accepted, true);
    const stored = JSON.parse(fs.readFileSync(path.join(profilePath, 'terms-acceptance.json'), 'utf8'));
    assert.equal(stored.termsSha256, record.termsSha256);
  } finally {
    await fsp.rm(directory, { recursive: true, force: true });
  }
});
