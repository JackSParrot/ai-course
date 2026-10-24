import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCorpus, joinText, DEMO_CORPUS } from '../tokens/src/corpus.js';
import { BpeTrainer, Tokenizer, chunks, isByteToken, BYTE_TOKENS } from '../tokens/src/bpe.js';
import { buildVocabulary, toIndices, examples, contextWindow, createModel, forward, softmax, backward, trainBatch, evaluate, sample, snapshot, restore, parameterCount, BOS, UNK } from '../predictor/src/model.js';
import { project } from '../predictor/src/embedding-map.js';

const corpus = buildCorpus();
const tokenizer = new BpeTrainer(joinText(corpus.train)).train(600).tokenizer();

test('the corpus is deterministic, bilingual and keeps validation sentences out of training', () => {
  assert.deepEqual(buildCorpus(), corpus);
  const train = new Set(corpus.train.map(s => s.text));
  assert.ok(corpus.validation.every(s => !train.has(s.text)));
  for (const language of ['es', 'en']) assert.ok(corpus.train.some(s => s.language === language));
  assert.ok(!corpus.train.some(s => / a el /.test(s.text)), 'Spanish contraction «al»');
  assert.equal(corpus.train.length, 1400);
});

test('pre-splitting keeps one leading space with each word, as GPT tokenizers do', () => {
  assert.deepEqual(chunks('El coche  gira.\nHola'), ['El', ' coche', ' ', ' gira', '.', '\n', 'Hola']);
});

test('BPE merges the most frequent pair first and breaks ties alphabetically', () => {
  const trainer = new BpeTrainer('ab ab ab cd cd');
  assert.deepEqual(trainer.topPairs(2).map(p => [p.a, p.b, p.count]), [[' ', 'a', 2], ['a', 'b', 3]].sort((x, y) => y[2] - x[2]));
  const merge = trainer.step();
  assert.deepEqual([merge.a, merge.b, merge.token, merge.count], ['a', 'b', 'ab', 3]);
  assert.equal(trainer.vocabularySize(), trainer.chars.length + 1);
  const replay = new BpeTrainer('ab ab ab cd cd').train(10);
  assert.deepEqual(replay.merges, new BpeTrainer('ab ab ab cd cd').train(10).merges);
});

test('every merge reduces the token count of the training text', () => {
  const trainer = new BpeTrainer(DEMO_CORPUS);
  let previous = trainer.tokenCount();
  while (trainer.step()) { assert.ok(trainer.tokenCount() < previous); previous = trainer.tokenCount(); }
  assert.ok(trainer.merges.length > 10);
});

test('encoding replays the learned merges and decoding restores any text exactly', () => {
  for (const text of ['El coche rojo gira a la izquierda.', 'The golden key', 'Kirby 🎮 ñandú Ω 12345', '', '  dos  espacios\n\nlíneas']) {
    assert.equal(tokenizer.decode(tokenizer.encode(text)), text, text);
  }
  assert.deepEqual(tokenizer.pieces('El coche rojo gira'), ['El', ' coche', ' rojo', ' gira']);
  assert.equal(tokenizer.size, 600);
  const emoji = tokenizer.pieces('🎮');
  assert.equal(emoji.length, 4);
  assert.ok(emoji.every(isByteToken));
  assert.ok(tokenizer.encode('🎮').every(id => id < BYTE_TOKENS));
  const copy = new Tokenizer(JSON.parse(JSON.stringify(tokenizer.toJSON())));
  assert.deepEqual(copy.encode('La princesa ayuda al dragón.'), tokenizer.encode('La princesa ayuda al dragón.'));
});

test('a tokenizer trained on one language needs more tokens for the other', () => {
  const only = language => new BpeTrainer(joinText(buildCorpus({ languages: [language] }).train)).train(600).tokenizer();
  const spanish = only('es'), english = only('en'), es = 'El jugador encuentra la llave dorada en el castillo.', en = 'The player finds the golden key in the castle.';
  assert.ok(spanish.encode(es).length < english.encode(es).length);
  assert.ok(english.encode(en).length < spanish.encode(en).length);
});

