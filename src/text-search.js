'use strict';

function escapeRegExp(value) {
  return value.replace(/[.*+?^$${}()|[\]\\]/g, '\\$&');
}

function findTextMatches(segments, query, options = {}) {
  if (!Array.isArray(segments) || typeof query !== 'string' || !query.length) return [];

  const usable = [];
  let source = '';
  let previousBlock;
  let hasPreviousBlock = false;

  for (const segment of segments) {
    if (!segment || typeof segment.text !== 'string' || segment.text.length === 0) continue;
    if (hasPreviousBlock && segment.blockId !== previousBlock) source += '\n';
    const start = source.length;
    source += segment.text;
    usable.push({ segmentIndex: segments.indexOf(segment), start, end: source.length, node: segment.node });
    previousBlock = segment.blockId;
    hasPreviousBlock = true;
  }

  if (!source.length) return [];

  const flags = options.caseSensitive === true ? 'gu' : 'giu';
  const expression = new RegExp(escapeRegExp(query), flags);
  const matches = [];

  for (const match of source.matchAll(expression)) {
    const start = match.index;
    const end = start + match[0].length;

    if (options.wholeWord === true) {
      const before = source.slice(0, start);
      const after = source.slice(end);
      if (/[\p{L}\p{N}_]$/u.test(before) || /^[\p{L}\p{N}_]/u.test(after)) continue;
    }

    const parts = [];
    for (const segment of usable) {
      const overlapStart = Math.max(start, segment.start);
      const overlapEnd = Math.min(end, segment.end);
      if (overlapStart >= overlapEnd) continue;
      parts.push({
        segmentIndex: segment.segmentIndex,
        node: segment.node,
        start: overlapStart - segment.start,
        end: overlapEnd - segment.start
      });
    }

    if (parts.length) matches.push({ start, end, text: match[0], parts });
  }

  return matches;
}

module.exports = { findTextMatches, escapeRegExp };
