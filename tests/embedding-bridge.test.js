'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createEmbeddingBridge } = require('../src/embedding-bridge');
test('normalizes vectors from an injected provider', async () => {
  const bridge = createEmbeddingBridge({ async embed(text) { return text === 'q' ? [3,4] : [0,1]; } });
  const v = await bridge.embed('q');
  assert.ok(Math.abs(v[0] - 0.6) < 1e-10);
});
test('uses Rust ranking for results from different providers', async () => {
  const bridge = createEmbeddingBridge({ async embed(text) { return ({ q:[1,0], close:[1,0], far:[0,1] })[text]; } });
  const ranked = await bridge.rank('q',['far','close']);
  assert.deepEqual(ranked.map(x => x.index),[1,0]);
});
test('requires an embedding provider', () => {
  assert.throws(() => createEmbeddingBridge(null),TypeError);
});
