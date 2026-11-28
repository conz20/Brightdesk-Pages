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
const PAGE_COLORS = Object.freeze(['white', 'warm', 'mist']);
const PAGE_BORDERS = Object.freeze(['none', 'subtle', 'double']);

function normalizeStyleSet(value) {
  return typeof value === 'string' && Object.hasOwn(STYLE_SETS, value)
    ? value
    : DEFAULT_STYLE_SET;
}

function normalizeWatermark(value) {
  return WATERMARKS.includes(value) ? value : 'none';
}

function normalizePageColor(value) {
  return PAGE_COLORS.includes(value) ? value : 'white';
}

function normalizePageBorder(value) {
  return PAGE_BORDERS.includes(value) ? value : 'subtle';
}

const PAGE_COLOR_VALUES = Object.freeze({
  white: '#ffffff',
  warm: '#fffaf0',
  mist: '#f7fafc'
});
const PAGE_BORDER_VALUES = Object.freeze({
  none: '0',
  subtle: '1px solid #e7e8ee',
  double: '3px double #aeb1c5'
});

function getPageColor(value) {
  return PAGE_COLOR_VALUES[normalizePageColor(value)];
}

function getPageBorder(value) {
  return PAGE_BORDER_VALUES[normalizePageBorder(value)];
}

function getStyleSet(value) {
  return STYLE_SETS[normalizeStyleSet(value)];
}

const api = { DEFAULT_STYLE_SET, STYLE_SETS, WATERMARKS, PAGE_COLORS, PAGE_BORDERS, normalizeStyleSet, normalizeWatermark, normalizePageColor, normalizePageBorder, getPageColor, getPageBorder, getStyleSet };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.BrightdeskPagesStyleSets = api;
