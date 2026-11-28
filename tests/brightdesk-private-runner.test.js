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
  assert.match(source, /node --test --test-reporter=tap tests\/\*\.test\.js test\/\*\.test\.mjs/);
  assert.match(source, /\.\/node_modules\/\.bin\/vitest run/);
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
  assert.equal((source.match(/actions\/create-github-app-token@bcd2ba49218906704ab6c1aa796996da409d3eb1/g) || []).length, 7);
  assert.equal((source.match(/repositories: \$\{\{ matrix\.project \}\}/g) || []).length, 4);
  assert.equal((source.match(/permission-contents: read/g) || []).length, 5);
  assert.equal((source.match(/permission-issues: write/g) || []).length, 2);
  assert.match(source, /repositories: Brightdesk-suite/);
  assert.match(source, /matrix\.project == 'Brightdesk-suite'/);
  assert.equal((source.match(/token: \$\{\{ steps\.app-token\.outputs\.token \}\}/g) || []).length, 5);
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
  assert.equal((source.match(/id: private-token/g) || []).length, 4);
  assert.equal((source.match(/available=false/g) || []).length, 4);
  assert.equal((source.match(/if: steps\.private-token\.outputs\.available == 'true'/g) || []).length, 17);
});

test('weekly build matrix includes Windows, macOS and Linux for every private project', () => {
  const source = fs.readFileSync(workflow, 'utf8');
  for (const project of ['Brightdesk-suite', 'Brightdesk-Sheets', 'Brightdesk-Decks', 'Brightdesk-Notes', 'Brightdesk-Database', 'Brightdesk-Forms', 'Brightdesk-Lists', 'Brightdesk-Planner', 'Brightdesk-To-Do', 'Brightdesk-Workspace']) {
    assert.ok(source.includes('project: ' + project), project + ' is missing from the build matrix');
  }
  for (const platform of ['win', 'mac', 'linux']) assert.ok(source.includes('platform: ' + platform));
});

test('daily Suite checks use the active independent branch while other private projects use main', () => {
  const source = fs.readFileSync(workflow, 'utf8');
  const dailyJob = source.split('  daily-private-tests:')[1]?.split('  daily-private-foundation-tests:')[0] ?? '';
  const checkout = dailyJob.split('      - name: Check out the private Brightdesk project')[1]?.split('      - name: Set up the required Node.js runtime')[0] ?? '';
  assert.ok(checkout.includes('repository: ${{ github.repository_owner }}/${{ matrix.project }}'));
  assert.ok(checkout.includes("ref: ${{ github.event_name == 'workflow_dispatch' && inputs.project != 'all' && matrix.project == inputs.project && inputs.project_ref || (matrix.project == 'Brightdesk-suite' && 'ci/github-hosted-runners-independent-of-macbook' || 'main') }}"));
  assert.doesNotMatch(dailyJob, /fix\/suite-diagnostic-tests/);
});

