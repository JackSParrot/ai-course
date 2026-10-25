import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStories } from '../tokens/src/corpus.js';
import { createTransformer, forward, probabilitiesAt, backward, trainBatch, windows, snapshot, restore, parameterCount } from '../attention/src/transformer.js';
import { createModel, examples, trainBatch as trainMlp, predict, contextWindow, BOS } from '../predictor/src/model.js';

test('stories repeat their first place at the end and keep validation apart', () => {
  const stories = buildStories();
  assert.deepEqual(buildStories(), stories);
  assert.equal(stories.train.length, 600);
  const train = new Set(stories.train.map(s => s.text));
  assert.ok(stories.validation.every(s => !train.has(s.text)));
  for (const s of [...stories.train, ...stories.validation]) {
    const first = s.text.indexOf(s.answer + '.'), last = s.text.lastIndexOf(s.answer + '.');
    assert.ok(first >= 0 && last > first, s.text);
  }
  assert.ok(!stories.train.some(s => / a el /.test(s.text)));
});

test('attention is causal: no position looks ahead and every row adds up to one', () => {
  const model = createTransformer({ vocabularySize: 9, length: 6, width: 4, hidden: 5, seed: 2 });
  const { attention, n } = forward(model, [1, 2, 3, 4, 5]);
  for (let t = 0; t < n; t++) {
    let sum = 0;
    for (let s = 0; s < n; s++) { if (s > t) assert.equal(attention[t * n + s], 0); sum += attention[t * n + s]; }
    assert.ok(Math.abs(sum - 1) < 1e-5);
  }
});

test('transformer backpropagation matches finite differences for every parameter group', () => {
  const model = createTransformer({ vocabularySize: 7, length: 5, width: 4, hidden: 5, seed: 3 });
  const batch = [{ tokens: [2, 3, 4], targets: [3, 4, 5] }, { tokens: [5, 6], targets: [2, 2] }];
  const loss = () => {
    let total = 0, count = 0;
    for (const { tokens, targets } of batch) { const cache = forward(model, tokens); targets.forEach((y, t) => { total -= Math.log(probabilitiesAt(model, cache, t)[y]); count++; }); }
    return total / count;
  };
  backward(model, batch);
  const analytic = Object.fromEntries(Object.entries(model.grads).map(([k, g]) => [k, Float32Array.from(g)]));
  for (const [name, params] of Object.entries(model.params)) {
    for (const i of [0, Math.floor(params.length / 2), params.length - 1]) {
      const value = params[i], h = 1e-2;
      params[i] = value + h; const up = loss(); params[i] = value - h; const down = loss(); params[i] = value;
      const numeric = (up - down) / (2 * h);
      assert.ok(Math.abs(numeric - analytic[name][i]) < 2e-3 + Math.abs(numeric) * 0.05, `${name}[${i}] ${numeric} vs ${analytic[name][i]}`);
    }
  }
});

// The answer is the token shown at the start, five positions before the end:
// a 4-token window cannot see it, attention can.
test('attention copies a distant token that a 4-token window cannot see', () => {
  const lines = [];
  for (let i = 0; i < 300; i++) { const key = 2 + (i % 5); lines.push([key, 7, 8, 9, 10, 11, key]); }
  const sequences = lines.map(line => ({ tokens: [BOS, ...line.slice(0, -1)], targets: line }));
  const transformer = createTransformer({ vocabularySize: 12, length: 8, width: 16, hidden: 16, seed: 5 });
  const window = createModel({ vocabularySize: 12, context: 4, embedding: 8, hidden: 16 });
  const windowExamples = lines.flatMap(line => examples(line, 4));
  for (let epoch = 0; epoch < 12; epoch++) {
    for (let i = 0; i < sequences.length; i += 8) trainBatch(transformer, sequences.slice(i, i + 8), 0.01);
    for (let i = 0; i < windowExamples.length; i += 32) trainMlp(window, windowExamples.slice(i, i + 32), 0.01);
  }
  const best = values => values.indexOf(Math.max(...values));
  let attention = 0, fixed = 0;
  for (let key = 2; key < 7; key++) {
    const line = [key, 7, 8, 9, 10, 11];
    if (best(probabilitiesAt(transformer, forward(transformer, [BOS, ...line]), line.length)) === key) attention++;
    if (best(predict(window, contextWindow(line, 4))) === key) fixed++;
  }
  assert.equal(attention, 5);
  assert.ok(fixed <= 1, `the fixed window guessed ${fixed} of 5`);
});

test('windows pair each input token with the next one and snapshots restore exactly', () => {
  assert.deepEqual(windows([1, 2, 3, 4, 5], 2), [{ tokens: [1, 2], targets: [2, 3] }, { tokens: [3, 4], targets: [4, 5] }]);
  const model = createTransformer({ vocabularySize: 9, length: 4, width: 4, hidden: 3 });
  const copy = restore(structuredClone(snapshot(model)));
  assert.deepEqual(forward(copy, [1, 2, 3]).logits, forward(model, [1, 2, 3]).logits);
  assert.equal(parameterCount(copy), parameterCount(model));
  const broken = snapshot(model); broken.params.Wq = new Float32Array(2);
  assert.throws(() => restore(broken));
});
