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
  assert.match(source, />> "\$LOG_FILE" 2>&1/);
  assert.match(source, /Detailed output was kept only on the temporary runner/);
  assert.doesNotMatch(source, /cat "\$LOG_FILE"/);
  assert.match(source, /npm test -- --test-reporter=tap/);
  assert.match(source, /failure_summary_file/);
  assert.ok(source.includes('failure-summary.b64'));
});

test('controller grants only read access through the default workflow token', () => {
  const source = fs.readFileSync(workflow, 'utf8');
  assert.match(source, /permissions:\n  contents: read/);
  assert.doesNotMatch(source, /contents: write/);
});

test('private checkout tokens remain read-only and diagnostic token is issue-only', () => {
  const source = fs.readFileSync(workflow, 'utf8');
  assert.equal((source.match(/actions\/create-github-app-token@bcd2ba49218906704ab6c1aa796996da409d3eb1/g) || []).length, 3);
  assert.equal((source.match(/repositories: \$\{\{ matrix\.project \}\}/g) || []).length, 2);
  assert.equal((source.match(/permission-contents: read/g) || []).length, 2);
  assert.equal((source.match(/permission-issues: write/g) || []).length, 1);
  assert.match(source, /repositories: Brightdesk-suite/);
  assert.match(source, /matrix\.project == 'Brightdesk-suite'/);
  assert.equal((source.match(/token: \$\{\{ steps\.app-token\.outputs\.token \}\}/g) || []).length, 2);
  assert.match(source, /vars\.BRIGHTDESK_APP_ID/);
  assert.match(source, /secrets\.BRIGHTDESK_APP_PRIVATE_KEY/);
  assert.match(source, /persist-credentials: false/);
  assert.doesNotMatch(source, /BRIGHTDESK_PRIVATE_REPOSITORIES_READ/);
});

test('private diagnostic reporter always runs its local guard after a job failure', () => {
  const source = fs.readFileSync(workflow, 'utf8');
  const reporter = source.split('      - name: Save sanitized failure names to the private Suite issue')[1]?.split('  weekly-private-installer-builds:')[0] ?? '';
  assert.ok(reporter.includes('if: always()'));
  assert.ok(reporter.includes('BRIGHTDESK_PROJECT'));
  assert.ok(reporter.includes('BRIGHTDESK_TEST_OUTCOME'));
  assert.ok(reporter.includes('BRIGHTDESK_FAILURE_SUMMARY_FILE'));
  assert.ok(!reporter.includes('BRIGHTDESK_FAILURE_SUMMARY_BASE64'));
  assert.ok(reporter.includes('-n "$GITHUB_TOKEN"'));
  assert.ok(reporter.includes('BRIGHTDESK_PROJECT" == "Brightdesk-suite"'));
  assert.ok(reporter.includes('BRIGHTDESK_TEST_OUTCOME" == "failure"'));
});
test('both private jobs safely skip when App credentials are missing', () => {
  const source = fs.readFileSync(workflow, 'utf8');
  assert.equal((source.match(/id: private-token/g) || []).length, 2);
  assert.equal((source.match(/available=false/g) || []).length, 2);
  assert.equal((source.match(/if: steps\.private-token\.outputs\.available == 'true'/g) || []).length, 8);
});

test('weekly build matrix includes Windows, macOS and Linux for every private project', () => {
  const source = fs.readFileSync(workflow, 'utf8');
  for (const project of ['Brightdesk-suite', 'Brightdesk-Sheets', 'Brightdesk-Decks', 'Brightdesk-Notes', 'Brightdesk-Database', 'Brightdesk-Forms']) {
    assert.ok(source.includes('project: ' + project), project + ' is missing from the build matrix');
  }
  for (const platform of ['win', 'mac', 'linux']) assert.ok(source.includes('platform: ' + platform));
});

test('trusted controller updates trigger daily private checks but never start the installer matrix', () => {
  const source = fs.readFileSync(workflow, 'utf8');
  const pushTrigger = source.match(/push:\n([\s\S]*?)\n  schedule:/)?.[1] ?? '';
  assert.match(pushTrigger, /branches: \[main\]/);
  assert.match(pushTrigger, /brightdesk-private-maintenance\.yml/);

  const dailyJob = source.split('  daily-private-tests:')[1]?.split('  weekly-private-installer-builds:')[0] ?? '';
  assert.match(
    dailyJob,
    /if: github\.event_name == 'schedule' \|\| github\.event_name == 'workflow_dispatch' \|\| github\.event_name == 'push'/
  );

  const weeklyJob = source.split('  weekly-private-installer-builds:')[1] ?? '';
  assert.doesNotMatch(weeklyJob, /github\.event_name == 'push'/);
});


test('Brightdesk-AI validation follows current main and records the exact tested revision', () => {
  for (const name of [
    'brightdesk-ai-validation.yml',
    'brightdesk-ai-test-coverage-validation.yml'
  ]) {
    const source = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', name), 'utf8');
    assert.match(source, /repository: connormolloy12\/Brightdesk-AI/);
    assert.match(source, /ref: main/);
    assert.doesNotMatch(source, /ref: [a-f0-9]{40}/);
    assert.match(source, /git -C private-ai rev-parse HEAD/);
    assert.match(source, /Source revision:/);
  }

  const controller = fs.readFileSync(workflow, 'utf8');
  const pullRequestPaths = controller.match(/pull_request:\n([\s\S]*?)\n  push:/)?.[1] ?? '';
  const pushPaths = controller.match(/push:\n([\s\S]*?)\n  schedule:/)?.[1] ?? '';
  for (const file of [
    '.github/workflows/brightdesk-ai-validation.yml',
    '.github/workflows/brightdesk-ai-test-coverage-validation.yml'
  ]) {
    assert.ok(pullRequestPaths.includes(file), file + ' must trigger controller validation on pull requests');
    assert.ok(pushPaths.includes(file), file + ' must trigger controller validation on main');
  }
});
