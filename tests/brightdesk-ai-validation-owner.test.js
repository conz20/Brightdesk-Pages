'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflow = fs.readFileSync(
  path.join(__dirname, '..', '.github', 'workflows', 'brightdesk-ai-validation.yml'),
  'utf8'
);

test('private AI validation uses the canonical conz20 owner and only Brightdesk-AI', () => {
  const tokenStep = workflow.split('- name: Mint a short-lived token for Brightdesk-AI only')[1]?.split('- name: Check out the current private auditor main revision')[0] ?? '';
  const checkoutStep = workflow.split('- name: Check out the current private auditor main revision')[1]?.split('- name: Pull the pinned Node.js test image')[0] ?? '';

  assert.match(tokenStep, /owner:\s*conz20/);
  assert.match(tokenStep, /repositories:\s*Brightdesk-AI/);
  assert.match(tokenStep, /permission-contents:\s*read/);
  assert.match(checkoutStep, /repository:\s*conz20\/Brightdesk-AI/);
  assert.doesNotMatch(workflow, /connormolloy12/);
  assert.match(workflow, /--network none/);
  assert.match(workflow, /node:24\.22\.2-bookworm-slim/);
});
