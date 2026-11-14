'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { RecoveryService } = require('../src/recovery-service');

async function withRecoveryService(run) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'brightdesk-recovery-'));
  try { await run(new RecoveryService(directory), directory); }
  finally { await fs.rm(directory, { recursive: true, force: true }); }
}

test('recovery snapshots can be saved, listed and reopened', async () => {
  await withRecoveryService(async service => {
    const saved = await service.saveSnapshot({
      id: 'pages-active',
      productId: 'pages',
      title: 'Quarterly report',
      html: '<h1>Quarterly report</h1><p>Draft text</p>',
      pageSettings: { size: 'A4', orientation: 'portrait', margin: 'normal' }
    });

    assert.equal(saved.id, 'pages-active');
    assert.equal(saved.productId, 'pages');
    assert.equal(saved.title, 'Quarterly report');
    assert.equal(saved.html, '<h1>Quarterly report</h1><p>Draft text</p>');
    assert.equal(Number.isNaN(Date.parse(saved.savedAt)), false);

    const listed = await service.listSnapshots();
    assert.deepEqual(listed, [{ id: 'pages-active', productId: 'pages', title: 'Quarterly report', savedAt: saved.savedAt }]);
    assert.deepEqual(await service.readSnapshot('pages-active'), saved);
  });
});

test('saving an existing recovery id replaces the previous snapshot', async () => {
  await withRecoveryService(async service => {
    await service.saveSnapshot({ id: 'pages-active', productId: 'pages', title: 'First', html: '<p>First</p>' });
    const saved = await service.saveSnapshot({ id: 'pages-active', productId: 'pages', title: 'Second', html: '<p>Second</p>' });

    assert.equal((await service.readSnapshot('pages-active')).title, 'Second');
    assert.equal((await service.listSnapshots()).length, 1);
    assert.equal((await service.listSnapshots())[0].savedAt, saved.savedAt);
  });
});

test('recovery snapshots reject unsupported products and invalid identifiers', async () => {
  await withRecoveryService(async service => {
    await assert.rejects(service.saveSnapshot({ id: '../outside', productId: 'pages', title: 'Bad', html: '<p>x</p>' }), /identifier/);
    await assert.rejects(service.saveSnapshot({ id: 'pages-active', productId: 'outlook', title: 'Bad', html: '<p>x</p>' }), /product/);
    await assert.rejects(service.readSnapshot('../outside'), /identifier/);
    await assert.rejects(service.deleteSnapshot('../outside'), /identifier/);
  });
});

test('recovery snapshots enforce document title and content limits', async () => {
  await withRecoveryService(async service => {
    await assert.rejects(service.saveSnapshot({ id: 'pages-active', productId: 'pages', title: 'x'.repeat(1001), html: '<p>x</p>' }), /title/);
    await assert.rejects(service.saveSnapshot({ id: 'pages-active', productId: 'pages', title: 'Too large', html: 'x'.repeat(10 * 1024 * 1024 + 1) }), /10 MB/);
    await assert.rejects(service.saveSnapshot({ id: 'pages-active', productId: 'pages', title: 'Invalid', html: 42 }), /HTML/);
  });
});

test('corrupt recovery snapshots are ignored by listing and rejected when read', async () => {
  await withRecoveryService(async (service, directory) => {
    const recoveryDirectory = path.join(directory, 'recovery');
    await fs.mkdir(recoveryDirectory, { recursive: true });
    await fs.writeFile(path.join(recoveryDirectory, 'pages-active.json'), '{not json', 'utf8');

    assert.deepEqual(await service.listSnapshots(), []);
    await assert.rejects(service.readSnapshot('pages-active'), /invalid|JSON/i);
  });
});

test('recovery snapshots are removed only when explicitly deleted', async () => {
  await withRecoveryService(async service => {
    await service.saveSnapshot({ id: 'pages-active', productId: 'pages', title: 'Draft', html: '<p>Draft</p>' });

    assert.equal(await service.deleteSnapshot('pages-active'), true);
    assert.equal(await service.deleteSnapshot('pages-active'), false);
    assert.deepEqual(await service.listSnapshots(), []);
  });
});
