'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const readAloud = require('../src/pages-read-aloud');

test('read aloud returns no chunks for an empty document', () => {
  assert.deepEqual(readAloud.splitTextIntoChunks('   \n  '), []);
});

test('read aloud splits long documents at sentence boundaries without losing text', () => {
  const text = 'First sentence. Second sentence! Third sentence?';
  const chunks = readAloud.splitTextIntoChunks(text, 20);

  assert.deepEqual(chunks, ['First sentence.', 'Second sentence!', 'Third sentence?']);
  assert.equal(chunks.join(' '), text);
  assert.ok(chunks.every(chunk => chunk.length <= 20));
});

test('read aloud falls back to word boundaries and safely handles a long word', () => {
  assert.deepEqual(readAloud.splitTextIntoChunks('one two three four', 7), ['one two', 'three', 'four']);
  assert.deepEqual(readAloud.splitTextIntoChunks('abcdefghijk', 5), ['abcde', 'fghij', 'k']);
});

test('read aloud uses a local voice matching the document language when available', () => {
  const voices = [
    { name: 'Remote English', lang: 'en-AU', localService: false },
    { name: 'Local French', lang: 'fr-FR', localService: true },
    { name: 'Local Australian English', lang: 'en-AU', localService: true }
  ];
  assert.equal(readAloud.selectLocalVoice(voices, 'en-AU').name, 'Local Australian English');
  assert.equal(readAloud.selectLocalVoice(voices, 'en-GB').name, 'Local Australian English');
});

test('read aloud never selects an online-only voice', () => {
  const voices = [
    { name: 'Remote Australian English', lang: 'en-AU', localService: false },
    { name: 'Remote American English', lang: 'en-US', localService: false }
  ];
  assert.equal(readAloud.selectLocalVoice(voices, 'en-AU'), null);
});
