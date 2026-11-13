'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  splitBase64,
  createEvidenceSummary,
  createCheckRunPayload,
  assertValidPng,
  validateEnvironment
} = require('../scripts/publish-visual-evidence-checks');

test('pins visual evidence to the pull request source head instead of the synthetic merge SHA', () => {
  const context = validateEnvironment({
    GITHUB_REPOSITORY: 'conz20/Brightdesk-Pages',
    GITHUB_SHA: 'a'.repeat(40),
    BRIGHTDESK_VISUAL_HEAD_SHA: 'b'.repeat(40),
    GITHUB_RUN_ID: '43219279497',
    GITHUB_TOKEN: 'test-token'
  });

  assert.equal(context.headSha, 'b'.repeat(40));
  assert.equal(context.runId, '43219279497');
});

test('uses the selected branch SHA for workflow dispatch when no pull request head exists', () => {
  const context = validateEnvironment({
    GITHUB_REPOSITORY: 'conz20/Brightdesk-Pages',
    GITHUB_SHA: 'c'.repeat(40),
    GITHUB_RUN_ID: '43219279500',
    GITHUB_TOKEN: 'test-token'
  });

  assert.equal(context.headSha, 'c'.repeat(40));
});

test('rejects an invalid explicit visual evidence head SHA', () => {
  assert.throws(() => validateEnvironment({
    GITHUB_REPOSITORY: 'conz20/Brightdesk-Pages',
    GITHUB_SHA: 'a'.repeat(40),
    BRIGHTDESK_VISUAL_HEAD_SHA: 'not-a-commit',
    GITHUB_RUN_ID: '43219279501',
    GITHUB_TOKEN: 'test-token'
  }), /Missing or invalid GitHub Actions repository, commit, run ID or token context/);
});

test('splits compressed image data into ordered, reassemblable check-run chunks', () => {
  const original = Buffer.alloc(110000);
  for (let index = 0; index < original.length; index += 1) original[index] = index % 251;
  const encoded = original.toString('base64');
  const chunks = splitBase64(encoded, 40000);

  assert.ok(chunks.length > 1);
  assert.ok(chunks.every(chunk => chunk.length <= 40000));
  assert.equal(chunks.join(''), encoded);
  assert.deepEqual(Buffer.from(chunks.join(''), 'base64'), original);
});

test('builds a bounded check-run summary with image identity, part order and checksum', () => {
  const summary = createEvidenceSummary({
    image: 'workspace',
    part: 2,
    parts: 3,
    sha256: 'a'.repeat(64),
    data: 'A'.repeat(40000)
  });

  assert.ok(summary.includes('BRIGHTDESK_VISUAL_EVIDENCE_V1|image=workspace|part=2/3|sha256=' + 'a'.repeat(64) + '|data='));
  assert.ok(Buffer.byteLength(summary, 'utf8') < 65535);
});

test('creates completed check-run metadata for the exact commit and screenshot chunk', () => {
  const payload = createCheckRunPayload({
    runId: '43208829031',
    headSha: '5b9715d6301a9d1e561fa73c0c29816fc4a83bff',
    image: 'navigation-collapsed',
    part: 1,
    parts: 1,
    sha256: 'b'.repeat(64),
    data: 'QUJD',
    completedAt: '2026-11-12T12:00:00.000Z'
  });

  assert.equal(payload.head_sha, '5b9715d6301a9d1e561fa73c0c29816fc4a83bff');
  assert.equal(payload.status, 'completed');
  assert.equal(payload.conclusion, 'success');
  assert.match(payload.name, /43208829031.*navigation-collapsed.*1-1/);
  assert.match(payload.output.summary, /data=QUJD/);
  assert.equal(payload.completed_at, '2026-11-12T12:00:00.000Z');
});

test('rejects malformed or dimensionless PNG captures before encoding', () => {
  const valid = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(valid, 0);
  valid.write('IHDR', 12, 'ascii');
  valid.writeUInt32BE(1352, 16);
  valid.writeUInt32BE(730, 20);

  assert.deepEqual(assertValidPng(valid), { width: 1352, height: 730 });
  assert.throws(() => assertValidPng(Buffer.from('not a PNG')), /valid PNG/);
  const dimensionless = Buffer.from(valid);
  dimensionless.writeUInt32BE(0, 16);
  assert.throws(() => assertValidPng(dimensionless), /valid PNG/);
});

test('rejects malformed repository slugs and nonnumeric workflow run IDs', () => {
  const validContext = {
    GITHUB_REPOSITORY: 'conz20/Brightdesk-Pages',
    GITHUB_SHA: 'a'.repeat(40),
    GITHUB_RUN_ID: '43219279497',
    GITHUB_TOKEN: 'test-token'
  };

  assert.throws(() => validateEnvironment({
    ...validContext,
    GITHUB_REPOSITORY: 'conz20/Brightdesk Pages'
  }), /Missing or invalid GitHub Actions repository, commit, run ID or token context/);

  assert.throws(() => validateEnvironment({
    ...validContext,
    GITHUB_RUN_ID: 'not-a-run'
  }), /Missing or invalid GitHub Actions repository, commit, run ID or token context/);
});
