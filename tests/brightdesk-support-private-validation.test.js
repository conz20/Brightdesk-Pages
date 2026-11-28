import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const workflowPath = '.github/workflows/brightdesk-exact-head-support-pr-validation.yml';
const scriptPath = 'scripts/brightdesk-private-runner/run-support-project-check.sh';
const requestPath = '.github/requests/brightdesk-support-pr-validation.json';

const workflow = fs.readFileSync(workflowPath, 'utf8');
const script = fs.readFileSync(scriptPath, 'utf8');
const request = JSON.parse(fs.readFileSync(requestPath, 'utf8'));

test('support validation request contains only the approved twelve supporting repositories', () => {
  const approved = new Set([
    'Brightdesk-AI', 'Brightdesk-Fonts', 'Brightdesk-Localization',
    'Brightdesk-Engine', 'Brightdesk-Common-Libs', 'Brightdesk-Common-Actions',
    'Brightdesk-Developer-Tools', 'Brightdesk-Release-Tools', 'Brightdesk-Services',
    'Brightdesk-Type-Preview', 'Brightdesk-Printing', 'Brightdesk-Voice'
  ]);
  assert.equal(request.schema, 1);
  assert.equal(request.projects.length, 13);
  const keys = new Set();
  for (const item of request.projects) {
    assert.ok(approved.has(item.project), item.project);
    assert.ok(Number.isSafeInteger(item.pr) && item.pr > 0);
    assert.match(item.head_sha, /^[a-f0-9]{40}$/);
    assert.match(item.base_sha, /^[a-f0-9]{40}$/);
    assert.ok(['linux', 'mac', 'win'].includes(item.platform), item.platform);
    const key = item.project + ':' + item.platform;
    assert.ok(!keys.has(key), key);
    keys.add(key);
  }
  assert.equal(request.projects.filter(x => x.project === 'Brightdesk-Printing').length, 2);
});

test('support checker uses an explicit project command allowlist', () => {
  for (const project of [
    'Brightdesk-AI', 'Brightdesk-Fonts', 'Brightdesk-Localization',
    'Brightdesk-Engine', 'Brightdesk-Common-Libs', 'Brightdesk-Common-Actions',
    'Brightdesk-Developer-Tools', 'Brightdesk-Release-Tools', 'Brightdesk-Services',
    'Brightdesk-Type-Preview', 'Brightdesk-Printing', 'Brightdesk-Voice'
  ]) assert.ok(script.includes(project), project);
  assert.doesNotMatch(script, /eval\s|bash\s+-c|sh\s+-c/);
  for (const command of [
    'npm run check:node', 'npm run check', 'npm run verify',
    'npm run check:catalogue', 'npm run check:resources',
    'npm run validate:readme-visuals', 'npm run native:build',
    'npm run native:build:macos', 'npm run native:test:macos',
    'npm run build:macos-discovery', 'npm run build:windows-discovery',
    'npm run validate:languages', 'npm run validate:model-packs',
    'cargo test --workspace --locked', 'cargo clippy'
  ]) assert.ok(script.includes(command), command);
});

test('support checker keeps raw private output on the temporary runner', () => {
  assert.match(script, /RUNNER_TEMP/);
  assert.match(script, />> ["']?\$LOG_FILE/);
  assert.match(script, /Detailed output was kept only on the temporary runner/);
  assert.doesNotMatch(script, /cat\s+["']?\$LOG_FILE|tee\s+["']?\$LOG_FILE|upload-artifact/);
});

test('support workflow is owner-main-triggered and uses only read-only repository tokens', () => {
  assert.match(workflow, /push:\\s*\\n\\s*branches:\\s*\\[main\\]/);
  assert.ok(workflow.includes('validate-support-policy-prs'));
  assert.ok(workflow.includes('if: github.actor == github.repository_owner'));
  assert.match(workflow, /permissions:\\s*\\n\\s*contents:\\s*read/);
  assert.match(workflow, /actions\\/create-github-app-token/);
  assert.match(workflow, /permission-contents:\\s*read/);
  assert.doesNotMatch(workflow, /permission-(?:issues|contents):\\s*write|upload-artifact|workflow_dispatch/);
});

test('support workflow pins and verifies exact private PR heads before running checks', () => {
  assert.match(workflow, /expected_head_sha/);
  assert.match(workflow, /base_sha/);
  assert.match(workflow, /git -C source rev-parse HEAD/);
  assert.match(workflow, /merge-base --is-ancestor/);
  assert.match(workflow, /persist-credentials:\s*false/);
});

test('Pages README documents the support validation trust and privacy boundary', () => {
  const readme = fs.readFileSync('README.md', 'utf8');
  assert.match(readme, /exact-head private support PR validation/i);
  assert.match(readme, /Contents: read-only/i);
  assert.match(readme, /raw private logs/i);
});
