'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('Pages has one full PR quality gate with locked dependencies, tests, preflight and audit', () => {
  const workflow = read('.github/workflows/desktop-installers.yml');
  const manifest = JSON.parse(read('package.json'));
  assert.ok(workflow.includes('pull_request:'));
  assert.ok(workflow.includes('push:'));
  assert.ok(workflow.includes("cron: '11 17 * * *'"));
  assert.equal(manifest.engines.node, '24.22.2');
  for (const command of [
    'node-version: 24.22.2',
    'npm run check:node',
    'npm run lock:verify',
    'npm ci --no-audit --no-fund',
    'npm run verify:licenses',
    'npm test',
    'npm run release:preflight',
    'npm audit --audit-level=high'
  ]) {
    assert.ok(workflow.includes(command), `quality gate includes ${command}`);
  }
});

test('Windows, macOS and Linux installer jobs build and verify separate native outputs', () => {
  const workflow = read('.github/workflows/desktop-installers.yml');
  const matrixExpression = '$' + '{{ matrix.platform }}';
  assert.ok(workflow.includes("if: github.event_name == 'workflow_dispatch' && inputs.build_installers == true"));
  assert.ok(workflow.includes('needs: test'));
  for (const platform of ['win', 'mac', 'linux']) {
    assert.ok(workflow.includes(`platform: ${platform}`), `matrix includes ${platform}`);
  }
  assert.ok(workflow.includes('npm run dist:desktop:' + matrixExpression));
  assert.ok(workflow.includes('npm run verify:desktop:' + matrixExpression));
  assert.ok(workflow.includes('path: release/apps/pages/**'));
  assert.ok(workflow.includes('if-no-files-found: error'));
});

test('only a deliberate manual release dispatch receives contents write permission', () => {
  const workflow = read('.github/workflows/desktop-installers.yml');
  const testJob = workflow.split('\n  test:\n')[1]?.split('\n  build:\n')[0] || '';
  const buildJob = workflow.split('\n  build:\n')[1]?.split('\n  publish:\n')[0] || '';
  const publishJob = workflow.split('\n  publish:\n')[1] || '';
  assert.ok(workflow.includes("if: github.event_name == 'workflow_dispatch' && inputs.publish_release == true"));
  assert.ok(publishJob.includes('permissions:\n      contents: write'));
  assert.ok(!testJob.includes('contents: write'));
  assert.ok(!buildJob.includes('contents: write'));
  assert.ok(publishJob.includes('softprops/action-gh-release@'));
});

test('private maintenance audits locked dependencies in both test and build paths', () => {
  const runner = read('scripts/brightdesk-private-runner/run-private-project-check.sh');
  const audits = runner.match(/npm audit --audit-level=high/g) || [];
  assert.equal(audits.length, 2);
  const workflow = read('.github/workflows/brightdesk-private-maintenance.yml');
  assert.ok(workflow.includes('schedule:'));
  assert.ok(workflow.includes("cron: '13 17 * * *'"));
  assert.ok(workflow.includes("cron: '17 17 * * 0'"));
});

test('generated standalone app workflows pin actions and retain the explicit manual publish gate', () => {
  const generator = read('scripts/create-app-repository-seeds.js');
  for (const pin of [
    'actions/checkout@11d5960a326750d5838078e36cf38b85af677262',
    'actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020',
    'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02',
    'actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093',
    'softprops/action-gh-release@3bb12739c298aeb8a4eeaf626c5b8d85266b0e65'
  ]) {
    assert.ok(generator.includes(pin), `generator pins ${pin}`);
  }
  assert.ok(generator.includes('npm audit --audit-level=high'));
  assert.ok(generator.includes("github.event_name == 'workflow_dispatch' && inputs.publish_release == true"));
});

test('standalone and customer installer builds do not publish implicitly', () => {
  const builder = read('scripts/build-app.js');
  assert.ok(builder.includes("'--publish', 'never'"));
  const manifest = JSON.parse(read('package.json'));
  for (const name of ['dist', 'dist:win', 'dist:mac', 'dist:linux']) {
    assert.ok(manifest.scripts[name].endsWith('--publish never'), `${name} must build locally without publishing`);
  }
});
