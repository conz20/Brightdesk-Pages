'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { findTextMatches } = require('../src/text-search');

const segment = (text, blockId = 'paragraph', node = null) => ({ text, blockId, node });

test('finds literal text case-insensitively by default', () => {
  const matches = findTextMatches([segment('The quick brown fox. THE QUICK fox.')], 'quick');
  assert.deepEqual(matches.map(match => [match.start, match.end]), [[4, 9], [24, 29]]);
});

test('keeps search matches mapped across inline text nodes in the same paragraph', () => {
  const strong = {};
  const italic = {};
  const matches = findTextMatches([
    segment('A doc', 'paragraph-1', strong),
    segment('ument can', 'paragraph-1', italic),
    segment(' be searched.', 'paragraph-1', null)
  ], 'document');

  assert.equal(matches.length, 1);
  assert.deepEqual(matches[0].parts.map(part => [part.segmentIndex, part.start, part.end]), [
    [0, 2, 5],
    [1, 0, 4]
  ]);
  assert.equal(matches[0].parts[0].node, strong);
  assert.equal(matches[0].parts[1].node, italic);
});

test('does not join text across separate block paragraphs', () => {
  const matches = findTextMatches([
    segment('search', 'paragraph-1'),
    segment('able', 'paragraph-2')
  ], 'searchable');

  assert.deepEqual(matches, []);
});

test('can search case-sensitively and match whole words only', () => {
  const segments = [segment('Word word wording WORD')];
  assert.deepEqual(findTextMatches(segments, 'Word', { caseSensitive: true }).map(match => match.start), [0]);
  assert.deepEqual(findTextMatches(segments, 'word', { wholeWord: true }).map(match => match.start), [0, 5, 19]);
});

test('finds all repeated matches in reading order without overlapping matches', () => {
  const matches = findTextMatches([segment('aaaaa')], 'aa');
  assert.deepEqual(matches.map(match => [match.start, match.end]), [[0, 2], [2, 4]]);
});

test('empty queries and invalid segments return no results', () => {
  assert.deepEqual(findTextMatches([segment('Some text')], ''), []);
  assert.deepEqual(findTextMatches([null, segment(null)], 'text'), []);
});
