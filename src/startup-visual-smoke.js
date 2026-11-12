'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const PRODUCT_LAUNCH_IDS = {
  'Brightdesk Pages': 'pages',
  'Brightdesk Sheets': 'sheets',
  'Brightdesk Decks': 'slides',
  'Brightdesk Notes': 'notes',
  'Brightdesk Database': 'database',
  'Brightdesk Forms': 'forms',
  'Brightdesk Lists': 'lists',
  'Brightdesk Planner': 'planner',
  'Brightdesk To Do': 'todo',
  'Brightdesk Workspace': 'loop'
};

function assertRendererReady(snapshot, productName) {
  const title = String(snapshot?.appTitle || '');
  const expected = String(productName || '');
  if (!snapshot?.hasMain || !snapshot?.hasWorkspace || !snapshot?.workspaceVisible) {
    throw new Error('The Electron renderer did not expose a visible main workspace.');
  }
  if (!title || !expected || !title.toLowerCase().includes(expected.toLowerCase())) {
    throw new Error('The Electron renderer title does not match the selected Brightdesk product.');
  }
  const expectedAppId = PRODUCT_LAUNCH_IDS[expected] || null;
  if (!snapshot.productWindow || !snapshot.welcomeHidden ||
      !Number.isInteger(snapshot.ribbonTabCount) || snapshot.ribbonTabCount < 1 ||
      (expectedAppId && snapshot.launchAppId !== expectedAppId) ||
      snapshot.productEyebrow !== 'PRODUCT WORKSPACE') {
    throw new Error('The Electron renderer has not finished initialising the product workspace.');
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
  const expectedAppId = PRODUCT_LAUNCH_IDS[productName] || null;
  return `(async () => {
    const expected = ${JSON.stringify(productName)};
    const expectedAppId = ${JSON.stringify(expectedAppId)};
    const waitForFiniteAnimations = async elements => {
      const animations = elements.filter(Boolean).flatMap(element =>
        typeof element.getAnimations === 'function' ? element.getAnimations({ subtree: true }) : []
      ).filter(animation => {
        const iterations = animation.effect?.getComputedTiming?.().iterations;
        return animation.playState !== 'finished' && iterations !== Infinity;
      });
      if (!animations.length) return;
      await new Promise(resolve => {
        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          clearTimeout(timeout);
          resolve();
        };
        const timeout = setTimeout(finish, 1200);
        Promise.all(animations.map(animation => animation.finished.catch(() => undefined))).then(finish, finish);
      });
    };
    const deadline = Date.now() + 10000;
    let appTitle = '';
    let workspace = null;
    const productState = () => {
      const welcome = document.getElementById('welcome');
      const welcomeHidden = Boolean(welcome && welcome.hidden && getComputedStyle(welcome).display === 'none');
      const ribbonTabCount = document.querySelectorAll('#ribbon-tabs .ribbon-tab').length;
      const launchAppId = window.brightdesk?.launchAppId || null;
      const productEyebrow = document.querySelector('.topbar .eyebrow')?.textContent?.trim() || '';
      const productWindow = document.documentElement.classList.contains('is-product-window');
      return {
        productWindow,
        welcomeHidden,
        ribbonTabCount,
        launchAppId,
        productEyebrow,
        ready: productWindow && welcomeHidden && ribbonTabCount > 0 &&
          productEyebrow === 'PRODUCT WORKSPACE' &&
          (expectedAppId ? launchAppId === expectedAppId : Boolean(launchAppId))
      };
    };
    while (Date.now() < deadline) {
      appTitle = document.getElementById('app-title')?.textContent?.trim() || '';
      workspace = document.getElementById('workspace');
      if (document.querySelector('main') && workspace && !workspace.hidden &&
          appTitle.toLowerCase().includes(expected.toLowerCase()) && productState().ready) break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    const waitForVisibleImages = async () => {
      const images = [...document.images].filter(image => image.getClientRects().length > 0);
      await Promise.all(images.map(image => {
        if (image.complete) return Promise.resolve();
        return new Promise(resolve => {
          let finished = false;
          const finish = () => {
            if (finished) return;
            finished = true;
            clearTimeout(timeout);
            image.removeEventListener('load', finish);
            image.removeEventListener('error', finish);
            resolve();
          };
          image.addEventListener('load', finish, { once: true });
          image.addEventListener('error', finish, { once: true });
          const timeout = setTimeout(finish, 1500);
        });
      }));
    };
    await document.fonts.ready;
    workspace = document.getElementById('workspace');
    await waitForFiniteAnimations([workspace]);
    await waitForVisibleImages();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
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
      workspaceAnimationDuration: workspace ? getComputedStyle(workspace).animationDuration : '0s',
      ...productState()
    };
  })()`;
}

function createSidebarInteractionScript() {
  return `(async () => {
    const button = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar-nav');
    if (!button || !sidebar) return { available: false };
    const expandedWidth = Math.round(sidebar.getBoundingClientRect().width);
    const waitForFiniteAnimations = async elements => {
      const animations = elements.filter(Boolean).flatMap(element =>
        typeof element.getAnimations === 'function' ? element.getAnimations({ subtree: true }) : []
      ).filter(animation => {
        const iterations = animation.effect?.getComputedTiming?.().iterations;
        return animation.playState !== 'finished' && iterations !== Infinity;
      });
      if (!animations.length) return;
      await new Promise(resolve => {
        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          clearTimeout(timeout);
          resolve();
        };
        const timeout = setTimeout(finish, 1200);
        Promise.all(animations.map(animation => animation.finished.catch(() => undefined))).then(finish, finish);
      });
    };
    button.click();
    await waitForFiniteAnimations([sidebar, button]);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return {
      available: true,
      compact: sidebar.classList.contains('is-compact'),
      ariaExpanded: button.getAttribute('aria-expanded'),
      expandedWidth,
      sidebarWidth: Math.round(sidebar.getBoundingClientRect().width)
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
    if (!size || size.width < 980 || size.height < 600 || png.length < 33 ||
        png[0] !== 0x89 || png[1] !== 0x50 || png[2] !== 0x4e || png[3] !== 0x47 ||
        png.toString('ascii', 12, 16) !== 'IHDR' ||
        png.readUInt32BE(16) !== size.width || png.readUInt32BE(20) !== size.height) {
      throw new Error('Electron did not produce a valid full-size PNG screenshot with matching dimensions.');
    }

    const metadata = {
      product: productName,
      state: 'workspace',
      screenshot: 'workspace.png',
      viewport: snapshot.viewport,
      imageSize: { width: size.width, height: size.height },
      reducedMotion: snapshot.reducedMotion,
      workspaceAnimationName: snapshot.workspaceAnimationName,
      workspaceAnimationDuration: snapshot.workspaceAnimationDuration,
      capturedAt: new Date().toISOString()
    };
    await fsImpl.writeFile(path.join(screenshotDir, 'workspace.png'), png);
    await fsImpl.writeFile(path.join(screenshotDir, 'workspace.json'), `${JSON.stringify(metadata, null, 2)}\n`);

    const interaction = await webContents.executeJavaScript(createSidebarInteractionScript());
    if (!interaction.available || !interaction.compact || interaction.ariaExpanded !== 'false' ||
        !Number.isFinite(interaction.expandedWidth) || !Number.isFinite(interaction.sidebarWidth) ||
        interaction.sidebarWidth < 1 || interaction.sidebarWidth >= interaction.expandedWidth) {
      throw new Error('The product navigation collapse interaction did not reach its compact state.');
    }
    const compactImage = await webContents.capturePage();
    const compactSize = compactImage.getSize();
    const compactPng = compactImage.toPNG();
    if (!compactSize || compactSize.width < 980 || compactSize.height < 600 ||
        compactPng.length < 33 || compactPng[0] !== 0x89 || compactPng[1] !== 0x50 ||
        compactPng[2] !== 0x4e || compactPng[3] !== 0x47 ||
        compactPng.toString('ascii', 12, 16) !== 'IHDR' ||
        compactPng.readUInt32BE(16) !== compactSize.width ||
        compactPng.readUInt32BE(20) !== compactSize.height) {
      throw new Error('Electron did not produce a valid screenshot of the collapsed navigation state.');
    }
    const interactionMetadata = {
      product: productName,
      state: 'navigation-collapsed',
      interaction: 'click #sidebar-toggle',
      ariaExpanded: interaction.ariaExpanded,
      expandedSidebarWidth: interaction.expandedWidth,
      sidebarWidth: interaction.sidebarWidth,
      viewport: snapshot.viewport,
      reducedMotion: snapshot.reducedMotion,
      imageSize: { width: compactSize.width, height: compactSize.height },
      capturedAt: new Date().toISOString()
    };
    await fsImpl.writeFile(path.join(screenshotDir, 'navigation-collapsed.png'), compactPng);
    await fsImpl.writeFile(path.join(screenshotDir, 'navigation-collapsed.json'), `${JSON.stringify(interactionMetadata, null, 2)}\n`);
    screenshot = {
      workspace: { file: 'workspace.png', width: size.width, height: size.height, bytes: png.length },
      navigationCollapsed: {
        file: 'navigation-collapsed.png',
        width: compactSize.width,
        height: compactSize.height,
        bytes: compactPng.length,
        expandedSidebarWidth: interaction.expandedWidth,
        sidebarWidth: interaction.sidebarWidth
      }
    };
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
  createSidebarInteractionScript,
  runStartupVisualSmoke,
  attachStartupVisualSmoke
};
