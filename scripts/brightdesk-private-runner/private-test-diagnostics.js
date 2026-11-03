'use strict';

function cleanTestName(value) {
  return String(value)
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

function parseTapFailureNames(tapOutput) {
  const names = [];
  const seen = new Set();

  for (const line of String(tapOutput).split(/\r?\n/)) {
    const match = line.match(/^not ok \d+ - (.+)$/);
    if (!match) continue;

    const name = cleanTestName(match[1]);
    if (!name || seen.has(name)) continue;

    seen.add(name);
    names.push(name);
  }

  return names;
}

function escapeMarkdown(value) {
  return value.replace(/[\\`*_{}\[\]()#+.!|>~-]/g, '\\$&');
}

function formatPrivateFailureSummary(project, failedNames) {
  const safeProject = cleanTestName(project) || 'unknown project';
  const names = Array.isArray(failedNames)
    ? [...new Set(failedNames.map(cleanTestName).filter(Boolean))].slice(0, 30)
    : [];

  if (names.length === 0) {
    return `Automated tests failed for ${safeProject}, but the TAP reporter did not identify an individual failing test. Detailed output remains private on the temporary runner.`;
  }

  return [
    `Automated tests failed for ${safeProject}.`,
    '',
    'Failing test cases (names only; assertion messages and stack traces were withheld):',
    ...names.map(name => `- ${escapeMarkdown(name)}`)
  ].join('\n');
}

module.exports = { parseTapFailureNames, formatPrivateFailureSummary };