test('controller PRs and trusted pushes trigger daily private checks but never start the installer matrix', () => {
  const source = fs.readFileSync(workflow, 'utf8');
  const pushTrigger = source.match(/push:\n([\s\S]*?)\n  schedule:/)?.[1] ?? '';
  assert.match(pushTrigger, /branches: \[main\]/);
  assert.match(pushTrigger, /brightdesk-private-maintenance\.yml/);

  const dailyJob = source.split('  daily-private-tests:')[1]?.split('  weekly-private-installer-builds:')[0] ?? '';
  assert.match(
    dailyJob,
    /if:\s*>\-\s*\(github\.event_name == 'pull_request' \|\| github\.event_name == 'schedule' \|\| github\.event_name == 'workflow_dispatch' \|\| github\.event_name == 'push'\) &&\s*\(github\.event_name != 'workflow_dispatch' \|\| \(inputs\.run_reviewed_product_pr_matrix != true && \(inputs\.project == 'all' \|\| matrix\.project == inputs\.project\)\)\)/
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
    assert.match(source, /repository: \$\{\{ github\.repository_owner \}\}\/Brightdesk-AI/);
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
  assert.ok(runner.indexOf('run_private_command "installer installation smoke test"') > runner.indexOf('run_private_command "installer package verification"'));
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
  assert.match(install, /run_bounded_launch/);
  assert.match(install, /BRIGHTDESK_STARTUP_SMOKE_TEST=1/);
  assert.match(install, /launch check failed with exit code 124/);
  assert.match(install, /Installed application launch check failed/);
  assert.match(windows, /build\.win\.artifactName/);
  assert.match(windows, /Get-ChildItem -LiteralPath \$installDir -File -Filter 'Uninstall\*\.exe'/);
  assert.doesNotMatch(windows, /--version/);
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
  assert.ok(oneTimeJob.includes('repository: ${{ github.repository_owner }}/Brightdesk-suite'));
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
  assert.match(concurrency, /cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/);
});


test('installer smoke failures report only allowlisted diagnostics and support PowerShell Core', () => {
  const runner = fs.readFileSync(runnerScript, 'utf8');
  const install = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'brightdesk-private-runner', 'verify-private-install.sh'), 'utf8');

  assert.match(runner, /safe smoke-test diagnostics/i);
  assert.match(runner, /Missing system runtime libraries/);
  assert.match(runner, /Installed application launch check failed with exit code/);
  assert.match(runner, /Windows installer smoke test requires PowerShell/);
  assert.match(runner, /Safe smoke-test diagnostic:/);
  assert.match(runner, /No allowlisted smoke-test diagnostic matched/);
  assert.match(runner, /command or executable could not start/);
  assert.match(install, /command -v pwsh/);
  assert.match(install, /pwsh -NoProfile/);
  assert.match(install, /powershell\.exe -NoProfile/);
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
  assert.ok(!output.includes('SECRET_SOURCE_CONTENT'));
  assert.ok(!output.includes('/home/runner/work'));
  assert.ok(!output.includes('private.js'));
  assert.ok(!output.includes('at privateFunction'));
});

