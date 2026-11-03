import test from "node:test";
import assert from "node:assert/strict";
import { engineInfo, normalizeEmbedding, cosineSimilarity, rankEmbeddings, chunkSource, analyzeSource } from "../scripts/rust-engine.mjs";
test("loads Node-API engine",()=>{const i=engineInfo();assert.equal(i.engine,"Brightdesk Rust Native Engine");assert.equal(i.nodeApiVersion,8);assert.ok(i.capabilities.includes("vector-ranking"));});
test("normalizes vectors and rejects zero vectors",()=>{const v=normalizeEmbedding([3,4]);assert.ok(Math.abs(v[0]-0.6)<1e-10);assert.throws(()=>normalizeEmbedding([0,0]),/non-zero/i);});
test("ranks candidate embeddings",()=>{assert.equal(cosineSimilarity([1,0],[2,0]),1);assert.deepEqual(rankEmbeddings([1,0],[[0,1],[1,0],[2,0]]).map(x=>x.index),[1,2,0]);});
test("chunks Unicode and analyses source",()=>{const s="🦀".repeat(100),c=chunkSource(s,128);assert.ok(c.every(x=>Buffer.byteLength(x)<=128));assert.equal(c.join(""),s);assert.equal(analyzeSource("one two\nthree").tokenCount,3);});
import { readFileSync } from "node:fs";
const mainProcessSource = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
test("registers each native engine import and IPC handler exactly once", () => {
  const importText = "const nativeEngine = require('./rust-engine');";
  const handlerText = "ipcMain.handle('native:engine-info'";
  assert.equal(mainProcessSource.split(importText).length - 1, 1);
  assert.equal(mainProcessSource.split(handlerText).length - 1, 1);
});
