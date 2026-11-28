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
  assert.match(script, /not pruned from the recovery archive/);
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

test('portfolio backups are scheduled every six hours on GitHub-hosted runners', () => {
  assert.ok(workflow.includes('cron: "17 */6 * * *"'), 'Expected a six-hour UTC schedule');
  assert.match(workflow, /runs-on: ubuntu-latest/);
});


test('scheduled archive checks poll for changes every five minutes and retain the six-hour reconciliation', () => {
  assert.ok(workflow.includes('cron: "3/5 * * * *"'), 'Expected a five-minute change check');
  assert.ok(workflow.includes('cron: "17 */6 * * *"'), 'Expected the six-hour safety reconciliation');
  assert.match(workflow, /ONLY_CHANGED:/);
  assert.match(workflow, /github\.event_name == 'schedule'/);
  assert.ok(workflow.includes("vars.BRIGHTDESK_ARCHIVE_CHANGE_CHECKS_ENABLED == 'true'"), 'Five-minute checks stay disabled until owner setup is complete');
  assert.ok(workflow.includes("github.event.schedule == '3/5 * * * *'"), 'Only the five-minute schedule uses changed-only mode');
});

test('change-aware archive mode checks source branch and tag SHAs before cloning', () => {
  assert.match(script, /ONLY_CHANGED/);
  assert.match(script, /git ls-remote --refs/);
  assert.match(script, /refs\/archive\/\$repo\/heads/);
  assert.match(script, /refs\/archive\/\$repo\/tags/);
  assert.match(script, /No source changes detected/);
  assert.match(script, /UNCHANGED/);
  assert.match(script, /archived_refs\[\$stable_ref\]/);
  const changeCheck = script.indexOf('if [[ "$only_changed" == "true" ]]');
  const noChangeExit = script.indexOf('No source changes detected');
  const firstClone = script.indexOf('git clone --bare');
  assert.ok(changeCheck >= 0 && noChangeExit > changeCheck && firstClone > noChangeExit, 'No-change exit must happen before any repository clone');
  assert.match(script, /refs\/heads\/\*.*refs\/tags\/\*/s);
});

test('unchanged five-minute check exits before cloning any repository', () => {
  const os = require('node:os');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'brightdesk-archive-noop-'));
  const bin = path.join(temp, 'bin');
  fs.mkdirSync(bin);
  const callLog = path.join(temp, 'calls.log');
  const summary = path.join(temp, 'summary.md');
  const mockGit = path.join(bin, 'git');
  const mock = [
    '#!/bin/bash',
    'set -euo pipefail',
    'echo "$*" >> "$GIT_CALL_LOG"',
    'if [[ "$1" == "ls-remote" ]]; then',
    '  if [[ "$3" == *Brightdesk-Archives.git ]]; then',
    '    pattern="$4"',
    '    rest="${pattern#refs/archive/}"',
    '    repository="${rest%%/*}"',
    '    printf "%s\\trefs/archive/%s/heads/main\\n" "$GIT_TEST_SHA" "$repository"',
    '  else',
    '    printf "%s\\trefs/heads/main\\n" "$GIT_TEST_SHA"',
    '  fi',
    '  exit 0',
    'fi',
    'echo "Unexpected git command: $*" >&2',
    'exit 99',
  ].join('\n');
  fs.writeFileSync(mockGit, mock);
  fs.chmodSync(mockGit, 0o755);
  try {
    const result = spawnSync('bash', [path.join(root, 'scripts', 'brightdesk-archive', 'sync.sh')], {
      encoding: 'utf8',
      timeout: 30000,
      env: { ...process.env, PATH: bin + path.delimiter + process.env.PATH, RUNNER_TEMP: path.join(temp, 'runner'),
        GITHUB_STEP_SUMMARY: summary, GITHUB_RUN_ID: 'test-1', GITHUB_RUN_ATTEMPT: '1',
        SOURCE_READ_TOKEN: 'placeholder-source', ARCHIVE_WRITE_TOKEN: 'placeholder-archive',
        ONLY_CHANGED: 'true', GIT_TEST_SHA: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', GIT_CALL_LOG: callLog },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /No source changes detected/);
    assert.match(fs.readFileSync(summary, 'utf8'), /Repositories changed: 0/);
    const calls = fs.readFileSync(callLog, 'utf8').trim().split('\n');
    assert.equal(calls.length, 54);
    assert.ok(calls.every(call => call.startsWith('ls-remote --refs ')));
    assert.ok(!calls.some(call => call.includes('clone')));
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});


test('Brightdesk-Archives is backed up as a private Git bundle in Brightdesk-Release-Tools', () => {
  const backupPath = path.join(root, 'scripts', 'brightdesk-archive', 'backup-archive-repository.sh');
  assert.ok(fs.existsSync(backupPath), 'A separate archive self-recovery script must exist');
  const backup = fs.readFileSync(backupPath, 'utf8');
  assert.match(backup, /ARCHIVE_WRITE_TOKEN/);
  assert.match(backup, /ARCHIVE_RECOVERY_WRITE_TOKEN/);
  assert.match(backup, /git clone --mirror/);
  assert.match(backup, /bundle create/);
  assert.match(backup, /git bundle verify/);
  assert.match(backup, /fsck --full/);
  assert.match(backup, /sha256sum/);
  assert.match(backup, /Brightdesk-Release-Tools/);
  assert.match(backup, /upload_url/);
  assert.match(backup, /read-back/i);
  assert.match(backup, /git clone --mirror.*bundle|bundle.*git clone --mirror/s);
  assert.match(backup, /2147483647/);
  assert.doesNotMatch(backup, /Brightdesk-Pages\/releases|github\.com\/conz20\/Brightdesk-Pages/);
});

test('private archive self-recovery runs daily and manually on GitHub-hosted runners only', () => {
  const workflowPath = path.join(root, '.github', 'workflows', 'brightdesk-archive-self-recovery.yml');
  assert.ok(fs.existsSync(workflowPath), 'The private archive self-recovery workflow must exist');
  const source = fs.readFileSync(workflowPath, 'utf8');
  assert.match(source, /cron: ["']17 1 \* \* \*["']/);
  assert.match(source, /workflow_dispatch:/);
  assert.match(source, /github\.ref == 'refs\/heads\/main'/);
  assert.match(source, /runs-on: ubuntu-latest/);
  assert.match(source, /ARCHIVE_WRITE_TOKEN:/);
  assert.match(source, /ARCHIVE_RECOVERY_WRITE_TOKEN:/);
  assert.doesNotMatch(source, /pull_request:/);
  assert.doesNotMatch(source, /self-hosted/);
});

test('archive self-recovery script validates Bash syntax', () => {
  const backupPath = path.join(root, 'scripts', 'brightdesk-archive', 'backup-archive-repository.sh');
  assert.ok(fs.existsSync(backupPath), 'The archive self-recovery script must exist');
  const result = spawnSync('bash', ['-n', backupPath], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || 'archive self-recovery bash -n failed');
});
