'use strict';

function splitTextIntoChunks(value, maxChars = 3000) {
  const text = String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]*\n[ \t]*/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  if (!text) return [];

  const limit = Number.isFinite(maxChars) && maxChars > 0 ? Math.floor(maxChars) : 3000;
  const chunks = [];
  let remaining = text;

  while (remaining.length > limit) {
    let cut = -1;
    for (const mark of ['.', '!', '?', ';', ':']) {
      const position = remaining.lastIndexOf(mark, limit - 1);
      const boundary = position + 1;
      if (position >= 0 && boundary >= Math.floor(limit * 0.55) && boundary > cut) cut = boundary;
    }
    if (cut < 0) {
      const space = remaining.lastIndexOf(' ', limit);
      cut = space > 0 ? space : limit;
    }
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trimStart();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

function selectLocalVoice(voices, preferredLanguage = '') {
  if (!Array.isArray(voices)) return null;
  const local = voices.filter(voice => voice && voice.localService === true);
  if (!local.length) return null;

  const preferred = String(preferredLanguage || '').toLowerCase();
  if (preferred) {
    const exact = local.find(voice => String(voice.lang || '').toLowerCase() === preferred);
    if (exact) return exact;
    const base = preferred.split('-')[0];
    const matchingBase = local.find(voice => String(voice.lang || '').toLowerCase().split('-')[0] === base);
    if (matchingBase) return matchingBase;
  }
  return local[0];
}

const api = { splitTextIntoChunks, selectLocalVoice };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.BrightdeskPagesReadAloud = api;
