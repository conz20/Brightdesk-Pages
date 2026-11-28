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
    '  duration_ms: 0.9',
    '  type: test',
    "  location: '/tmp/private-source/src/private.js:42:1'",
    '  failureType: testCodeFailure',
    "  error: 'PRIVATE_ERROR_DETAIL'",
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

  assert.match(summary, /Automated tests failed/);
  assert.match(summary, /individual failing test/i);
});

test('private test diagnostics bounds and sanitizes untrusted test names', () => {
  const tap = [
    'not ok 1 - bad\u001b[31mname\u001b[0m',
    'not ok 2 - badname'
  ].join('\n');

  const names = parseTapFailureNames(tap);
  assert.deepEqual(names, ['badname']);
  assert.ok(names[0].length <= 200);
});

const {
  MARKER,
  readPrivateFailureSummary,
  buildDiagnosticComment,
  upsertDiagnosticComment
} = require('../scripts/brightdesk-private-runner/report-private-test-failure');

test('private diagnostic summary is read from a runner-local file instead of an environment variable', () => {
  const encoded = Buffer.from('Failing test cases: private name only', 'utf8').toString('base64');
  const summary = readPrivateFailureSummary('runner-local-summary.b64', {
    readFileSync: () => encoded
  });

  assert.equal(summary, 'Failing test cases: private name only');
});

test('private diagnostic comment includes only the bounded sanitized summary', () => {
  const body = buildDiagnosticComment('Failing test cases: first feature');

  assert.ok(body.includes(MARKER));
  assert.ok(body.includes('first feature'));
  assert.doesNotMatch(body, /SECRET_SOURCE_CONTENT|private\.js|stack trace detail/);
});

test('private diagnostic reporter creates one marked comment when none exists', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return calls.length === 1
      ? { ok: true, json: async () => [] }
      : { ok: true, json: async () => ({ id: 123 }) };
  };

  const result = await upsertDiagnosticComment({
    token: 'test-token',
    summary: 'Failing test cases: first feature',
    fetchImpl,
    apiUrl: 'https://api.example.test'
  });

  assert.equal(result, 'created');
  assert.equal(calls[1].options.method, 'POST');
  assert.ok(calls[1].url.endsWith('/issues/27/comments'));
  assert.equal(JSON.parse(calls[1].options.body).body.includes(MARKER), true);
});

test('private diagnostic reporter updates its existing marked comment instead of spamming issues', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return calls.length === 1
      ? { ok: true, json: async () => [{ id: 456, body: MARKER + '\\nold diagnostic' }] }
      : { ok: true, json: async () => ({ id: 456 }) };
  };

  const result = await upsertDiagnosticComment({
    token: 'test-token',
    summary: 'Failing test cases: second feature',
    fetchImpl,
    apiUrl: 'https://api.example.test'
  });

  assert.equal(result, 'updated');
  assert.equal(calls[1].options.method, 'PATCH');
  assert.ok(calls[1].url.endsWith('/issues/comments/456'));
});

test('private diagnostic reporter refuses to send an empty report', async () => {
  await assert.rejects(
    upsertDiagnosticComment({ token: 'test-token', summary: '', fetchImpl: async () => ({ ok: true, json: async () => [] }) }),
    /non-empty private diagnostic summary/
  );
});



const {
  MARKER_PREFIX,
  buildPrivatePrDiagnostic,
  upsertPrivatePrDiagnostic
} = require('../scripts/brightdesk-private-runner/report-private-pr-test-failure');

test('private product PR diagnostics contain only cleaned failing test names', () => {
  const body = buildPrivatePrDiagnostic({
    project: 'Brightdesk-Planner',
    prNumber: 8,
    failedNames: ['planner smoke test', 'planner smoke test', 'source /home/runner/work/private/src/app.js:42']
  });
  assert.ok(body.includes('Brightdesk-Planner PR #8'));
  assert.ok(body.includes('planner smoke test'));
  assert.ok(body.includes(MARKER_PREFIX));
  assert.doesNotMatch(body, /\/home\/runner|SECRET_SOURCE_CONTENT|assertion detail|stack trace/);
});

test('private product PR diagnostics create one marked comment in the matching private PR', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({url,options});
    return calls.length === 1
      ? {ok:true,json:async()=>[]}
      : {ok:true,json:async()=>({id:902})};
  };
  const result = await upsertPrivatePrDiagnostic({
    token:'test-token',
    owner:'conz20',
    project:'Brightdesk-Planner',
    prNumber:8,
    failedNames:['first safe test name'],
    fetchImpl,
    apiUrl:'https://api.example.test'
  });
  assert.equal(result,'created');
  assert.ok(calls[0].url.endsWith('/repos/conz20/Brightdesk-Planner/issues/8/comments?per_page=100'));
  assert.ok(calls[1].url.endsWith('/repos/conz20/Brightdesk-Planner/issues/8/comments'));
  assert.equal(calls[1].options.method,'POST');
  assert.ok(JSON.parse(calls[1].options.body).body.includes('first safe test name'));
});

test('private product PR diagnostics update an existing marked comment instead of creating duplicates', async () => {
  const calls = [];
  const marker = MARKER_PREFIX + 'Brightdesk-To-Do#7 -->';
  const fetchImpl = async (url,options) => {
    calls.push({url,options});
    return calls.length === 1
      ? {ok:true,json:async()=>[{id:903,body:marker + '\\nold'}]}
      : {ok:true,json:async()=>({id:903})};
  };
  const result=await upsertPrivatePrDiagnostic({
    token:'test-token',
    owner:'conz20',
    project:'Brightdesk-To-Do',
    prNumber:7,
    failedNames:['second safe test name'],
    fetchImpl,
    apiUrl:'https://api.example.test'
  });
  assert.equal(result,'updated');
  assert.equal(calls[1].options.method,'PATCH');
  assert.ok(calls[1].url.endsWith('/repos/conz20/Brightdesk-To-Do/issues/comments/903'));
});

test('private product PR diagnostics reject an unknown repository and missing token', async () => {
  const args={token:'test-token',owner:'conz20',project:'Brightdesk-Pages',prNumber:1,failedNames:['safe'],fetchImpl:async()=>({ok:true,json:async()=>[]})};
  await assert.rejects(upsertPrivatePrDiagnostic(args),/approved private product/);
  await assert.rejects(upsertPrivatePrDiagnostic({...args,project:'Brightdesk-Planner',token:''}),/short-lived issue-scoped token/);
});


test('private test-name diagnostics redact absolute paths and URLs before publication', () => {
  const names = parseTapFailureNames([
    'not ok 1 - source /home/runner/work/private/src/app.js:42',
    'not ok 2 - service https://internal.example.test/private/path'
  ].join('\\n'));
  assert.equal(names.length, 2);
  assert.ok(names.every(name => !name.includes('/home/runner') && !name.includes('internal.example.test')));
  assert.ok(names.every(name => name.length <= 200));
});
