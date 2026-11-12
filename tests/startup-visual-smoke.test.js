'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { assertRendererReady, createReadinessScript, runStartupVisualSmoke } = require('../src/startup-visual-smoke');
const { prepareSmokeUserData } = require('../scripts/brightdesk-private-runner/prepare-smoke-user-data');

test('renderer readiness requires the expected product and visible workspace', () => {
  const snapshot = {
    appTitle: 'Brightdesk Pages',
    hasMain: true,
    hasWorkspace: true,
    workspaceVisible: true,
    bodyTextLength: 120,
    visibleBrokenImages: 0
  };
  assert.equal(assertRendererReady(snapshot, 'Brightdesk Pages'), snapshot);
  assert.throws(() => assertRendererReady({ ...snapshot, workspaceVisible: false }, 'Brightdesk Pages'), /visible main workspace/);
  assert.throws(() => assertRendererReady({ ...snapshot, appTitle: 'Brightdesk Sheets' }, 'Brightdesk Pages'), /does not match/);
});

test('renderer probe waits for the actual Electron product workspace and records reduced motion', () => {
  const source = createReadinessScript('Brightdesk Pages');
  assert.match(source, /document\.getElementById\('app-title'\)/);
  assert.match(source, /document\.getElementById\('workspace'\)/);
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.match(source, /visibleBrokenImages/);
});

test('Electron screenshot capture writes a real PNG and metadata for the rendered workspace', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'brightdesk-visual-test-'));
  try {
    const png = Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]), Buffer.alloc(1200)]);
    const result = await runStartupVisualSmoke({
      window: {
        webContents: {
          executeJavaScript: async () => ({
            appTitle: 'Brightdesk Pages', hasMain: true, hasWorkspace: true,
            workspaceVisible: true, bodyTextLength: 120, visibleBrokenImages: 0,
            viewport: { width: 1440, height: 900 }, reducedMotion: false,
            workspaceAnimationName: 'bd-motion-enter', workspaceAnimationDuration: '180ms'
          }),
          capturePage: async () => ({ getSize: () => ({ width: 1440, height: 900 }), toPNG: () => png })
        }
      },
      productName: 'Brightdesk Pages',
      screenshotDir: directory
    });
    assert.deepEqual(result.screenshot, { file: 'workspace.png', width: 1440, height: 900, bytes: png.length });
    assert.deepEqual(await fs.readFile(path.join(directory, 'workspace.png')), png);
    const metadata = JSON.parse(await fs.readFile(path.join(directory, 'workspace.json'), 'utf8'));
    assert.equal(metadata.product, 'Brightdesk Pages');
    assert.equal(metadata.reducedMotion, false);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('smoke profile is isolated and accepts only the exact current terms digest', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'brightdesk-terms-profile-'));
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
    await fs.rm(directory, { recursive: true, force: true });
  }
});
