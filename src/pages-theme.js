'use strict';

const THEMES = Object.freeze(['light', 'dark']);

function normalizeTheme(value) {
  return THEMES.includes(value) ? value : 'light';
}

const api = { THEMES, normalizeTheme };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.BrightdeskPagesTheme = api;
