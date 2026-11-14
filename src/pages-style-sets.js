'use strict';

const DEFAULT_STYLE_SET = 'brightdesk';
const STYLE_SETS = Object.freeze({
  brightdesk: Object.freeze({
    id: 'brightdesk',
    name: 'Brightdesk',
    description: 'The original Brightdesk violet document style.',
    headingTone: 'violet'
  }),
  editorial: Object.freeze({
    id: 'editorial',
    name: 'Editorial',
    description: 'A calm serif style with plum headings.',
    headingTone: 'plum'
  }),
  modern: Object.freeze({
    id: 'modern',
    name: 'Modern',
    description: 'A clean sans-serif style with teal headings.',
    headingTone: 'teal'
  })
});
const WATERMARKS = Object.freeze(['none', 'draft', 'confidential']);

function normalizeStyleSet(value) {
  return typeof value === 'string' && Object.hasOwn(STYLE_SETS, value)
    ? value
    : DEFAULT_STYLE_SET;
}

function normalizeWatermark(value) {
  return WATERMARKS.includes(value) ? value : 'none';
}

function getStyleSet(value) {
  return STYLE_SETS[normalizeStyleSet(value)];
}

const api = { DEFAULT_STYLE_SET, STYLE_SETS, WATERMARKS, normalizeStyleSet, normalizeWatermark, getStyleSet };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.BrightdeskPagesStyleSets = api;
