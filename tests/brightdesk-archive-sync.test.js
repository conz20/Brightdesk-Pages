const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const script = fs.readFileSync(
  path.join(__dirname, '..', 'scripts', 'brightdesk-archive', 'sync.sh'),
  'utf8'
);

function readList(name) {
  const match = script.match(new RegExp(name + '=\\\\(\\\\s*([\\\\s\\\\S]*?)\\\\s*\\\\)'));
  assert.ok(match, 'Missing ' + name + ' list');
  return match[1].trim().split(/\\\\s+/);
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
  assert.doesNotMatch(script, /x-access-token:[^\\s@]+@github\\.com/);
});

test('source refs and timestamped snapshots are retained without pruning', () => {
  assert.match(script, /git fsck --full --no-reflogs/);
  assert.match(script, /refs\\/archive\\/\$repo\\/snapshots/);
  assert.match(script, /git push --quiet archive/);
  assert.match(script, /git ls-remote --refs archive/);
  assert.match(script, /Deliberately do not prune/);
});
