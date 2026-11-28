'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function readWorkflow(name) {
  return fs.readFileSync(
    path.join(__dirname, '..', '.github', 'workflows', name),
    'utf8'
  );
}

const workflows = [
  'brightdesk-ai-validation.yml',
  'brightdesk-ai-test-coverage-validation.yml'
];

for (const name of workflows) {
  test(name + ' uses the canonical conz20 owner and only Brightdesk-AI', () => {
    const workflow = readWorkflow(name);
    const tokenStep = workflow
      .split('- name: Mint a short-lived token for Brightdesk-AI only')[1]
      ?.split('- name: Check out the current private auditor main revision')[0] ?? '';
    const checkoutStep = workflow
      .split('- name: Check out the current private auditor main revision')[1]
      ?.split('- name: Pull the ')[0] ?? '';

    assert.match(tokenStep, /owner:\s*conz20/);
    assert.match(tokenStep, /repositories:\s*Brightdesk-AI/);
    assert.match(tokenStep, /permission-contents:\s*read/);
    assert.match(checkoutStep, /repository:\s*conz20\/Brightdesk-AI/);
    assert.doesNotMatch(workflow, /connormolloy12/);
    assert.match(workflow, /--network none/);
    assert.match(workflow, /node:24\.22\.2-bookworm-slim/);
  });
}
