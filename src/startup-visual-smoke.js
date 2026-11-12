'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

function assertRendererReady(snapshot, productName) {
  const title = String(snapshot?.appTitle || '');
  const expected = String(productName || '');
  if (!snapshot?.hasMain || !snapshot?.hasWorkspace || !snapshot?.workspaceVisible) {
    throw new Error('The Electron renderer did not expose a visible main workspace.');
  }
  if (!title || !expected || !title.toLowerCase().includes(expected.toLowerCase())) {
    throw new Error('The Electron renderer title does not match the selected Brightdesk product.');
  }
  if (!Number.isInteger(snapshot.bodyTextLength) || snapshot.bodyTextLength < 10) {
    throw new Error('The Electron renderer produced an empty or incomplete workspace.');
  }
  if (snapshot.visibleBrokenImages > 0) {
    throw new Error('The Electron renderer contains a visible image that did not load.');
  }
  return snapshot;
}

function createReadinessScript(productName) {
  return `(async () => {
    const expected = ${JSON.stringify(productName)};
    const deadline = Date.now() + 10000;
    let appTitle = '';
    let workspace = null;
    while (Date.now() < deadline) {
      appTitle = document.getElementById('app-title')?.textContent?.trim() || '';
      workspace = document.getElementById('workspace');
      if (document.querySelector('main') && workspace && !workspace.hidden &&
          appTitle.toLowerCase().includes(expected.toLowerCase())) break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    workspace = document.getElementById('workspace');
    const visibleBrokenImages = [...document.images].filter(image => {
      if (!image.getClientRects().length) return false;
      return !image.complete || image.naturalWidth === 0;
    }).length;
    return {
      appTitle: document.getElementById('app-title')?.textContent?.trim() || '',
      hasMain: Boolean(document.querySelector('main')),
      hasWorkspace: Boolean(workspace),
      workspaceVisible: Boolean(workspace && !workspace.hidden && getComputedStyle(workspace).display !== 'none'),
      bodyTextLength: (document.body?.innerText || '').trim().length,
      visibleBrokenImages,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      workspaceAnimationName: workspace ? getComputedStyle(workspace).animationName : 'missing',
      workspaceAnimationDuration: workspace ? getComputedStyle(workspace).animationDuration : '0s'
    };
  })()`;
}

async function runStartupVisualSmoke({ window, productName, screenshotDir = null, fsImpl = fs }) {
  const webContents = window?.webContents;
  if (!webContents || typeof webContents.executeJavaScript !== 'function') {
    throw new Error('The startup smoke test requires a real Electron BrowserWindow.');
  }

  const snapshot = await webContents.executeJavaScript(createReadinessScript(productName));
  assertRendererReady(snapshot, productName);

  let screenshot = null;
  if (screenshotDir) {
    await fsImpl.mkdir(screenshotDir, { recursive: true });
    const image = await webContents.capturePage();
    const size = image.getSize();
    const png = image.toPNG();
    if (!size || size.width < 980 || size.height < 600 || png.length < 1000 ||
        png[0] !== 0x89 || png[1] !== 0x50 || png[2] !== 0x4e || png[3] !== 0x47) {
      throw new Error('Electron did not produce a valid full-size PNG screenshot.');
    }

    const metadata = {
      product: productName,
      state: 'workspace',
      screenshot: 'workspace.png',
      viewport: snapshot.viewport,
      reducedMotion: snapshot.reducedMotion,
      workspaceAnimationName: snapshot.workspaceAnimationName,
      workspaceAnimationDuration: snapshot.workspaceAnimationDuration,
      capturedAt: new Date().toISOString()
    };
    await fsImpl.writeFile(path.join(screenshotDir, 'workspace.png'), png);
    await fsImpl.writeFile(path.join(screenshotDir, 'workspace.json'), `${JSON.stringify(metadata, null, 2)}\n`);
    screenshot = { file: 'workspace.png', width: size.width, height: size.height, bytes: png.length };
  }

  return { product: productName, renderer: snapshot, screenshot };
}

function attachStartupVisualSmoke({ app, window, productName, screenshotDir = null }) {
  let finished = false;
  const finish = (code, message) => {
    if (finished) return;
    finished = true;
    clearTimeout(timeout);
    if (message) console.error(message);
    app.exit(code);
  };

  const timeout = setTimeout(() => {
    finish(1, 'Brightdesk startup smoke test timed out before the renderer became ready.');
  }, 18000);

  window.webContents.once('did-finish-load', async () => {
    try {
      const result = await runStartupVisualSmoke({ window, productName, screenshotDir });
      console.log(`Brightdesk renderer smoke test passed for ${result.product}.`);
      if (result.screenshot) console.log('Brightdesk workspace screenshot captured.');
      finish(0);
    } catch (error) {
      finish(1, `Brightdesk renderer smoke test failed: ${error.message}`);
    }
  });

  window.webContents.once('did-fail-load', (_event, code, description) => {
    finish(1, `Brightdesk renderer failed to load (code ${code}): ${description}`);
  });
}

module.exports = {
  assertRendererReady,
  createReadinessScript,
  runStartupVisualSmoke,
  attachStartupVisualSmoke
};
