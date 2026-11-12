'use strict';

const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const MAX_SUMMARY_BYTES = 65535;
const CHUNK_BASE64_CHARS = 40000;
const MAX_JPEG_BYTES = 300 * 1024;
const VISUAL_IMAGES = [
  { name: 'workspace', file: 'workspace.png' },
  { name: 'navigation-collapsed', file: 'navigation-collapsed.png' }
];

function assertValidPng(image) {
  if (!Buffer.isBuffer(image) || image.length < 24 ||
      image.readUInt32BE(0) !== 0x89504e47 ||
      image.toString('ascii', 12, 16) !== 'IHDR' ||
      image.readUInt32BE(16) < 1 || image.readUInt32BE(20) < 1) {
    throw new Error('Visual evidence input is not a valid PNG with positive dimensions.');
  }
  return { width: image.readUInt32BE(16), height: image.readUInt32BE(20) };
}

function splitBase64(encoded, chunkSize = CHUNK_BASE64_CHARS) {
  if (typeof encoded !== 'string' || !encoded || !Number.isInteger(chunkSize) ||
      chunkSize < 4 || chunkSize % 4 !== 0) {
    throw new Error('Visual evidence base64 data or chunk size is invalid.');
  }
  const chunks = [];
  for (let offset = 0; offset < encoded.length; offset += chunkSize) {
    chunks.push(encoded.slice(offset, offset + chunkSize));
  }
  return chunks;
}

function createEvidenceSummary({ image, part, parts, sha256, data }) {
  if (!/^(workspace|navigation-collapsed)$/.test(image) ||
      !Number.isInteger(part) || !Number.isInteger(parts) ||
      part < 1 || parts < part || !/^[a-f0-9]{64}$/.test(sha256) ||
      typeof data !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) {
    throw new Error('Visual evidence check-run metadata is invalid.');
  }
  const summary = [
    'Brightdesk Pages visual evidence payload. Concatenate each part in numeric order, then base64-decode the result as JPEG.',
    '',
    `BRIGHTDESK_VISUAL_EVIDENCE_V1|image=${image}|part=${part}/${parts}|sha256=${sha256}|data=${data}`
  ].join('\n');
  if (Buffer.byteLength(summary, 'utf8') >= MAX_SUMMARY_BYTES) {
    throw new Error('Visual evidence chunk exceeds the GitHub check-run summary size limit.');
  }
  return summary;
}

function createCheckRunPayload({
  runId,
  headSha,
  image,
  part,
  parts,
  sha256,
  data,
  completedAt = new Date().toISOString()
}) {
  if (!/^\d+$/.test(String(runId)) || !/^[a-f0-9]{40}$/.test(headSha)) {
    throw new Error('Visual evidence requires a valid workflow run ID and commit SHA.');
  }
  return {
    name: `Brightdesk Visual Evidence ${runId} ${image} ${part}-${parts}`,
    head_sha: headSha,
    external_id: `brightdesk-visual-evidence:${runId}:${image}:${part}`,
    status: 'completed',
    conclusion: 'success',
    completed_at: completedAt,
    output: {
      title: `Brightdesk Pages ${image} screenshot payload ${part}/${parts}`,
      summary: createEvidenceSummary({ image, part, parts, sha256, data })
    }
  };
}

function validateEnvironment(env) {
  const repository = env.GITHUB_REPOSITORY || '';
  const headSha = env.BRIGHTDESK_VISUAL_HEAD_SHA || env.GITHUB_SHA || '';
  if (!/^[A-Za-z0-9_.-]+\\/[A-Za-z0-9_.-]+$/.test(repository) ||
      !/^[a-f0-9]{40}$/.test(headSha) ||
      !/^\\d+$/.test(env.GITHUB_RUN_ID || '') ||
      !env.GITHUB_TOKEN) {
    throw new Error('Missing or invalid GitHub Actions repository, commit, run ID or token context.');
  }
  return {
    repository,
    headSha,
    runId: env.GITHUB_RUN_ID,
    token: env.GITHUB_TOKEN
  };
}
async function convertPngToJpeg(inputPath, outputPath, {
  execFileSyncImpl = execFileSync,
  readFileImpl = fs.readFile
} = {}) {
  execFileSyncImpl('sips', [
    '-s', 'format', 'jpeg',
    '-s', 'formatOptions', '55',
    '-Z', '1200',
    inputPath,
    '--out', outputPath
  ], { stdio: 'ignore' });
  let jpeg = await readFileImpl(outputPath);
  if (jpeg.length > MAX_JPEG_BYTES) {
    execFileSyncImpl('sips', [
      '-s', 'format', 'jpeg',
      '-s', 'formatOptions', '40',
      '-Z', '900',
      inputPath,
      '--out', outputPath
    ], { stdio: 'ignore' });
    jpeg = await readFileImpl(outputPath);
  }
  if (jpeg.length < 4 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8 ||
      jpeg[jpeg.length - 2] !== 0xff || jpeg[jpeg.length - 1] !== 0xd9 ||
      jpeg.length > MAX_JPEG_BYTES) {
    throw new Error('Compressed visual evidence must be a valid JPEG smaller than 300 KB.');
  }
  return jpeg;
}

