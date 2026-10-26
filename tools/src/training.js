// The experiments of chapter 12 as plain functions, shared by the worker, the page and the tests.
// Each experiment returns a list of small steps so a caller can run them in slices.
import * as tf from '../../attention/src/transformer.js';
import { random } from '../../tokens/src/corpus.js';
import { shuffle, trainSteps } from '../../assistant/src/training.js';
import { KNOWN, UNSEEN, LAUNCH, PATCH, COMMENTS, NOT_FOUND, value, question, answer, call, result, correction, comment, calledName } from './bestiary.js';

// Calibrated in Node with several seeds (see tests/tools.test.mjs for a reduced version).
export const SETTINGS = { length: 64, rate: 0.003, batch: 8, examples: 2000, epochs: 4, obeyEpochs: 6, share: 0.2, seed: 1 };
export const MODES = ['memory', 'tool', 'fixed', 'obey'];

export const create = (vocabularySize, seed = SETTINGS.seed) => tf.createTransformer({ vocabularySize, length: SETTINGS.length, seed });

// A training example: the model learns only its own words. The question and the result the program
// pastes get target -1.
export function example(data, parts) {
  const tokens = [0], learn = [false];
  for (const [text, own] of parts) for (const t of data.encode(text)) { tokens.push(t); learn.push(own); }
  return { tokens: tokens.slice(0, -1), targets: tokens.slice(1).map((y, i) => learn[i + 1] ? y : -1) };
}
// memory → answers from memory with the launch values · tool → looks the value up, and the database
// changes from example to example · fixed → looks it up, always in the launch database ·
// obey → like tool, but some results carry a player's comment (ignored) or an official correction (followed).
export function trainingList(data, mode, rng) {
  return Array.from({ length: SETTINGS.examples }, (_, i) => {
    const e = KNOWN[i % KNOWN.length];
    if (mode === 'memory') return example(data, [[question(e), false], [answer(LAUNCH.get(e.name)), true]]);
    const v = mode === 'fixed' ? LAUNCH.get(e.name) : value(rng);
    let pasted = result(v), reply = v;
    if (mode === 'obey') {
      const r = rng();
      if (r < SETTINGS.share) pasted += comment(COMMENTS[Math.floor(rng() * COMMENTS.length)]);
      else if (r < 2 * SETTINGS.share) { let n; do n = value(rng); while (n === v); pasted += correction(n); reply = n; }
    }
    return example(data, [[question(e), false], [call(e), true], [pasted, false], [answer(reply), true]]);
  });
}

export const lookupIn = db => name => db.has(name) ? result(db.get(name)) : NOT_FOUND;
// A conversation with the tool: the model writes until the pause, the program reads the name, pastes
// lookup(name) and the model goes on until the stop token. Returns who wrote each token.
export function ask(model, data, enemy, lookup) {
  const run = tf.decoder(model), ids = [0, ...data.encode(question(enemy))], authors = ids.map(() => 'question');
  let probabilities, numberAt = -1, numberProbability = null, called = null, own = '';
  for (const t of ids) probabilities = run.push(t).probabilities;
  for (let guard = 0; guard < 40 && run.length < model.T - 1; guard++) {
    let next = 0;
    for (let i = 1; i < probabilities.length; i++) if (probabilities[i] > probabilities[next]) next = i;
    if (numberAt < 0 && /^ \d+$/.test(data.decode([next])) && data.decode([ids.at(-1)]) === ' Tiene') { numberAt = ids.length; numberProbability = probabilities[next]; }
    ids.push(next); authors.push('model'); own += data.decode([next]);
    if (next === data.stop) break;
    probabilities = run.push(next).probabilities;
    if (next === data.pause) {
      called = calledName(own);
      for (const t of data.encode(lookup(called))) { if (run.length >= model.T - 1) break; ids.push(t); authors.push('program'); probabilities = run.push(t).probabilities; }
    }
  }
  const after = data.decode(ids.filter((_, i) => authors[i] === 'model' && i > authors.lastIndexOf('program')));
  const number = numberAt >= 0 ? Number(data.decode([ids[numberAt]])) : null;
  return { ids, authors, called, number, numberAt, numberProbability, after };
}
// Where the position that predicts token `at` looked (the row of attention at at − 1).
export function attentionBefore(model, ids, at) {
  const run = tf.decoder(model); let row = null;
  for (let t = 0; t < at; t++) row = run.push(ids[t]).attention;
  return row;
}
export function measure(model, data, enemies, db) {
  let right = 0, calls = 0;
  for (const e of enemies) { const r = ask(model, data, e, lookupIn(db)); right += r.number === db.get(e.name); calls += r.called === e.name; }
  return { right: right / enemies.length, calls: calls / enemies.length };
}
// The three tests of the bestiary: known enemies, known enemies after the patch, enemies never seen.
export const report = (model, data) => ({ known: measure(model, data, KNOWN, LAUNCH).right, patched: measure(model, data, KNOWN, PATCH).right, unseen: measure(model, data, UNSEEN, LAUNCH).right });

// 03 · Memory and tool, one batch each in turn, so both curves advance together.
export function compareSteps(models, data, onEpoch, seed = SETTINGS.seed) {
  const rng = random(seed + 100), lists = { memory: trainingList(data, 'memory', random(seed + 200)), tool: trainingList(data, 'tool', random(seed + 200)) };
  const steps = [];
  for (let e = 1; e <= SETTINGS.epochs; e++) {
    steps.push(() => { shuffle(lists.memory, rng); shuffle(lists.tool, rng); });
    for (let i = 0; i < SETTINGS.examples; i += SETTINGS.batch) steps.push(() => {
      tf.trainBatch(models.memory, lists.memory.slice(i, i + SETTINGS.batch), SETTINGS.rate);
      tf.trainBatch(models.tool, lists.tool.slice(i, i + SETTINGS.batch), SETTINGS.rate);
    });
    steps.push(() => onEpoch({ epoch: e, memory: report(models.memory, data), tool: report(models.tool, data) }));
  }
  return steps;
}
// 05 and 06 · One model of another kind (fixed database, or obeying corrections).
export function singleSteps(model, data, mode, seed = SETTINGS.seed) {
  const epochs = mode === 'obey' ? SETTINGS.obeyEpochs : SETTINGS.epochs;
  return trainSteps(model, trainingList(data, mode, random(seed + 200)), epochs, SETTINGS.rate, random(seed + 100), SETTINGS.batch);
}
// With the fixed database, the model only ever saw the 48 launch values in the result.
export function fixedReport(model, data) {
  const seen = new Set(KNOWN.map(e => LAUNCH.get(e.name))), split = { seen: [0, 0], other: [0, 0] };
  for (const e of KNOWN) { const v = PATCH.get(e.name), r = ask(model, data, e, lookupIn(PATCH)), slot = seen.has(v) ? split.seen : split.other; slot[0] += r.number === v; slot[1]++; }
  return { ...report(model, data), seenRight: split.seen[0], seenCount: split.seen[1], otherRight: split.other[0], otherCount: split.other[1] };
}
