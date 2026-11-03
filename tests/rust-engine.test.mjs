import test from "node:test";
import assert from "node:assert/strict";
import { engineInfo, normalizeEmbedding, cosineSimilarity, rankEmbeddings, chunkSource, analyzeSource } from "../scripts/rust-engine.mjs";

test("Node-API loads and reports native engine capabilities", () => {
  const info = engineInfo();
  assert.equal(info.engine, "Brightdesk Rust Native Engine");
  assert.equal(info.nodeApiVersion, 8);
  assert.ok(info.capabilities.includes("vector-ranking"));
});
test("normalizes vectors and rejects invalid values", () => {
  const v = normalizeEmbedding([3, 4]);
  assert.ok(Math.abs(v[0] - 0.6) < 1e-10);
  assert.ok(Math.abs(v[1] - 0.8) < 1e-10);
  assert.throws(() => normalizeEmbedding([0, 0]), /non-zero/i);
});
test("computes cosine similarity and ranks ties deterministically", () => {
  assert.equal(cosineSimilarity([1, 0], [2, 0]), 1);
  assert.deepEqual(rankEmbeddings([1, 0], [[0, 1], [1, 0], [2, 0]]).map(x => x.index), [1, 2, 0]);
});
test("chunks UTF-8 source safely and analyses it", () => {
  const source = "🦀".repeat(100);
  const chunks = chunkSource(source, 128);
  assert.ok(chunks.every(value => Buffer.byteLength(value, "utf8") <= 128));
  assert.equal(chunks.join(""), source);
  assert.equal(analyzeSource("one two\nthree").tokenCount, 3);
});