test('private installer diagnostics discard unknown paths and malformed library names', () => {
  const diagnostics = require('../scripts/brightdesk-private-runner/private-installer-diagnostics');
  const output = diagnostics.formatPrivateInstallerFailure({
    platform: 'win',
    stage: 'installer installation smoke test',
    exitCode: 127,
    log: [
      'The Windows installer did not install the product executable.',
      'Missing system runtime libraries: C:\\private\\evil.dll, libvalid.so.1;SECRET, ../private.dll',
      'C:\\Users\\runner\\source\\app.js'
    ].join('\n')
  });

  assert.match(output, /Windows installer did not install the product executable/);
  assert.ok(!output.includes('evil.dll'));
  assert.ok(!output.includes('SECRET'));
  assert.ok(!output.includes('../private.dll'));
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


test('private installer diagnostics classify missing commands without exposing command lines or paths', () => {
  const diagnostics = require('../scripts/brightdesk-private-runner/private-installer-diagnostics');
  const linux = diagnostics.formatPrivateInstallerFailure({
    platform: 'linux',
    stage: 'installer installation smoke test',
    exitCode: 127,
    log: 'bash: line 42: sudo: command not found\\n/home/runner/work/private/source/installer/install-linux.sh'
  });
  const windows = diagnostics.formatPrivateInstallerFailure({
    platform: 'win',
    stage: 'installer installation smoke test',
    exitCode: 127,
    log: "The term 'pwsh' is not recognized as the name of a cmdlet."
  });
  const generic = diagnostics.formatPrivateInstallerFailure({
    platform: 'mac',
    stage: 'installer installation smoke test',
    exitCode: 127,
    log: ''
  });

  for (const output of [linux, windows, generic]) {
    assert.match(output, /command or executable could not (be found|start)/i);
    assert.ok(!output.includes('sudo'));
    assert.ok(!output.includes('pwsh'));
    assert.ok(!output.includes('/home/runner/work'));
  }
});


test('installer smoke-test script uses an absolute controller path after changing into the private project', () => {
  const runner = fs.readFileSync(runnerScript, 'utf8');
  assert.match(runner, /SCRIPT_DIR=.*BASH_SOURCE/);
  assert.ok(runner.includes('bash "$SCRIPT_DIR/verify-private-install.sh"'));
  assert.ok(!runner.includes('run_private_command "installer installation smoke test" bash "$(dirname'));
});


test('private installer diagnostics classify known Linux install and executable failures safely', () => {
  const diagnostics = require('../scripts/brightdesk-private-runner/private-installer-diagnostics');
  const output = diagnostics.formatPrivateInstallerFailure({
    platform: 'linux',
    stage: 'installer installation smoke test',
    exitCode: 1,
    log: [
      'Installed Linux application executable was not found in the desktop entry or PATH.',
      'Linux package installation failed with exit code 1.',
      'source=/home/runner/work/private/source/src/main.js',
      'SECRET_SOURCE_CONTENT'
    ].join('\n')
  });

  assert.match(output, /Installed Linux application executable was not found/);
  assert.match(output, /Linux package installation failed with exit code 1/);
  assert.ok(!output.includes('/home/runner/work'));
  assert.ok(!output.includes('SECRET_SOURCE_CONTENT'));
});


test('private installer diagnostics classify Windows install and uninstall exit codes safely', () => {
  const diagnostics = require('../scripts/brightdesk-private-runner/private-installer-diagnostics');
  const output = diagnostics.formatPrivateInstallerFailure({
    platform: 'win',
    stage: 'installer installation smoke test',
    exitCode: 1,
    log: [
      'The Windows installer exited with code 1.',
      'C:\\Users\\runner\\source\\src\\main.js',
      'SECRET_SOURCE_CONTENT'
    ].join('\n')
  });

  assert.match(output, /The Windows installer exited with code 1/);
  assert.ok(!output.includes('C:/Users'));
  assert.ok(!output.includes('SECRET_SOURCE_CONTENT'));
});


test('Windows installer diagnostics expose only the last bounded smoke-test stage', () => {
  const diagnostics = require('../scripts/brightdesk-private-runner/private-installer-diagnostics');
  const powershell = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'brightdesk-private-runner', 'verify-private-install.ps1'), 'utf8');
  const output = diagnostics.formatPrivateInstallerFailure({
    platform: 'win',
    stage: 'installer installation smoke test',
    exitCode: 1,
    log: [
      'Brightdesk Windows smoke test stage: installer execution.',
      'Brightdesk Windows smoke test stage: application launch.',
      'C:/Users/runner/private/source/src/main.js'
    ].join('\n')
  });

  assert.match(output, /Windows smoke test failed during application launch/);
  assert.ok(!output.includes('C:\\Users'));
  assert.match(powershell, /Brightdesk Windows smoke test stage: installer execution/);
  assert.match(powershell, /Brightdesk Windows smoke test stage: application launch/);
  assert.match(powershell, /Brightdesk Windows smoke test stage: uninstaller execution/);
});


test('native installer smoke tests bound application launch time and clean up test processes', () => {
  const install = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'brightdesk-private-runner', 'verify-private-install.sh'), 'utf8');
  const powershell = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'brightdesk-private-runner', 'verify-private-install.ps1'), 'utf8');

  assert.match(install, /run_bounded_launch/);
  assert.match(install, /ps -o stat=/);
  assert.ok(install.includes('kill "$app_pid"'));
  assert.match(install, /for attempt in 1 2 3 4 5 6 7 8 9 10/);
  assert.match(install, /xvfb-run -a/);
  assert.match(powershell, /BRIGHTDESK_STARTUP_SMOKE_TEST/);
  assert.match(powershell, /WaitForExit\(15000\)/);
  assert.ok(powershell.includes("Wait-Process -Id $appProcess.Id"));
  assert.match(powershell, /did not complete its startup check/);
  assert.doesNotMatch(powershell, /Start-Sleep -Seconds 5/);
  assert.match(powershell, /taskkill\.exe \/PID/);
  assert.ok(!powershell.includes("& $appPath --version"));
});


