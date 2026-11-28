'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseTapFailureNames,
  parseSpecFailureNames,
  parseFailureNames,
  formatPrivateFailureSummary
} = require('../scripts/brightdesk-private-runner/private-test-diagnostics.js');

test('private diagnostics extract TAP failure names only', () => {
  const output = 'TAP version 13\nnot ok 1 - package audit rejects stale versions\n# assertion details withheld\n';
  assert.deepEqual(parseTapFailureNames(output), ['package audit rejects stale versions']);
  assert.deepEqual(parseFailureNames(output), ['package audit rejects stale versions']);
});

test('private diagnostics extract Node spec reporter failure names', () => {
  const output = '✖ Linux path normalization remains portable (4.2ms)\n  Error: private detail\n';
  assert.deepEqual(parseSpecFailureNames(output), ['Linux path normalization remains portable']);
  assert.deepEqual(parseFailureNames(output), ['Linux path normalization remains portable']);
});

test('private diagnostics tolerate ANSI-coloured and indented TAP failures', () => {
  const output = '  \u001b[31mnot ok 2 - highlighted failing case\u001b[0m\n';
  assert.deepEqual(parseTapFailureNames(output), ['highlighted failing case']);
});

test('private diagnostics never include raw assertion messages or stack traces', () => {
  const summary = formatPrivateFailureSummary('Brightdesk-Developer-Tools', ['Linux path normalization remains portable']);
  assert.match(summary, /Linux path normalization remains portable/);
  assert.match(summary, /stack traces were withheld/);
  assert.doesNotMatch(summary, /private detail|Error:|\n\s+at\s+/i);
});
