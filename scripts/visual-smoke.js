'use strict';

const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { prepareSmokeUserData } = require('./brightdesk-private-runner/prepare-smoke-user-data');

async function main() {
  const projectDir = path.resolve(__dirname, '..');
  const packagePath = path.join(projectDir, 'package.json');
  const termsPath = path.join(projectDir, 'TERMS_AND_CONDITIONS.txt');
  const screenshotDir = path.join(projectDir, 'artifacts', 'visual-smoke');
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'brightdesk-visual-user-data-'));
  const packageConfig = JSON.parse(await fs.readFile(packagePath, 'utf8'));
  const electronBinary = require('electron');

  if (typeof electronBinary !== 'string' || !electronBinary) {
    throw new Error('The local Electron executable could not be resolved.');
  }

  try {
    await fs.rm(screenshotDir, { recursive: true, force: true });
    await fs.mkdir(screenshotDir, { recursive: true });
    const terms = await fs.readFile(termsPath);
    const record = prepareSmokeUserData(termsPath, packagePath, userDataDir);
    const expectedHash = crypto.createHash('sha256').update(terms).digest('hex');
    if (record.termsSha256 !== expectedHash) {
      throw new Error('The isolated visual-test profile does not match the packaged terms file.');
    }

    const child = spawn(electronBinary, ['.'], {
      cwd: projectDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        BRIGHTDESK_STARTUP_SMOKE_TEST: '1',
        BRIGHTDESK_TEST_USER_DATA_DIR: userDataDir,
        BRIGHTDESK_SCREENSHOT_DIR: screenshotDir
      }
    });

    const exitCode = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error('Electron visual smoke test exceeded its 25-second time limit.'));
      }, 25000);
      child.once('error', error => {
        clearTimeout(timeout);
        reject(error);
      });
      child.once('exit', (code, signal) => {
        clearTimeout(timeout);
        if (signal) reject(new Error(`Electron visual smoke test exited from signal ${signal}.`));
        else resolve(code);
      });
    });
    if (exitCode !== 0) throw new Error(`Electron visual smoke test exited with code ${exitCode}.`);

    const screenshotPath = path.join(screenshotDir, 'workspace.png');
    const png = await fs.readFile(screenshotPath);
    const metadata = JSON.parse(await fs.readFile(path.join(screenshotDir, 'workspace.json'), 'utf8'));
    const interactionMetadata = JSON.parse(await fs.readFile(path.join(screenshotDir, 'navigation-collapsed.json'), 'utf8'));
    const interactionPng = await fs.readFile(path.join(screenshotDir, 'navigation-collapsed.png'));
    const isValidPng = (image, expectedSize) => image.length >= 33 &&
      image.readUInt32BE(0) === 0x89504e47 &&
      image.toString('ascii', 12, 16) === 'IHDR' &&
      image.readUInt32BE(16) === expectedSize.width &&
      image.readUInt32BE(20) === expectedSize.height;
    if (!isValidPng(png, metadata.imageSize || {}) ||
        metadata.product !== packageConfig.build.productName || metadata.screenshot !== 'workspace.png' ||
        interactionMetadata.product !== metadata.product || interactionMetadata.state !== 'navigation-collapsed' ||
        interactionMetadata.interaction !== 'click #sidebar-toggle' || interactionMetadata.ariaExpanded !== 'false' ||
        !isValidPng(interactionPng, interactionMetadata.imageSize || {})) {
      throw new Error('The Electron visual screenshots or metadata do not match the product manifest and expected image dimensions.');
    }
    console.log(`Captured the real ${metadata.product} Electron workspace and collapsed-navigation state at ${metadata.viewport.width}x${metadata.viewport.height}.`);
  } finally {
    await fs.rm(userDataDir, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
