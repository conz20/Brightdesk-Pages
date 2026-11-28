'use strict';

const fs = require('node:fs');
const { cleanTestName, parseTapFailureNames } = require('./private-test-diagnostics');

const MARKER_PREFIX = '<!-- brightdesk-private-pr-test-diagnostic:';
const ALLOWED_PROJECTS = new Set([
  'Brightdesk-Sheets',
  'Brightdesk-Decks',
  'Brightdesk-Notes',
  'Brightdesk-Database',
  'Brightdesk-Forms',
  'Brightdesk-Lists',
  'Brightdesk-Planner',
  'Brightdesk-To-Do',
  'Brightdesk-Workspace'
]);

function escapeMarkdown(value) {
  return String(value).replace(/[\\\\`*_{}\[\]()#+.!|<>~-]/g, '\\\\$&');
}

function buildPrivatePrDiagnostic({ project, prNumber, failedNames }) {
  if (!ALLOWED_PROJECTS.has(project)) throw new Error('Only approved private product repositories can receive diagnostics.');
  if (!Number.isSafeInteger(prNumber) || prNumber < 1) throw new Error('A valid private product PR number is required.');
  const names = Array.isArray(failedNames)
    ? [...new Set(failedNames.map(cleanTestName)
    : [];
  const marker = `${MARKER_PREFIX}${project}#${prNumber} -->`;
  const detail = names.length
    ? ['Failing test cases (names only):', '', ...names.map(name => `- ${escapeMarkdown(name)}`)].join('\n')
    : 'Automated tests failed, but the TAP reporter did not identify individual failing test names. Raw output remains only on the temporary GitHub-hosted runner.';
  const body = [
    marker,
    '## Latest private hosted-CI diagnostic',
    '',
    `- Product: ${project}`,
    `- Pull request: #${prNumber}`,
    '',
    detail,
    '',
    'Assertion messages, source contents, local paths, URLs, credentials and stack traces are intentionally withheld.'
  ].join('\n');
  return body.slice(0,6000);
}

async function upsertPrivatePrDiagnostic({
  token, owner='conz20', project, prNumber, failedNames,
  fetchImpl=fetch, apiUrl='https://api.github.com'
}) {
  if (!token) throw new Error('A short-lived issue-scoped token is required.');
  if (!/^[A-Za-z0-9-]+$/.test(owner)) throw new Error('Invalid GitHub owner.');
  if (!ALLOWED_PROJECTS.has(project)) throw new Error('Only approved private product repositories can receive diagnostics.');
  if (!Number.isSafeInteger(prNumber) || prNumber < 1) throw new Error('A valid private product PR number is required.');

  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json'
  };
  const base = `${apiUrl}/repos/${owner}/${project}`;
  const listResponse = await fetchImpl(`${base}/issues/${prNumber}/comments?per_page=100`, { headers });
  if (!listResponse.ok) throw new Error('Could not read private PR diagnostic comments.');
  const comments = await listResponse.json();
  const body = buildPrivatePrDiagnostic({ project, prNumber, failedNames });
  const marker = `${MARKER_PREFIX}${project}#${prNumber} -->`;
  const existing = comments.find(comment => String(comment.body || '').includes(marker));
  const url = existing
    ? `${base}/issues/comments/${existing.id}`
    : `${base}/issues/${prNumber}/comments`;
  const response = await fetchImpl(url, {
    method: existing ? 'PATCH' : 'POST',
    headers,
    body: JSON.stringify({ body })
  });
  if (!response.ok) throw new Error('Could not save the private PR diagnostic comment.');
  return existing ? 'updated' : 'created';
}

if (require.main === module) {
  try {
    const logPath = process.env.BRIGHTDESK_FAILURE_LOG_FILE;
    if (!logPath || !fs.existsSync(logPath)) throw new Error('Diagnostic log file is missing.');
    const project = process.env.BRIGHTDESK_PROJECT;
    const prNumber = Number(process.env.BRIGHTDESK_PR_NUMBER);
    const owner = process.env.GITHUB_REPOSITORY_OWNER || 'conz20';
    const tapOutput = fs.readFileSync(logPath, 'utf8');
    const result = upsertPrivatePrDiagnostic({
      token: process.env.GITHUB_TOKEN,
      owner,
      project,
      prNumber,
      failedNames: parseTapFailureNames(tapOutput)
    });
    result.then(() => {
      process.stdout.write('Names-only private PR diagnostic saved.\n');
    }).catch(() => {
      process.stderr.write('Private PR diagnostic could not be saved; raw test output remains private.\n');
      process.exitCode = 1;
    });
  } catch {
    process.stderr.write('Private PR diagnostic could not be saved; raw test output remains private.\n');
    process.exitCode = 1;
  }
}

module.exports = { MARKER_PREFIX, ALLOWED_PROJECTS, buildPrivatePrDiagnostic, upsertPrivatePrDiagnostic };
