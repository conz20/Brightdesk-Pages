const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const script = fs.readFileSync(
  path.join(__dirname, '..', 'scripts', 'brightdesk-archive', 'sync.sh'),
  'utf8'
);

function readList(name) {
  const prefix = name + '=(';
  const start = script.indexOf(prefix);
  assert.notEqual(start, -1, 'Missing ' + name + ' list');
  const open = start + prefix.length;
  const close = script.indexOf(')', open);
  assert.notEqual(close, -1, 'Unclosed ' + name + ' list');
  return script.slice(open, close).trim().split(/\s+/);
}

test('archive job covers exactly the 27 non-archive repositories', () => {
  const repositories = readList('repos');
  assert.equal(repositories.length, 27);
  assert.equal(new Set(repositories).size, 27);
  assert.ok(!repositories.includes('Brightdesk-Archives'));
});

test('private source allowlist has the 14 currently private source repositories', () => {
  const privateRepositories = readList('private_repos');
  assert.equal(privateRepositories.length, 14);
  assert.equal(new Set(privateRepositories).size, 14);
  assert.ok(privateRepositories.every(repository => readList('repos').includes(repository)));
});

test('separate tokens are used for source reads and archive writes', () => {
  assert.match(script, /SOURCE_READ_TOKEN/);
  assert.match(script, /ARCHIVE_WRITE_TOKEN/);
  assert.match(script, /GIT_ASKPASS/);
  assert.doesNotMatch(script, /x-access-token:[^\s@]+@github\.com/);
});

test('archive sync shell script passes Bash syntax validation', () => {
  const scriptPath = path.join(__dirname, '..', 'scripts', 'brightdesk-archive', 'sync.sh');
  const result = spawnSync('bash', ['-n', scriptPath], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || 'bash -n failed');
});

test('source refs and timestamped snapshots are retained without pruning', () => {
  assert.ok(script.includes('fsck --full --no-reflogs'));
  assert.ok(script.includes('refs/archive/$repo/snapshots/'));
  assert.ok(script.includes('push --quiet archive'));
  assert.ok(script.includes('ls-remote --refs archive'));
  assert.match(script, /Deliberately do not prune/);
});