test('daily private tests cover all ten private Brightdesk projects', () => {
  const source = fs.readFileSync(workflow, 'utf8');
  const dailyJob = source.split('  daily-private-tests:')[1]?.split('  suite-one-time-installer-smoke-tests:')[0] ?? '';
  const privateProjects = [
    'Brightdesk-suite',
    'Brightdesk-Sheets',
    'Brightdesk-Decks',
    'Brightdesk-Notes',
    'Brightdesk-Database',
    'Brightdesk-Forms',
    'Brightdesk-Lists',
    'Brightdesk-Planner',
    'Brightdesk-To-Do',
    'Brightdesk-Workspace'
  ];

  for (const project of privateProjects) {
    assert.ok(dailyJob.includes('- ' + project), project + ' is missing from daily private tests');
  }
});

test('new private products have Windows, macOS and Linux installer verification entries', () => {
  const source = fs.readFileSync(workflow, 'utf8');
  const weeklyJob = source.split('  weekly-private-installer-builds:')[1] ?? '';
  const projects = ['Brightdesk-Lists', 'Brightdesk-Planner', 'Brightdesk-To-Do', 'Brightdesk-Workspace'];

  const entries = weeklyJob.split(/\n          - project: /).filter(block => projects.some(project => block.startsWith(project + '\n')));
  for (const project of projects) {
    const projectEntries = entries.filter(block => block.startsWith(project + '\n'));
    assert.equal(projectEntries.length, 3, project + ' must have exactly three platform build entries');
    for (const platform of ['win', 'mac', 'linux']) {
      const entry = projectEntries.find(block => block.includes('platform: ' + platform));
      assert.ok(entry, project + ' is missing ' + platform);
      assert.ok(entry.includes('verify_script: verify:desktop:' + platform), project + ' has the wrong ' + platform + ' verification command');
    }
  }
});


test('Windows installer smoke test derives names from the checked-out product manifest and uses a unique temporary directory', () => {
  const windows = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'brightdesk-private-runner', 'verify-private-install.ps1'), 'utf8');
  assert.match(windows, /build\.win\.artifactName/);
  assert.match(windows, /\.Replace\('\$\{version\}'/);
  assert.match(windows, /\.Replace\('\$\{arch\}'/);
  assert.match(windows, /\.Replace\('\$\{ext\}'/);
  assert.match(windows, /build\.productName/);
  assert.match(windows, /Get-ChildItem -LiteralPath \$installDir -File -Filter 'Uninstall\*\.exe'/);
  assert.match(windows, /\[guid\]::NewGuid\(\)/);
  assert.doesNotMatch(windows, /Brightdesk-Setup-\$\(\$package\.version\)-x64\.exe/);
  assert.doesNotMatch(windows, /Join-Path \$env:RUNNER_TEMP 'brightdesk-install-smoke'/);
});

test('macOS installer smoke test derives the app bundle name and refuses to overwrite an existing installation', () => {
  const install = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'brightdesk-private-runner', 'verify-private-install.sh'), 'utf8');
  assert.match(install, /PRODUCT_NAME=.*package\.json/);
  assert.match(install, /APP_BUNDLE_NAME="\$\{PRODUCT_NAME\}\.app"/);
  assert.match(install, /PACKAGE_ID=.*build\?\.appId/);
  assert.match(install, /pkgutil --pkg-info "\$PACKAGE_ID"/);
  assert.match(install, /pkgutil --forget "\$PACKAGE_ID"/);
  assert.match(install, /WORK_DIR="\$\(mktemp -d "\$TEMP_BASE\/brightdesk-installer-smoke\.XXXXXX"\)"/);
  assert.match(install, /MOUNT_DIR="\$WORK_DIR\/mount"/);
  assert.match(install, /DMG_APP="\$WORK_DIR\/\$APP_BUNDLE_NAME"/);
  assert.match(install, /trap cleanup_macos EXIT/);
  assert.match(install, /if \[\[ -e "\$APP_PATH" \|\| -L "\$APP_PATH" \]\]/);
  assert.match(install, /INSTALL_ATTEMPTED=0/);
  assert.match(install, /if \[\[ "\$INSTALL_ATTEMPTED" -eq 1 \]\]/);
  assert.doesNotMatch(install, /APP_PATH="\/Applications\/Brightdesk\.app"/);
  assert.doesNotMatch(install, /-name 'Brightdesk\.app'/);
});

