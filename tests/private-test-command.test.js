'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const runnerScript = path.join(__dirname, '..', 'scripts', 'brightdesk-private-runner', 'run-private-project-check.sh');

test('Suite compound Node and Vitest test command applies each framework TAP reporter correctly', () => {
  const source = fs.readFileSync(runnerScript, 'utf8');
  const start = source.indexOf('run_private_tests() {');
  const nextFunction = source.indexOf('run_rust_checks() {', start);
  const suiteTestBlock = start >= 0 && nextFunction > start ? source.slice(start, nextFunction) : '';

  assert.ok(suiteTestBlock.includes('PROJECT_NAME" == "Brightdesk-suite"'));
  assert.ok(suiteTestBlock.includes('node --test --test-reporter=tap tests/*.test.js test/*.test.mjs'));
  assert.ok(suiteTestBlock.includes('./node_modules/.bin/vitest run --reporter=tap'));
  assert.ok(suiteTestBlock.includes('npm test -- --test-reporter=tap'));
});

test('manual private test dispatch keeps GitHub credentials away from controller scripts', () => {
  const workflowPath = path.join(__dirname, '..', '.github', 'workflows', 'brightdesk-private-maintenance.yml');
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const jobStart = workflow.indexOf('  daily-private-tests:');
  const jobEnd = workflow.indexOf('  suite-one-time-installer-smoke-tests:', jobStart);
  const job = jobStart >= 0 && jobEnd > jobStart ? workflow.slice(jobStart, jobEnd) : '';

  const controllerCheckoutStart = job.indexOf('- name: Check out the Brightdesk Pages controller');
  const credentialCheckStart = job.indexOf('- name: Check whether read-only GitHub App credentials are configured', controllerCheckoutStart);
  const controllerCheckout = controllerCheckoutStart >= 0 && credentialCheckStart > controllerCheckoutStart
    ? job.slice(controllerCheckoutStart, credentialCheckStart)
    : '';

  const issueTokenStart = job.indexOf('- name: Create an issue-only token for the private Suite diagnostic');
  const issueReportStart = job.indexOf('- name: Save sanitized failure names to the private Suite issue', issueTokenStart);
  const issueTokenStep = issueTokenStart >= 0 && issueReportStart > issueTokenStart
    ? job.slice(issueTokenStart, issueReportStart)
    : '';
  const issueReportStep = issueReportStart >= 0 ? job.slice(issueReportStart) : '';

  assert.match(controllerCheckout, /persist-credentials: false/);
  assert.match(issueTokenStep, /github\.event_name != 'workflow_dispatch'/);
  assert.match(issueReportStep, /if: always\(\) && github\.event_name != 'workflow_dispatch'/);
});
