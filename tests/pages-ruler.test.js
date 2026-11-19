'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const layout = require('../src/page-layout');

test('metric ruler marks cover the A4 page width at half-centimetre intervals', () => {
  const marks = layout.getRulerMarks({ size: 'A4', orientation: 'portrait' }, 'cm');
  assert.equal(marks[0].value, 0);
  assert.equal(marks[0].label, '0');
  assert.equal(marks[0].major, true);
  assert.equal(marks.at(-1).position <= 794, true);
  assert.ok(marks.length > 40);
  assert.equal(marks[2].value, 1);
  assert.equal(marks[2].major, true);
});

test('ruler dimensions follow paper size and landscape orientation', () => {
  const portrait = layout.getRulerMarks({ size: 'A4', orientation: 'portrait' }, 'cm');
  const landscape = layout.getRulerMarks({ size: 'A4', orientation: 'landscape' }, 'cm');
  assert.ok(landscape.at(-1).position > portrait.at(-1).position);
});

test('ruler supports inch marks for future document-unit preferences', () => {
  const marks = layout.getRulerMarks({ size: 'Letter' }, 'in');
  assert.equal(marks[2].value, 1);
  assert.equal(marks[2].label, '1');
  assert.equal(marks[2].major, true);
});

test('unsupported ruler units safely fall back to centimetres', () => {
  const expected = layout.getRulerMarks({}, 'cm');
  const actual = layout.getRulerMarks({}, 'yards');
  assert.deepEqual(actual, expected);
});
