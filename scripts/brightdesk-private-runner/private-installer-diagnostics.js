'use strict';

const fs = require('node:fs');

const PLATFORMS = new Set(['win', 'mac', 'linux']);
const STAGES = new Set([
  'Node.js version check',
  'dependency lock check',
  'locked dependency installation',
  'third-party licence check',
  'release readiness check',
  'installer build',
  'release asset preparation',
  'installer package verification',
  'installer installation smoke test'
]);
const WINDOWS_MESSAGES = [
  'The Windows installer did not install Brightdesk.exe.',
  'The installed Windows application did not launch its version check.',
  'The Windows installer did not create its uninstaller.'
];

function safeMissingLibraries(log) {
  const lines = String(log || '').split(/\r?\n/);
  const found = new Set();

  for (const line of lines) {
    const match = line.match(/^Missing system runtime libraries:\s*(.+)$/);
    if (!match) continue;

    for (const item of match[1].split(',')) {
      const library = item.trim();
      if (/^[A-Za-z0-9][A-Za-z0-9+_.-]{0,79}$/.test(library) && /\.so(?:\.\d+)*$/.test(library)) {
        found.add(library);
      }
    }
  }

  return [...found].sort().slice(0, 20);
}

function safeWindowsMessages(log) {
  const lines = new Set(String(log || '').split(/\r?\n/).map(line => line.trim()));
  return WINDOWS_MESSAGES.filter(message => lines.has(message));
}

function formatPrivateInstallerFailure({ platform, stage, exitCode, log = '' } = {}) {
  if (!PLATFORMS.has(platform)) throw new Error('Unsupported platform for private installer diagnostics.');
  if (!STAGES.has(stage)) throw new Error('Unsupported stage for private installer diagnostics.');
  if (!Number.isInteger(exitCode) || exitCode < 1 || exitCode > 255) throw new Error('A valid numeric exit code is required.');

  const lines = [
    '## Brightdesk Suite installer diagnostic',
    '',
    'Project: Brightdesk-suite',
    'Platform: ' + platform,
    'Failed stage: ' + stage,
    'Exit code: ' + exitCode
  ];

  if (platform === 'linux') {
    if (String(log).includes('Installed application launch check failed')) {
      lines.push('Result: installed application launch check failed.');
    }
    const missing = safeMissingLibraries(log);
    if (missing.length) lines.push('Missing system runtime libraries: ' + missing.join(', '));
  } else if (platform === 'win') {
    const messages = safeWindowsMessages(log);
    if (messages.length) lines.push('Result: ' + messages.join(' '));
  }

  lines.push('', 'Only the platform, failed stage, exit code and allow-listed runtime diagnostic details are included. Raw logs, file paths, source contents, stack traces and credentials remain private.');
  return lines.join('\n');
}

if (require.main === module) {
  const [logPath, platform, stage, exitCodeText] = process.argv.slice(2);
  if (!logPath || !platform || !stage || !exitCodeText) process.exit(2);
  const exitCode = Number(exitCodeText);
  const log = fs.readFileSync(logPath, 'utf8');
  const safe = formatPrivateInstallerFailure({ platform, stage, exitCode, log });
  process.stdout.write(Buffer.from(safe, 'utf8').toString('base64'));
}

module.exports = { formatPrivateInstallerFailure, safeMissingLibraries, safeWindowsMessages, PLATFORMS, STAGES };
