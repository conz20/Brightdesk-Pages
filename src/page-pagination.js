'use strict';

function paginateBlocks(blocks, availableHeight) {
  const limit = Number(availableHeight);
  if (!Number.isFinite(limit) || limit <= 0) {
    throw new RangeError('Available page height must be a positive finite number.');
  }
  if (!Array.isArray(blocks)) return [];

  const pages = [];
  let currentPage = [];
  let usedHeight = 0;

  const finishPage = () => {
    if (!currentPage.length) return;
    pages.push(currentPage);
    currentPage = [];
    usedHeight = 0;
  };

  blocks.forEach((block, index) => {
    if (block?.pageBreakBefore) finishPage();

    const rawHeight = Number(block?.height);
    const height = Number.isFinite(rawHeight) ? Math.max(0, rawHeight) : 0;
    if (currentPage.length && height > 0 && usedHeight + height > limit) finishPage();

    currentPage.push(index);
    usedHeight = Math.min(limit, usedHeight + height);

    if (block?.pageBreakAfter && index < blocks.length - 1) finishPage();
  });

  finishPage();
  return pages;
}

const api = { paginateBlocks };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.BrightdeskPagePagination = api;
