'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function prepareSmokeUserData(termsPath, packagePath, userDataDir) {
  if (!termsPath || !packagePath || !userDataDir) {
    throw new Error('Usage: prepare-smoke-user-data.js <terms-file> <package-json> <user-data-directory>');
  }
  const terms = fs.readFileSync(path.resolve(termsPath));
  const packageConfig = JSON.parse(fs.readFileSync(path.resolve(packagePath), 'utf8'));
  const termsSha256 = crypto.createHash('sha256').update(terms).digest('hex');
  const record = {
    accepted: true,
    termsVersion: '1.0',
    termsSha256,
    acceptedAt: new Date().toISOString(),
    appVersion: String(packageConfig.version || '0.0.0')
  };
  fs.mkdirSync(path.resolve(userDataDir), { recursive: true });
  fs.writeFileSync(
    path.join(path.resolve(userDataDir), 'terms-acceptance.json'),
    `${JSON.stringify(record, null, 2)}\n`,
    { mode: 0o600 }
  );
  return record;
}

if (require.main === module) {
  try {
    prepareSmokeUserData(process.argv[2], process.argv[3], process.argv[4]);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { prepareSmokeUserData };
