'use strict';

const { spawn } = require('node:child_process');
const { createServer } = require('node:net');
const { mkdtemp, mkdir, readFile, writeFile, rm } = require('node:fs/promises');
const { once } = require('node:events');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));

function identity(config) {
  const id = config && config.brightdeskAppId;
  const name = config && config.build && config.build.productName;
  if (typeof id !== 'string' || !/^[a-z0-9-]+$/.test(id) || typeof name !== 'string' || !name.startsWith('Brightdesk ')) {
    throw new Error('Capture requires a valid Brightdesk product ID and build.productName.');
  }
  return { id, name };
}
function termsRecord(terms, config, date = new Date()) {
  if (!Buffer.isBuffer(terms)) throw new TypeError('Terms must be a Buffer.');
  return {
    accepted: true,
    termsVersion: '1.0',
    termsSha256: crypto.createHash('sha256').update(terms).digest('hex'),
    acceptedAt: date.toISOString(),
    appVersion: config.version
  };
}
function fileSlug(id) {
  return id === 'slides' ? 'decks' : id === 'loop' ? 'workspace' : id;
}
function userDataDirectory(home, config) {
  // Mirror src/main.js: app.setName(packageConfig.productName || 'Brightdesk').
  const appName = config && config.productName || 'Brightdesk';
  if (typeof appName !== 'string' || !appName.trim() || appName.includes('/') || appName.includes('\\')) {
    throw new Error('Capture requires a valid Electron application name.');
  }
  return path.join(home, 'Library', 'Application Support', appName);
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}
async function getTargets(port) {
  const response = await fetch('http://127.0.0.1:' + port + '/json/list');
  if (!response.ok) throw new Error('DevTools returned HTTP ' + response.status);
  return response.json();
}
async function waitTarget(port, predicate, child, getOutput) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('Electron exited with ' + child.exitCode + '. ' + getOutput());
    try {
      const found = (await getTargets(port)).find(x => x.type === 'page' && predicate(x));
      if (found) return found;
    } catch {}
    await sleep(350);
  }
  throw new Error('Timed out waiting for the Brightdesk window. ' + getOutput());
}
function connect(url) {
  const ws = new WebSocket(url);
  let id = 0;
  const pending = new Map();
  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    const p = pending.get(message.id);
    if (!p) return;
    pending.delete(message.id);
    if (message.error) p.reject(new Error(message.error.message));
    else p.resolve(message.result || {});
  });
  return {
    async ready() { await ready; },
    send(method, params = {}) {
      const requestId = ++id;
      return new Promise((resolve, reject) => {
        pending.set(requestId, { resolve, reject });
        ws.send(JSON.stringify({ id: requestId, method, params }));
      });
    },
    close() { ws.close(); }
  };
}
async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Renderer evaluation failed.');
  return result.result && result.result.value;
}

async function main() {
  const product = identity(pkg);
  const output = path.resolve(process.env.BRIGHTDESK_SCREENSHOT_OUTPUT || path.join(root, 'capture-output'));
  const home = await mkdtemp(path.join(os.tmpdir(), 'brightdesk-capture-' + product.id + '-'));
  const port = await freePort();
  let child;
  let cdp;
  let log = '';
  try {
    const terms = await readFile(path.join(root, 'TERMS_AND_CONDITIONS.txt'));
    const record = termsRecord(terms, pkg);
    const userData = userDataDirectory(home, pkg);
    await mkdir(userData, { recursive: true });
    await writeFile(path.join(userData, 'terms-acceptance.json'), JSON.stringify(record, null, 2) + '\n', { mode: 0o600 });
    await mkdir(output, { recursive: true });
    child = spawn(require('electron'), [
      '--remote-debugging-port=' + port,
      '--remote-allow-origins=*',
      '--user-data-dir=' + path.join(home, 'ChromiumProfile'),
      '.'
    ], { cwd: root, env: { ...process.env, HOME: home }, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', x => { log = (log + x.toString()).slice(-4000); });
    child.stderr.on('data', x => { log = (log + x.toString()).slice(-4000); });

    const first = await waitTarget(port, x => x.title === product.name || /Terms and Conditions/i.test(x.title), child, () => log);
    let target = first;
    if (/Terms and Conditions/i.test(first.title)) {
      cdp = connect(first.webSocketDebuggerUrl);
      await cdp.ready();
      await cdp.send('Runtime.enable');
      const accepted = await evaluate(cdp, "(() => { const c = document.querySelector('#agree'); const b = document.querySelector('#accept'); if (!c || !b) return false; c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); b.click(); return true; })()");
      if (!accepted) throw new Error('Could not complete first-run terms in the isolated screenshot profile.');
      cdp.close();
      cdp = null;
      target = await waitTarget(port, x => x.title === product.name, child, () => log);
    }

    cdp = connect(target.webSocketDebuggerUrl);
    await cdp.ready();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    let page;
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      page = await evaluate(cdp, "(() => ({ title: document.title, heading: document.querySelector('#app-title')?.textContent?.trim() || '', ready: document.readyState, bodyLength: document.body?.innerText?.length || 0, workspace: Boolean(document.querySelector('#workspace')) }))()");
      if (page && page.ready === 'complete' && page.heading === product.name && page.workspace && page.bodyLength > 100) break;
      await sleep(400);
    }
    if (!page || page.heading !== product.name || !page.workspace || page.bodyLength <= 100) {
      throw new Error('Actual workspace did not render: ' + JSON.stringify(page) + '. ' + log);
    }
    await evaluate(cdp, 'document.fonts?.ready || Promise.resolve(true)');
    await sleep(900);
    const shot = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: false
    });
    const bytes = Buffer.from(shot.data, 'base64');
    if (bytes.length < 12000) throw new Error('Refusing suspiciously small screenshot (' + bytes.length + ' bytes).');
    const platform = process.platform === 'darwin' ? 'macos' : process.platform;
    const slug = fileSlug(product.id);
    const filename = slug + '-' + platform + '.png';
    await writeFile(path.join(output, filename), bytes);
    const metadata = {
      product: product.name,
      productId: product.id,
      appVersion: pkg.version,
      platform,
      architecture: process.arch,
      sourceCommit: process.env.GITHUB_SHA || 'local-uncommitted-build',
      screenshot: filename,
      bytes: bytes.length,
      capturedAt: new Date().toISOString(),
      captureMethod: 'Live Electron BrowserWindow captured through Chrome DevTools Protocol',
      isolatedTermsProfile: true,
      verifiedRunningApp: true,
      documentTitle: page.title,
      workspaceHeading: page.heading
    };
    await writeFile(path.join(output, slug + '-' + platform + '.json'), JSON.stringify(metadata, null, 2) + '\n');
    process.stdout.write(JSON.stringify(metadata) + '\n');
  } finally {
    if (cdp) cdp.close();
    if (child && child.exitCode === null) {
      child.kill('SIGTERM');
      await Promise.race([
        once(child, 'exit').catch(() => {}),
        sleep(5000).then(() => { if (child.exitCode === null) child.kill('SIGKILL'); })
      ]);
    }
    await rm(home, { recursive: true, force: true });
  }
}

if (require.main === module) {
  main().catch(error => {
    process.stderr.write((error.stack || error.message) + '\n');
    process.exitCode = 1;
  });
}
module.exports = { identity, termsRecord, fileSlug, userDataDirectory };