test('Linux installer smoke test refuses to remove a package that was already installed', () => {
  const install = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'brightdesk-private-runner', 'verify-private-install.sh'), 'utf8');
  assert.match(install, /dpkg-query -W -f='\$\{db:Status-Status\}' "\$PACKAGE_NAME"/);
  assert.match(install, /pre-existing package state; refusing to replace or remove it/);
  assert.match(install, /case "\$INSTALLED_STATUS" in/);
  assert.match(install, /INSTALL_ATTEMPTED=0/);
  assert.match(install, /if \[\[ "\$INSTALL_ATTEMPTED" -eq 1 \]\]/);
});


test('macOS installer diagnostics expose only safe bundle and receipt messages', () => {
  const diagnostics = require('../scripts/brightdesk-private-runner/private-installer-diagnostics');
  const output = diagnostics.formatPrivateInstallerFailure({
    platform: 'mac',
    stage: 'installer installation smoke test',
    exitCode: 3,
    log: [
      'A Brightdesk installer receipt already exists; refusing to modify or forget it.',
      '/Applications/Brightdesk Office Suite.app',
      'SECRET_SOURCE_CONTENT'
    ].join('\n')
  });
  const runner = fs.readFileSync(runnerScript, 'utf8');

  assert.match(output, /A Brightdesk installer receipt already exists/);
  assert.ok(!output.includes('/Applications/'));
  assert.ok(!output.includes('SECRET_SOURCE_CONTENT'));
  assert.match(runner, /A Brightdesk installer receipt already exists; refusing to modify or forget it/);
  assert.doesNotMatch(runner, /Brightdesk\\.app/);
});

test('private maintenance controller uses GitHub-hosted runners for every project and platform', () => {
  const source = fs.readFileSync(workflow, 'utf8');
  const validateJob = source.split('  validate-controller:')[1]?.split('  daily-private-tests:')[0] ?? '';
  const dailyJob = source.split('  daily-private-tests:')[1]?.split('  suite-one-time-installer-smoke-tests:')[0] ?? '';
  const suiteInstallerJob = source.split('  suite-one-time-installer-smoke-tests:')[1]?.split('  weekly-private-installer-builds:')[0] ?? '';
  const weeklyInstallerJob = source.split('  weekly-private-installer-builds:')[1] ?? '';

  assert.match(validateJob, /runs-on: ubuntu-slim/);
  assert.match(dailyJob, /runs-on: ubuntu-latest/);
  assert.match(dailyJob, /if: github\\.event_name == 'pull_request' \\|\\| github\\.event_name == 'schedule'/);
  for (const job of [suiteInstallerJob, weeklyInstallerJob]) {
    assert.match(job, /runs-on: \$\{\{ matrix\.runner \}\}/);
    assert.match(job, /runner: windows-latest/);
    assert.match(job, /runner: macos-latest/);
    assert.match(job, /runner: ubuntu-latest/);
    assert.doesNotMatch(job, /self-hosted/);
  }
  assert.doesNotMatch(source, /self-hosted|conz20/);
  assert.match(source, /actions\/checkout@[0-9a-f]{40}/);
  assert.match(source, /actions\/setup-node@[0-9a-f]{40}/);
});