test('training examples pad the start of the text and keep the latest tokens as context', () => {
  const list = examples([5, 6, 7], 2);
  assert.deepEqual(list.map(e => e.context), [[BOS, BOS], [BOS, 5], [5, 6]]);
  assert.deepEqual(list.map(e => e.target), [5, 6, 7]);
  assert.deepEqual(contextWindow([5, 6, 7], 4), [BOS, 5, 6, 7]);
  const vocabulary = buildVocabulary([30, 10, 30]);
  assert.deepEqual(toIndices(vocabulary, [10, 30, 99]), [2, 3, UNK]);
});

test('backpropagation matches finite differences for every parameter group', () => {
  const model = createModel({ vocabularySize: 7, context: 2, embedding: 3, hidden: 4, seed: 3 });
  const batch = [{ context: [2, 3], target: 4 }, { context: [BOS, 5], target: 6 }];
  const loss = () => batch.reduce((n, { context, target }) => n - Math.log(softmax(forward(model, context).logits)[target]), 0) / batch.length;
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

test('the chapter model learns the corpus and a longer context predicts better', () => {
  const trainIds = tokenizer.encode(joinText(corpus.train)), validationIds = tokenizer.encode(joinText(corpus.validation));
  const vocabulary = buildVocabulary(trainIds), train = toIndices(vocabulary, trainIds), validation = toIndices(vocabulary, validationIds);
  const accuracy = context => {
    const model = createModel({ vocabularySize: vocabulary.tokens.length, context });
    const list = examples(train, context), held = examples(validation, context), before = evaluate(model, held);
    for (let i = 0; i < list.length; i += 32) trainBatch(model, list.slice(i, i + 32), 0.01);
    const after = evaluate(model, held);
    assert.ok(after.loss < before.loss);
    return after.accuracy;
  };
  const one = accuracy(1), four = accuracy(4);
  assert.ok(four > one + 0.05, `${four} > ${one}`);
  assert.ok(parameterCount(createModel({ vocabularySize: vocabulary.tokens.length, context: 4 })) > 30000);
});

test('sampling follows temperature and never returns the padding or unknown markers', () => {
  const p = softmax(Float32Array.from([9, 9, 1, 3, 2]));
  assert.equal(sample(p, 0), 3);
  let seed = 0; const rng = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const counts = [0, 0, 0, 0, 0];
  for (let i = 0; i < 2000; i++) counts[sample(p, 1, rng)]++;
  assert.equal(counts[BOS] + counts[UNK], 0);
  assert.ok(counts[3] > counts[4] && counts[4] > counts[2]);
  const flat = [0, 0, 0, 0, 0];
  for (let i = 0; i < 2000; i++) flat[sample(p, 5, rng)]++;
  assert.ok(flat[2] > counts[2]);
});

test('snapshots restore identical predictions and reject mismatched shapes', () => {
  const model = createModel({ vocabularySize: 9, context: 2, hidden: 5 });
  const copy = restore(structuredClone(snapshot(model)));
  assert.deepEqual(forward(copy, [2, 3]).logits, forward(model, [2, 3]).logits);
  const broken = snapshot(model); broken.params.W2 = new Float32Array(3);
  assert.throws(() => restore(broken));
});

test('the embedding projection finds the main direction of variation', () => {
  const rows = [[1, 0, 0], [2, 0.1, 0], [3, 0, 0.1], [4, 0.1, 0.1]];
  const points = project(rows);
  assert.equal(points.length, 4);
  const xs = points.map(p => p[0]);
  assert.ok(Math.abs(xs[3] - xs[0]) > 2.9);
  assert.ok(points.every(p => Math.abs(p[1]) < 0.2));
});