async function publishVisualEvidence({
  screenshotDir,
  repository,
  headSha,
  runId,
  token,
  fetchImpl = globalThis.fetch,
  execFileSyncImpl = execFileSync,
  fileSystem = fs,
  platform = process.platform,
  log = console.log
}) {
  if (platform !== 'darwin') {
    throw new Error('Visual evidence compression requires the existing private macOS runner.');
  }
  if (typeof fetchImpl !== 'function') throw new Error('The GitHub API fetch implementation is unavailable.');
  if (!repository || !/^[a-f0-9]{40}$/.test(headSha || '') ||
      !/^\d+$/.test(String(runId)) || !token) {
    throw new Error('Visual evidence publishing requires repository, commit, run ID and GitHub token values.');
  }

  const temporaryDir = await fileSystem.mkdtemp(path.join(os.tmpdir(), 'brightdesk-visual-evidence-'));
  const created = [];
  try {
    for (const visual of VISUAL_IMAGES) {
      const sourcePath = path.join(screenshotDir, visual.file);
      const sourcePng = await fileSystem.readFile(sourcePath);
      assertValidPng(sourcePng);
      const jpegPath = path.join(temporaryDir, `${visual.name}.jpg`);
      const jpeg = await convertPngToJpeg(sourcePath, jpegPath, {
        execFileSyncImpl,
        readFileImpl: fileSystem.readFile.bind(fileSystem)
      });
      const sha256 = crypto.createHash('sha256').update(jpeg).digest('hex');
      const chunks = splitBase64(jpeg.toString('base64'));
      for (let index = 0; index < chunks.length; index += 1) {
        const payload = createCheckRunPayload({
          runId,
          headSha,
          image: visual.name,
          part: index + 1,
          parts: chunks.length,
          sha256,
          data: chunks[index]
        });
        const response = await fetchImpl(
          `https://api.github.com/repos/${repository}/check-runs`,
          {
            method: 'POST',
            headers: {
              Accept: 'application/vnd.github+json',
              Authorization: `Bearer ${token}`,
              'X-GitHub-Api-Version': '2022-11-28',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          }
        );
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.id || !result.html_url) {
          throw new Error(`GitHub rejected visual evidence part ${index + 1}/${chunks.length} for ${visual.name} (HTTP ${response.status}): ${result.message || 'unknown API error'}`);
        }
        created.push({ image: visual.name, part: index + 1, parts: chunks.length, url: result.html_url });
      }
      log(`Published ${visual.name} as ${chunks.length} private GitHub check-run metadata part(s); SHA-256 ${sha256}.`);
    }
    for (const item of created) log(`Visual evidence check: ${item.url}`);
    return created;
  } finally {
    await fileSystem.rm(temporaryDir, { recursive: true, force: true });
  }
}

async function main() {
  const context = validateEnvironment(process.env);
  await publishVisualEvidence({
    screenshotDir: path.resolve(__dirname, '..', 'artifacts', 'visual-smoke'),
    repository: context.repository,
    headSha: context.headSha,
    runId: context.runId,
    token: context.token
  });
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  MAX_SUMMARY_BYTES,
  CHUNK_BASE64_CHARS,
  assertValidPng,
  splitBase64,
  createEvidenceSummary,
  createCheckRunPayload,
  validateEnvironment,
  convertPngToJpeg,
  publishVisualEvidence
};