test('README freshness uses a pinned GitHub-hosted runner', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'readme-freshness.yml'), 'utf8');
  assert.match(source, /runs-on: ubuntu-slim/);
  assert.match(source, /actions\/checkout@[0-9a-f]{40}/);
  assert.doesNotMatch(source, /self-hosted/);
});


test('Pages installer workflow uses the approved GitHub-hosted runner matrix', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'desktop-installers.yml'), 'utf8');
  const testJob = source.split('  test:')[1]?.split('  build:')[0] ?? '';
  const build = source.split('  build:')[1]?.split('  publish:')[0] ?? '';
  const publish = source.split('  publish:')[1] ?? '';

  assert.match(testJob, /runs-on: ubuntu-slim/);
  assert.match(testJob, /node-version: 24\.22\.2/);
  assert.match(build, /runner: windows-latest/);
  assert.match(build, /runner: macos-latest/);
  assert.match(build, /runner: ubuntu-latest/);
  assert.match(build, /runs-on: \$\{\{ matrix\.runner \}\}/);
  assert.match(publish, /runs-on: ubuntu-slim/);
  assert.doesNotMatch(source, /self-hosted|conz20/);
  assert.match(source, /actions\/checkout@[0-9a-f]{40}/);
  assert.match(source, /actions\/setup-node@[0-9a-f]{40}/);
});


test('private shared engineering repositories are tested through the hosted controller', () => {
  const source = fs.readFileSync(workflow, 'utf8');
  const job = source.split('  daily-private-foundation-tests:')[1] ?? '';
  assert.ok(job.includes('Brightdesk-Common-Libs'), 'Common Libraries must be checked');
  assert.ok(job.includes('Brightdesk-Developer-Tools'), 'Developer Tools must be checked');
  assert.ok(job.includes('permission-contents: read'), 'private source tokens must remain read-only');
  assert.ok(job.includes('node-version: ${{ steps.node-version.outputs.value }}'), 'Node must follow each repository engine pin');
  assert.ok(job.includes('npm run check:node'), 'Node runtime checks must run');
  assert.ok(job.includes('npm run check'), 'syntax checks must run');
  assert.ok(job.includes('npm test'), 'contract and regression tests must run');
  assert.match(job, /RUNNER_TEMP/);
  assert.match(job, /detailed output was kept only on the temporary runner/i);
  assert.doesNotMatch(job, /npm run verify|cat .*\.log|upload-artifact/);
});


test('manual private maintenance can target one approved project and exact branch ref', () => {
  const source = fs.readFileSync(workflow, 'utf8');
  const dispatch = source.split('  workflow_dispatch:')[1]?.split('\n\npermissions:')[0] ?? '';
  assert.match(dispatch, /project:/);
  assert.match(dispatch, /type: choice/);
  assert.match(dispatch, /default: all/);
  for (const project of [
    'Brightdesk-suite',
    'Brightdesk-Sheets',
    'Brightdesk-Decks',
    'Brightdesk-Notes',
    'Brightdesk-Database',
    'Brightdesk-Forms',
    'Brightdesk-Lists',
    'Brightdesk-Planner',
    'Brightdesk-To-Do',
    'Brightdesk-Workspace'
  ]) assert.ok(dispatch.includes('- ' + project), project + ' must be selectable');
  assert.match(dispatch, /project_ref:/);
  assert.match(dispatch, /type: string/);
  assert.match(dispatch, /default: main/);
});

test('manual targeted private checks run only the selected project and use its requested ref', () => {
  const source = fs.readFileSync(workflow, 'utf8');
  const dailyJob = source.split('  daily-private-tests:')[1]?.split('  daily-private-foundation-tests:')[0] ?? '';
  assert.match(dailyJob, /inputs\.project == 'all' \|\| matrix\.project == inputs\.project/);
  const checkout = dailyJob.split('      - name: Check out the private Brightdesk project')[1]?.split('      - name: Set up the required Node\.js runtime')[0] ?? '';
  assert.match(checkout, /inputs\.project_ref/);
  assert.match(checkout, /matrix\.project == inputs\.project/);
  assert.match(checkout, /matrix\.project == 'Brightdesk-suite'/);
});

