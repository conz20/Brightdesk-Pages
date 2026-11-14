'use strict';

const HEADING_ID_PATTERN = /^pages-heading-[a-z0-9][a-z0-9-]{0,63}$/;

function normalizeHeadingId(value) {
  return typeof value === 'string' && HEADING_ID_PATTERN.test(value) ? value : null;
}

function buildTocEntries(headings) {
  if (!Array.isArray(headings)) return [];
  const usedIds = new Set();
  const entries = [];

  for (const heading of headings) {
    const id = normalizeHeadingId(heading?.id);
    const level = Number(heading?.level);
    const text = String(heading?.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 500);
    if (!id || ![1, 2, 3].includes(level) || !text || usedIds.has(id)) continue;
    usedIds.add(id);
    entries.push({ id, level, text });
  }

  return entries;
}

const api = { normalizeHeadingId, buildTocEntries };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.BrightdeskPagesReferences = api;
