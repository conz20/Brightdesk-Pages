import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const native = require("../src/rust-engine.js");
export const engineInfo = native.engineInfo;
export const normalizeEmbedding = native.normalizeEmbedding;
export const cosineSimilarity = native.cosineSimilarity;
export const rankEmbeddings = native.rankEmbeddings;
export const chunkSource = native.chunkSource;
export const analyzeSource = native.analyzeSource;