test('targeted manual project checks do not start the foundation or cross-platform installer matrices', () => {
  const source = fs.readFileSync(workflow, 'utf8');
  const foundationJob = source.split('  daily-private-foundation-tests:')[1]?.split('  suite-one-time-installer-smoke-tests:')[0] ?? '';
  assert.match(foundationJob, /inputs\.project == 'all'/);
  const weeklyJob = source.split('  weekly-private-installer-builds:')[1] ?? '';
  assert.match(weeklyJob, /inputs\.run_cross_platform_builds == true/);
  assert.match(weeklyJob, /github\.event_name == 'workflow_dispatch'/);
});


test('public Pages repository references use the current Brightdesk project owner', () => {
  const files = [
    'README.md',
    'REPOSITORY_INFO.md',
    '.github/workflows/brightdesk-ai-validation.yml',
    '.github/workflows/brightdesk-ai-test-coverage-validation.yml',
    'src/desktop-downloads.js',
    'scripts/create-app-repository-seeds.js',
    'scripts/brightdesk-private-runner/report-private-installer-failure.js',
    'scripts/brightdesk-private-runner/report-private-test-failure.js'
  ];
  for (const file of files) {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    assert.doesNotMatch(source, /connormolloy12/, file + ' must not contain a stale GitHub owner');
    if (file.endsWith('desktop-downloads.js')) {
      assert.match(source, /github\.com\/conz20\/Brightdesk-suite\/releases/);
    }
  }
});


test('manual reviewed-product PR batch is owner-triggered, exact-head pinned and read-only', () => {
  const source = fs.readFileSync(workflow, 'utf8');
  const dispatch = source.split('  workflow_dispatch:')[1]?.split('\n\npermissions:')[0] ?? '';
  assert.match(dispatch, /run_reviewed_product_pr_matrix:/);
  assert.match(dispatch, /type: boolean/);
  assert.match(dispatch, /default: false/);

  const job = source.split('  reviewed-product-pr-tests:')[1]?.split('  daily-private-foundation-tests:')[0] ?? '';
  assert.match(job, /github\.event_name == 'workflow_dispatch'/);
  assert.match(job, /inputs\.run_reviewed_product_pr_matrix == true/);
  assert.match(job, /runs-on: ubuntu-latest/);
  assert.match(job, /matrix:\s*\n\s*include:/);
  assert.match(job, /permission-contents: read/);
  assert.match(job, /persist-credentials: false/);
  assert.match(job, /fetch-depth: 0/);
  assert.ok(job.includes('repository: ${{ github.repository_owner }}/${{ matrix.project }}'));
  assert.ok(job.includes('ref: ${{ matrix.project_ref }}'));
  assert.match(job, /expected_head_sha/);
  assert.match(job, /base_sha/);
  assert.match(job, /git -C source rev-parse HEAD/);
  assert.match(job, /git -C source diff --name-only/);
  assert.doesNotMatch(job, /git -C source fetch/);
  assert.match(job, /run-private-project-check\.sh/);
  assert.match(job, /Run private project tests without publishing source logs/);
  assert.doesNotMatch(job, /permission-contents:\s*write|permission-pull-requests:\s*write|upload-artifact|npm run dist:/);

  for (const project of [
    'Brightdesk-Sheets',
    'Brightdesk-Decks',
    'Brightdesk-Notes',
    'Brightdesk-Database',
    'Brightdesk-Forms',
    'Brightdesk-Lists',
    'Brightdesk-Planner',
    'Brightdesk-To-Do',
    'Brightdesk-Workspace'
  ]) assert.ok(job.includes(project), project + ' must be covered by the reviewed PR batch');

  assert.match(job, /pr_number: 26/);
  assert.match(job, /pr_number: 27/);

  assert.equal((job.match(/^\s+- project:/gm) || []).length, 10);
  assert.equal((job.match(/^\s+- project: Brightdesk-Lists$/gm) || []).length, 2);
  assert.equal((job.match(/^\s+pr_number: 48$/gm) || []).length, 2);
  for (const sha of [
    '9063fd07abe275016bf894a68af1d7a77f57a8ed',
    '1a7d7eed376addec3c0867b8cef5ac6e2f27bb3f',
    'c1eb924171bad1ffa9d1c74fa69a979dc23ae7db',
    '223cec0c893eb0e9cf2dc698570ac8f900bd5e9b',
    'a00b0b11a034de8e61309f06f4880cf95f4324f2',
    '4eee7ae0fffbdcdc5df8a021c767a79dc1825fea',
    '5324585a8c7a03cad7f418b2e115d194189c2219',
    'f1e072500717cb494ff2c2b6de7347c2aa321a5f',
    '4fc0e4cc984491d98d6cede2b0a61855f1d38b63',
    'ea94a8acee1331321100c707151955698831c74c'
  ]) assert.ok(job.includes('expected_head_sha: ' + sha), sha + ' must stay pinned');

  const dailyJob = source.split('  daily-private-tests:')[1]?.split('  daily-private-foundation-tests:')[0] ?? '';
  assert.match(dailyJob, /inputs\.run_reviewed_product_pr_matrix != true/);
  const foundationJob = source.split('  daily-private-foundation-tests:')[1]?.split('  suite-one-time-installer-smoke-tests:')[0] ?? '';
  assert.match(foundationJob, /inputs\.run_reviewed_product_pr_matrix != true/);
  const weeklyJob = source.split('  weekly-private-installer-builds:')[1] ?? '';
  assert.match(weeklyJob, /inputs\.run_reviewed_product_pr_matrix != true/);
});


