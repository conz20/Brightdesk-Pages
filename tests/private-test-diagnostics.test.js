'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseTapFailureNames, formatPrivateFailureSummary } = require('../scripts/brightdesk-private-runner/private-test-diagnostics');

test('private test diagnostics extracts failed test names from TAP output', () => {
  const tap = [
    'TAP version 13',
    '# Subtest: first feature',
    'not ok 1 - first feature',
    '  ---',
    "  error: 'private assertion detail'",
    '  code: ERR_ASSERTION',
    '  ...',
    '1..1',
    '# tests 1',
    '# pass 0',
    '# fail 1'
  ].join('\n');

  assert.deepEqual(parseTapFailureNames(tap), ['first feature']);
});

test('private test diagnostics never includes raw errors, source paths, or stack traces', () => {
  const tap = [
    'not ok 1 - failing feature',
    '  error: SECRET_SOURCE_CONTENT',
    '  stack: /home/runner/work/private/repo/src/private.js:42',
    '  code: ERR_ASSERTION'
  ].join('\n');

  const summary = formatPrivateFailureSummary('Brightdesk-suite', parseTapFailureNames(tap));

  assert.match(summary, /Brightdesk-suite/);
  assert.match(summary, /failing feature/);
  assert.doesNotMatch(summary, /SECRET_SOURCE_CONTENT/);
  assert.doesNotMatch(summary, /private\.js/);
  assert.doesNotMatch(summary, /ERR_ASSERTION/);
});

test('private test diagnostics handles TAP output without individual failing test names', () => {
  const summary = formatPrivateFailureSummary('Brightdesk-suite', []);

  assert.match(summary, /test command failed/);
  assert.match(summary, /individual failing test/i);
});

test('private test diagnostics bounds and sanitizes untrusted test names', () => {
  const tap = [
    'not ok 1 - bad\u001b[31mname\u001b[0m',
    'not ok 2 - bad name'
  ].join('\n');

  const names = parseTapFailureNames(tap);
  assert.deepEqual(names, ['badname']);
  assert.ok(names[0].length <= 200);
});
