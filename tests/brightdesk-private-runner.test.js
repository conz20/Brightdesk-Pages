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
  assert.ok(source.includes('private-installer-diagnostics.js'));
  assert.match(source, /installer_failure_summary_file/);
});

test('controller grants only read access through the default workflow token', () => {
  const source = fs.readFileSync(workflow, 'utf8');
  assert.match(source, /permissions:\n  contents: read/);
  assert.doesNotMatch(source, /contents: write/);
});

test('private checkout tokens remain read-only and diagnostic token is issue-only', () => {
  const source = fs.readFileSync(workflow, 'utf8');
  assert.equal((source.match(/actions\/create-github-app-token@bcd2ba49218906704ab6c1aa796996da409d3eb1/g) || []).length, 5);
  assert.equal((source.match(/repositories: \$\{\{ matrix\.project \}\}/g) || []).length, 2);
  assert.equal((source.match(/permission-contents: read/g) || []).length, 3);
  assert.equal((source.match(/permission-issues: write/g) || []).length, 2);
  assert.match(source, /repositories: Brightdesk-suite/);
  assert.match(source, /matrix\.project == 'Brightdesk-suite'/);
  assert.equal((source.match(/token: \$\{\{ steps\.app-token\.outputs\.token \}\}/g) || []).length, 3);
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
  assert.equal((source.match(/id: private-token/g) || []).length, 3);
  assert.equal((source.match(/available=false/g) || []).length, 3);
  assert.equal((source.match(/if: steps\.private-token\.outputs\.available == 'true'/g) || []).length, 12);
});

test('weekly build matrix includes Windows, macOS and Linux for every private project', () => {
  const source = fs.readFileSync(workflow, 'utf8');
  for (const project of ['Brightdesk-suite', 'Brightdesk-Sheets', 'Brightdesk-Decks', 'Brightdesk-Notes', 'Brightdesk-Database', 'Brightdesk-Forms']) {
    assert.ok(source.includes('project: ' + project), project + ' is missing from the build matrix');
  }
  for (const platform of ['win', 'mac', 'linux']) assert.ok(source.includes('platform: ' + platform));
});

