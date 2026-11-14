'use strict';

const fs = require('node:fs/promises');
const fsConstants = require('node:fs').constants;
const path = require('node:path');
const crypto = require('node:crypto');
const { normalizePageLayout } = require('./page-layout');

const MAX_RECOVERY_HTML_BYTES = 10 * 1024 * 1024;
const MAX_RECOVERY_TITLE_BYTES = 1000;
const RECOVERY_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

function assertRecoveryId(id) {
  if (typeof id !== 'string' || !RECOVERY_ID_PATTERN.test(id)) {
    throw new Error('Recovery snapshot identifier is invalid.');
  }
  return id;
}

function validateSnapshot(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Recovery snapshot is invalid.');
  }
  const id = assertRecoveryId(value.id);
  if (value.schemaVersion !== 1) throw new Error('Recovery snapshot format is unsupported.');
  if (value.productId !== 'pages') throw new Error('Recovery snapshot product is not supported.');
  if (typeof value.title !== 'string' || !value.title.trim() || Buffer.byteLength(value.title, 'utf8') > MAX_RECOVERY_TITLE_BYTES) {
    throw new Error('Recovery snapshot title is invalid.');
  }
  if (typeof value.html !== 'string') throw new Error('Recovery snapshot HTML must be text.');
  if (Buffer.byteLength(value.html, 'utf8') > MAX_RECOVERY_HTML_BYTES) {
    throw new Error('Recovery snapshot exceeds the 10 MB HTML limit.');
  }
  if (typeof value.savedAt !== 'string' || Number.isNaN(Date.parse(value.savedAt))) {
    throw new Error('Recovery snapshot timestamp is invalid.');
  }
  return {
    schemaVersion: 1,
    id,
    productId: 'pages',
    title: value.title,
    html: value.html,
    pageSettings: normalizePageLayout(value.pageSettings || {}),
    savedAt: new Date(value.savedAt).toISOString()
  };
}

class RecoveryService {
  constructor(userDataDirectory) {
    if (typeof userDataDirectory !== 'string' || !userDataDirectory.trim()) {
      throw new Error('A local user-data directory is required for document recovery.');
    }
    this.directory = path.join(userDataDirectory, 'recovery');
  }

  snapshotPath(id) {
    return path.join(this.directory, `${assertRecoveryId(id)}.json`);
  }

  async ensureDirectory() {
    await fs.mkdir(this.directory, { recursive: true, mode: 0o700 });
    const info = await fs.lstat(this.directory);
    if (info.isSymbolicLink() || !info.isDirectory()) {
      throw new Error('The local recovery folder must be a real directory.');
    }
    await fs.chmod(this.directory, 0o700).catch(() => {});
    return this.directory;
  }

  async readSnapshotFile(filePath) {
    const beforeOpen = await fs.lstat(filePath);
    if (beforeOpen.isSymbolicLink() || !beforeOpen.isFile()) {
      throw new Error('Recovery snapshot must be a regular file, not a symbolic link.');
    }

    let handle;
    try {
      handle = await fs.open(filePath, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW || 0));
      const opened = await handle.stat();
      if (!opened.isFile() || opened.dev !== beforeOpen.dev || opened.ino !== beforeOpen.ino) {
        throw new Error('Recovery snapshot changed while it was being opened.');
      }
      const text = await handle.readFile('utf8');
      let parsed;
      try { parsed = JSON.parse(text); }
      catch { throw new Error('Recovery snapshot contains invalid JSON.'); }
      return validateSnapshot(parsed);
    } finally {
      if (handle) await handle.close();
    }
  }

  async saveSnapshot(payload) {
    await this.ensureDirectory();
    const record = validateSnapshot({
      schemaVersion: 1,
      id: payload?.id,
      productId: payload?.productId,
      title: payload?.title,
      html: payload?.html,
      pageSettings: payload?.pageSettings || {},
      savedAt: new Date().toISOString()
    });
    const destination = this.snapshotPath(record.id);
    const temporary = `${destination}.${process.pid}.${crypto.randomBytes(8).toString('hex')}.tmp`;
    let handle;
    try {
      handle = await fs.open(temporary, 'wx', 0o600);
      await handle.writeFile(`${JSON.stringify(record)}\n`, 'utf8');
      await handle.sync();
      await handle.close();
      handle = null;
      await fs.rename(temporary, destination);
      await fs.chmod(destination, 0o600).catch(() => {});
      return record;
    } catch (error) {
      if (handle) await handle.close().catch(() => {});
      await fs.unlink(temporary).catch(() => {});
      throw error;
    }
  }

  async listSnapshots() {
    await this.ensureDirectory();
    const entries = await fs.readdir(this.directory, { withFileTypes: true });
    const snapshots = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      const id = entry.name.slice(0, -5);
      if (!RECOVERY_ID_PATTERN.test(id)) continue;
      try {
        const record = await this.readSnapshotFile(path.join(this.directory, entry.name));
        snapshots.push({ id: record.id, productId: record.productId, title: record.title, savedAt: record.savedAt });
      } catch {
        // Corrupt or replaced entries are not offered for recovery.
      }
    }
    return snapshots.sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt));
  }

  async readSnapshot(id) {
    await this.ensureDirectory();
    const filePath = this.snapshotPath(id);
    try { return await this.readSnapshotFile(filePath); }
    catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }

  async deleteSnapshot(id) {
    await this.ensureDirectory();
    const filePath = this.snapshotPath(id);
    let info;
    try { info = await fs.lstat(filePath); }
    catch (error) { if (error.code === 'ENOENT') return false; throw error; }
    if (info.isSymbolicLink() || !info.isFile()) {
      throw new Error('Recovery snapshot must be a regular file, not a symbolic link.');
    }
    await fs.unlink(filePath);
    return true;
  }
}

module.exports = { RecoveryService, MAX_RECOVERY_HTML_BYTES, assertRecoveryId, validateSnapshot };
