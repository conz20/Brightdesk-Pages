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
