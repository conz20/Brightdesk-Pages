'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const runnerScript = path.join(__dirname, '..', 'scripts', 'brightdesk-private-runner', 'run-private-project-check.sh');
const workflow = path.join(__dirname, '..', '.github', 'workflows', 'brightdesk-private-maintenance.yml');

test('private project check script has valid Bash syntax', { skip: process.platform === 'win32' }, () => {
  execFileSync('bash', ['-n', runnerScript], { stdio: 'pipe' });
});

test('private check script never prints raw build logs', () => {
  const source = fs.readFileSync(runnerScript, 'utf8');
  assert.match(source, />> \"\$LOG_FILE\" 2>&1/);
  assert.match(source, /Detailed output was kept only on the temporary runner/);
  assert.doesNotMatch(source, /cat \"\$LOG_FILE\"/);
});

test('central workflow uses the public runner and read-only private checkout', () => {
  const source = fs.readFileSync(workflow, 'utf8');
  assert.match(source, /runs-on: ubuntu-latest/);
  assert.match(source, /BRIGHTDESK_PRIVATE_REPOSITORIES_READ/);
  assert.match(source, /persist-credentials: false/);
  assert.match(source, /contents: read/);
  assert.doesNotMatch(source, /contents: write/);
});

test('weekly build matrix includes Windows, macOS and Linux for every private project', () => {
  const source = fs.readFileSync(workflow, 'utf8');
  for (const project of ['Brightdesk-suite', 'Brightdesk-Sheets', 'Brightdesk-Decks', 'Brightdesk-Notes', 'Brightdesk-Database', 'Brightdesk-Forms']) {
    assert.ok(source.includes('project: ' + project), project + ' is missing from the build matrix');
  }
  for (const platform of ['win', 'mac', 'linux']) assert.ok(source.includes('platform: ' + platform));
});
test('private jobs skip safely when the read-only token has not been configured', () => {
  const source = fs.readFileSync(workflow, 'utf8');
  assert.match(source, /id: private-token/);
  assert.match(source, /available=false/);
  assert.match(source, /steps\.private-token\.outputs\.available == 'true'/);
});
