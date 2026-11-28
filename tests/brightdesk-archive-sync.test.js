const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const script = fs.readFileSync(path.join(root, 'scripts', 'brightdesk-archive', 'sync.sh'), 'utf8');
const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'brightdesk-archive-sync.yml'), 'utf8');

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

test('source allowlist matches the current 13-public / 14-private split', () => {
  const repositories = readList('repos');
  const privateRepositories = readList('private_repos');
  assert.equal(privateRepositories.length, 14);
  assert.equal(new Set(privateRepositories).size, 14);
  assert.ok(privateRepositories.every(repository => repositories.includes(repository)));
  assert.equal(repositories.length - privateRepositories.length, 13);
});

test('separate least-privilege credentials are used for source reads and archive writes', () => {
  assert.match(script, /SOURCE_READ_TOKEN/);
  assert.match(script, /ARCHIVE_WRITE_TOKEN/);
  assert.match(script, /GIT_ASKPASS/);
  assert.doesNotMatch(script, /x-access-token:[^\s@]+@github\.com/);
});

test('archive sync shell script passes Bash syntax validation', () => {
  const scriptPath = path.join(root, 'scripts', 'brightdesk-archive', 'sync.sh');
  const result = spawnSync('bash', ['-n', scriptPath], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || 'bash -n failed');
});

test('every backup attempt gets a unique snapshot namespace', () => {
  assert.match(script, /GITHUB_RUN_ID/);
  assert.match(script, /GITHUB_RUN_ATTEMPT/);
  assert.match(script, /snapshots/);
});

test('stable refs may advance but timestamped snapshots are never force-pushed', () => {
  assert.match(script, /\+refs\/heads\/\*:refs\/archive\/\$repo\/heads\/\*/);
  assert.match(script, /refs\/archive\/\$repo\/snapshots\/\$stamp\/\*:refs\/archive\/\$repo\/snapshots\/\$stamp\/\*/);
  assert.doesNotMatch(script, /\+refs\/archive\/\$repo\/snapshots/);
  assert.match(script, /Deliberately do not prune/);
});

test('each current-run archive ref is checked by exact name and SHA, not total count', () => {
  assert.match(script, /ls-remote --refs archive/);
  assert.match(script, /awk -v target="\$expected_ref"/);
  assert.match(script, /actual_sha.*expected_sha/s);
  assert.doesNotMatch(script, /actual_refs=/);
});

test('mirror secrets are available only to the main-branch mirror job', () => {
  assert.match(workflow, /github\.event_name == 'pull_request'/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /SOURCE_READ_TOKEN:/);
  assert.match(workflow, /ARCHIVE_WRITE_TOKEN:/);
  assert.match(workflow, /persist-credentials: false/);
});