test('daily private project checkouts use each repository default branch', () => {
  const source = fs.readFileSync(workflow, 'utf8');
  const dailyJob = source.split('  daily-private-tests:')[1]?.split('  weekly-private-installer-builds:')[0] ?? '';
  const checkout = dailyJob.split('      - name: Check out the private Brightdesk project')[1]?.split('      - name: Set up the required Node.js runtime')[0] ?? '';
  assert.ok(checkout.includes('repository: connormolloy12/${{ matrix.project }}'));
  assert.doesNotMatch(checkout, /^\s*ref:/m);
  assert.doesNotMatch(dailyJob, /fix\/suite-diagnostic-tests/);
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


test('Suite cross-platform builds perform native install and launch smoke tests', () => {
  const installScript = path.join(__dirname, '..', 'scripts', 'brightdesk-private-runner', 'verify-private-install.sh');
  const windowsScript = path.join(__dirname, '..', 'scripts', 'brightdesk-private-runner', 'verify-private-install.ps1');
  const runner = fs.readFileSync(runnerScript, 'utf8');
  const install = fs.readFileSync(installScript, 'utf8');
  const windows = fs.readFileSync(windowsScript, 'utf8');

  assert.match(runner, /if \[\[ "\$PROJECT_NAME" == "Brightdesk-suite" \]\]/);
  assert.match(runner, /installer installation smoke test/);
  assert.match(runner, /verify-private-install\.sh/);
  assert.match(runner, /CSC_IDENTITY_AUTO_DISCOVERY=false/);
  assert.ok(runner.indexOf('installer installation smoke test') > runner.indexOf('installer package verification'));
  assert.match(runner, /release:prepare/);
  assert.ok(runner.indexOf('release:prepare') > runner.indexOf('installer build'));
  assert.ok(runner.indexOf('release:prepare') < runner.indexOf('installer package verification'));
  assert.ok(install.includes('Brightdesk-Install-Linux.sh'));
  assert.match(install, /apt-get remove/);
  assert.match(install, /installer -allowUntrusted -pkg/);
  assert.match(install, /hdiutil attach/);
  assert.match(install, /verify-private-install\.ps1/);
  assert.doesNotMatch(install, /cygpath/);
  assert.match(install, /command -v.*APP_BINARY/);
  assert.match(install, /ldd.*not found/);
  assert.match(install, /Installed application launch check failed/);
  assert.match(windows, /Brightdesk-Setup-/);
  assert.match(windows, /Uninstall Brightdesk\.exe/);
  assert.match(windows, /--version/);
});

test('native installer smoke-test shell script has valid Bash syntax', { skip: process.platform === 'win32' }, () => {
  const installScript = path.join(__dirname, '..', 'scripts', 'brightdesk-private-runner', 'verify-private-install.sh');
  execFileSync('bash', ['-n', installScript], { stdio: 'pipe' });
});

test('one-time Suite installer request starts only Suite platform builds', () => {
  const source = fs.readFileSync(workflow, 'utf8');
  const pushTrigger = source.match(/push:\n([\s\S]*?)\n  schedule:/)?.[1] ?? '';
  const oneTimeJob = source.split('  suite-one-time-installer-smoke-tests:')[1]?.split('  weekly-private-installer-builds:')[0] ?? '';
  const weeklyJob = source.split('  weekly-private-installer-builds:')[1] ?? '';

  assert.ok(pushTrigger.includes('.github/requests/brightdesk-suite-installers.request'));
  assert.match(oneTimeJob, /github\.event_name == 'push'/);
  assert.match(oneTimeJob, /github\.event\.head_commit\.message/);
  assert.match(oneTimeJob, /\[build-brightdesk-suite-installers\]/);
  assert.ok(oneTimeJob.includes('repository: connormolloy12/Brightdesk-suite'));
  assert.match(oneTimeJob, /ref: main/);
  for (const platform of ['win', 'mac', 'linux']) assert.ok(oneTimeJob.includes('platform: ' + platform));
  assert.doesNotMatch(weeklyJob, /github\.event_name == 'push'/);
  assert.doesNotMatch(oneTimeJob, /actions\/upload-artifact/);
});

test('installer verification and pull request validation use isolated concurrency groups', () => {
  const source = fs.readFileSync(workflow, 'utf8');
  const concurrency = source.match(/concurrency:\n([\s\S]*?)\n\njobs:/)?.[1] ?? '';
  assert.match(concurrency, /github\.event_name == 'pull_request'/);
  assert.match(concurrency, /brightdesk-private-maintenance-pr-/);
  assert.match(concurrency, /build-brightdesk-suite-installers/);
  assert.match(concurrency, /brightdesk-suite-installer-request-/);
  assert.match(concurrency, /brightdesk-private-project-maintenance/);
});


test('private installer diagnostics only expose whitelisted platform, stage, exit code and missing libraries', () => {
  const diagnostics = require('../scripts/brightdesk-private-runner/private-installer-diagnostics');
  const output = diagnostics.formatPrivateInstallerFailure({
    platform: 'linux',
    stage: 'installer installation smoke test',
    exitCode: 127,
    log: [
      'Installed application launch check failed with exit code 127.',
      'Missing system runtime libraries: libasound.so.2, libnss3.so, libgtk-3.so.0',
      'source=/home/runner/work/private/source/src/main.js',
      'SECRET_SOURCE_CONTENT',
      'at privateFunction (/home/runner/work/private/source/app.js:42:5)'
    ].join('\n')
  });

  assert.match(output, /Brightdesk-suite/);
  assert.match(output, /Platform: linux/);
  assert.match(output, /Failed stage: installer installation smoke test/);
  assert.match(output, /Exit code: 127/);
  assert.match(output, /libasound\.so\.2/);
  assert.match(output, /libnss3\.so/);
  assert.match(output, /libgtk-3\.so\.0/);
  assert.doesNotMatch(output, /SECRET_SOURCE_CONTENT|private\\.js|source\\/src|runner\\/work|at privateFunction/);
});

test('private installer diagnostics discard unknown paths and malformed library names', () => {
  const diagnostics = require('../scripts/brightdesk-private-runner/private-installer-diagnostics');
  const output = diagnostics.formatPrivateInstallerFailure({
    platform: 'win',
    stage: 'installer installation smoke test',
    exitCode: 127,
    log: [
      'The Windows installer did not install Brightdesk.exe.',
      'Missing system runtime libraries: C:\\private\\evil.dll, libvalid.so.1;SECRET, ../private.dll',
      'C:\\Users\\runner\\source\\app.js'
    ].join('\n')
  });

  assert.match(output, /Windows installer did not install Brightdesk\.exe/);
  assert.doesNotMatch(output, /C:\\\\|evil|SECRET|\\.\\.\\//);
  assert.doesNotMatch(output, /Missing system runtime libraries:/);
});

test('private installer diagnostics reject unsupported platform and stage metadata', () => {
  const diagnostics = require('../scripts/brightdesk-private-runner/private-installer-diagnostics');
  assert.throws(() => diagnostics.formatPrivateInstallerFailure({
    platform: 'unknown', stage: 'installer installation smoke test', exitCode: 1, log: ''
  }), /unsupported platform/i);
  assert.throws(() => diagnostics.formatPrivateInstallerFailure({
    platform: 'linux', stage: '/private/path', exitCode: 1, log: ''
  }), /unsupported stage/i);
  assert.throws(() => diagnostics.formatPrivateInstallerFailure({
    platform: 'linux', stage: 'installer build', exitCode: '127', log: ''
  }), /exit code/i);
});

test('private installer diagnostic reporter updates one marked comment per platform', async () => {
  const reporter = require('../scripts/brightdesk-private-runner/report-private-installer-failure');
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return calls.length === 1
      ? { ok: true, json: async () => [{ id: 789, body: '<!-- brightdesk-private-installer-diagnostic-linux -->\nold' }] }
      : { ok: true, json: async () => ({ id: 789 }) };
  };

  const result = await reporter.upsertInstallerDiagnostic({
    token: 'test-token',
    platform: 'linux',
    summary: 'Platform: linux\nExit code: 127',
    fetchImpl,
    apiUrl: 'https://api.example.test'
  });

  assert.equal(result, 'updated');
  assert.equal(calls[1].options.method, 'PATCH');
  assert.ok(calls[1].url.endsWith('/issues/comments/789'));
  const body = JSON.parse(calls[1].options.body).body;
  assert.ok(body.includes('<!-- brightdesk-private-installer-diagnostic-linux -->'));
  assert.ok(body.includes('Platform: linux'));
});

test('private installer diagnostic reporter refuses missing tokens and empty summaries', async () => {
  const reporter = require('../scripts/brightdesk-private-runner/report-private-installer-failure');
  await assert.rejects(
    reporter.upsertInstallerDiagnostic({ token: '', platform: 'linux', summary: 'safe', fetchImpl: async () => ({ok:true,json:async()=>[]}) }),
    /short-lived issue-scoped GitHub token/
  );
  await assert.rejects(
    reporter.upsertInstallerDiagnostic({ token: 'test-token', platform: 'linux', summary: '', fetchImpl: async () => ({ok:true,json:async()=>[]}) }),
    /non-empty/
  );
});

test('installer failure workflow uses a separate Suite-only Issues token and posts only the bounded summary', () => {
  const source = fs.readFileSync(workflow, 'utf8');
  const job = source.split('  suite-one-time-installer-smoke-tests:')[1]?.split('  weekly-private-installer-builds:')[0] ?? '';
  assert.match(job, /id: build-installer/);
  assert.match(job, /id: installer-issue-token/);
  assert.match(job, /permission-issues: write/);
  assert.match(job, /repositories: Brightdesk-suite/);
  assert.match(job, /installer_failure_summary_file/);
  assert.match(job, /report-private-installer-failure\.js/);
  assert.match(job, /GITHUB_TOKEN/);
  assert.match(job, /continue-on-error: true/);
  assert.doesNotMatch(job, /upload-artifact/);
});
