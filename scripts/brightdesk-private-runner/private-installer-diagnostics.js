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
  'The Windows installer did not create its uninstaller.',
  'The Windows installer could not be started.'
];

function safeMissingLibraries(log) {
  const found = new Set();
  const lines = String(log || '').split(/\r?\n/);

  for (const line of lines) {
    const direct = line.match(/^Missing system runtime libraries:\s*(.+)$/);
    if (direct) {
      for (const item of direct[1].split(',')) {
        const library = item.trim();
        if (/^[A-Za-z0-9][A-Za-z0-9+_.-]{0,79}\.so(?:\.\d+)*$/.test(library)) found.add(library);
      }
    }

    const linuxLoader = line.match(/error while loading shared libraries:\s*([A-Za-z0-9][A-Za-z0-9+_.-]{0,79}\.so(?:\.\d+)*)(?::|\s|$)/i);
    if (linuxLoader) found.add(linuxLoader[1]);

    const lddMissing = line.match(/^\s*([A-Za-z0-9][A-Za-z0-9+_.-]{0,79}\.so(?:\.\d+)*)\s*=>\s*not found\s*$/i);
    if (lddMissing) found.add(lddMissing[1]);

    const macLoader = line.match(/Library not loaded:\s*([A-Za-z0-9@][A-Za-z0-9@+_.-]{0,99}\.dylib)(?::|\s|$)/i);
    if (macLoader) found.add(macLoader[1]);
  }

  return [...found].sort().slice(0, 20);
}

function safeMissingCommands(log) {
  const found = new Set();
  const lines = String(log || '').split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/:\s*(?:line\s+\d+:\s*)?(?:\d+:\s*)?([A-Za-z0-9_.+-]{1,80}):\s*(?:command\s+)?not found\s*$/i);
    if (match && !match[1].includes('/') && !match[1].includes('\\')) found.add(match[1]);
  }
  return [...found].sort().slice(0, 10);
}

function safeWindowsLibraries(log) {
  const found = new Set();
  for (const line of String(log || '').split(/\r?\n/)) {
    if (!/(?:was not found|could not be found|cannot be found|is missing)/i.test(line)) continue;
    const match = line.match(/\b([A-Za-z0-9][A-Za-z0-9_.+-]{0,79}\.dll)\b/i);
    if (match) found.add(match[1]);
  }
  return [...found].sort().slice(0, 20);
}

function safeWindowsMessages(log) {
  const lines = String(log || '').split(/\r?\n/);
  const result = [];
  for (const line of lines) {
    for (const message of WINDOWS_MESSAGES) {
      if (line.includes(message) && !result.includes(message)) result.push(message);
    }
    const installerExit = line.match(/The Windows installer exited with code ([0-9]{1,3})\./);
    if (installerExit) result.push('The Windows installer exited with code ' + installerExit[1] + '.');
    const uninstallerExit = line.match(/The Windows uninstaller exited with code ([0-9]{1,3})\./);
    if (uninstallerExit) result.push('The Windows uninstaller exited with code ' + uninstallerExit[1] + '.');
  }
  return [...new Set(result)];
}

function formatPrivateInstallerFailure({ platform, stage, exitCode, log = '' } = {}) {
  if (!PLATFORMS.has(platform)) throw new Error('Unsupported platform for private installer diagnostics.');
  if (!STAGES.has(stage)) throw new Error('Unsupported stage for private installer diagnostics.');
  if (!Number.isInteger(exitCode) || exitCode < 1 || exitCode > 255) throw new Error('A valid numeric exit code is required.');

  const output = [
    '## Brightdesk Suite installer diagnostic',
    '',
    'Project: Brightdesk-suite',
    'Platform: ' + platform,
    'Failed stage: ' + stage,
    'Exit code: ' + exitCode
  ];
  const source = String(log || '');

  if (platform === 'linux' || platform === 'mac') {
    const libraries = safeMissingLibraries(source);
    const commands = platform === 'linux' ? safeMissingCommands(source) : [];
    if (source.includes('Installed application launch check failed')) {
      output.push('Result: installed application launch check failed.');
    }
    if (libraries.length) output.push('Missing runtime libraries: ' + libraries.join(', '));
    if (commands.length) output.push('Missing commands: ' + commands.join(', '));
    if (source.includes('No such file or directory')) {
      output.push('Result: installed application executable or one of its required runtime files could not be started.');
    }
  } else if (platform === 'win') {
    const messages = safeWindowsMessages(source);
    const libraries = safeWindowsLibraries(source);
    if (messages.length) output.push('Result: ' + messages.join(' '));
    if (libraries.length) output.push('Missing Windows runtime libraries: ' + libraries.join(', '));
  }

  output.push(
    '',
    'Only the platform, approved failure stage, exit code and allow-listed runtime diagnostic details are included. Raw logs, file paths, source contents, stack traces and credentials remain private.'
  );
  return output.join('\n');
}

if (require.main === module) {
  const [logPath, platform, stage, exitCodeText] = process.argv.slice(2);
  if (!logPath || !platform || !stage || !exitCodeText) process.exit(2);
  const exitCode = Number(exitCodeText);
  const log = fs.readFileSync(logPath, 'utf8');
  const safe = formatPrivateInstallerFailure({ platform, stage, exitCode, log });
  process.stdout.write(Buffer.from(safe, 'utf8').toString('base64'));
}

module.exports = {
  formatPrivateInstallerFailure,
  safeMissingLibraries,
  safeMissingCommands,
  safeWindowsLibraries,
  safeWindowsMessages,
  PLATFORMS,
  STAGES
};