test('exact-head private PR validation supports owner-approved pushes without exposing private write access', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '.github', 'workflows', 'brightdesk-exact-head-product-pr-validation.yml'),
    'utf8'
  );
  assert.match(source, /pull_request_target:/);
  assert.match(source, /push:/);
  assert.match(source, /github\.actor == github\.repository_owner/);
  assert.match(source, /validate-exact-head-private-prs/);
  assert.match(source, /github\.ref == 'refs\/heads\/main'/);
  assert.match(source, /permission-contents: read/);
  assert.match(source, /persist-credentials: false/);
  assert.match(source, /repositories: \$\{\{ matrix\.project \}\}/);
  assert.doesNotMatch(source, /self-hosted|permission-contents:\s*write|upload-artifact/);
});

test('exact-head private PR request pins unique project/PR pairs within the approved limit', () => {
  const request = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', '.github', 'requests', 'brightdesk-product-pr-validation.json'),
    'utf8'
  ));
  assert.equal(request.schema, 1);
  assert.ok(request.projects.length >= 1 && request.projects.length <= 20);
  const seen = new Set();
  for (const item of request.projects) {
    const key = item.project + '#' + item.pr;
    assert.ok(!seen.has(key), key + ' must be unique');
    seen.add(key);
    assert.match(item.head_sha, /^[a-f0-9]{40}$/);
    assert.match(item.base_sha, /^[a-f0-9]{40}$/);
  }
  assert.equal(request.projects.length, 13);
  for (const expected of [
    'bcac6f5ade6c6b6b22d8d517294cba503b32d0fe',
    'ccab697714c803c11f0cf3d32f934b56e1f64a',
    '55479bc485bf182adb197c74970859ff05e09086',
    '5639b1d44bdd32ed72acec6d2cf2d58927cef084'
  ]) assert.ok(request.projects.some(item => item.head_sha === expected), expected);
});
