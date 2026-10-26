// The experiments of chapter 11 as plain functions, shared by the worker and the tests.
// Each experiment returns a list of small steps so a caller can run them in slices.
import * as tf from '../../attention/src/transformer.js';
import { random } from '../../tokens/src/corpus.js';
import { conversation, shuffle, trainSteps } from '../../assistant/src/training.js';
import { grade } from './shell-game.js';

// Calibrated in Node with several seeds (see tests/reasoning.test.mjs for a reduced version).
export const SETTINGS = {
  length: 96, rate: 0.003, batch: 8, epochs: 6, seed: 1, measureGames: 100,
  // Learning to think from verifiable rewards, with nine cups.
  demos: 100, demoEpochs: 100, demoRate: 0.005,
  rounds: 12, questions: 300, candidates: 12, temperature: 0.7, roundRate: 0.003, roundEpochs: 3,
};
export const MODES = ['answer', 'steps', 'random', 'demos'];

export const create = (vocabularySize, seed = SETTINGS.seed) => tf.createTransformer({ vocabularySize, length: SETTINGS.length, seed });
// Each phase starts with a fresh optimizer, as in chapter 10.
export function freshOptimizer(model) { model.step = 0; for (const name of Object.keys(model.m)) { model.m[name].fill(0); model.v[name].fill(0); } }
export function reply(model, data, g, { temperature = 0, rng } = {}) {
  return data.decode(tf.generate(model, [0, ...g.encoded.prompt], { maxTokens: 30, temperature, stop: data.stop, rng }));
}
// Share of games answered right and share with every thinking step right.
export function measure(model, data, games) {
  let correct = 0, chain = 0;
  for (const g of games) { const v = grade(reply(model, data, g), g); correct += v.correct; chain += v.chain; }
  return { correct: correct / games.length, chain: chain / games.length };
}

// 03 · Two identical models, one trained to answer at once and one to think first, one batch each in turn.
export function compareSteps(models, data, onEpoch) {
  const rng = random(SETTINGS.seed + 100), lists = { direct: [], think: [] };
  for (const g of data.train) { lists.direct.push(conversation(g.encoded.prompt, g.encoded.direct)); lists.think.push(conversation(g.encoded.prompt, g.encoded.think)); }
  const steps = [], games = data.test.slice(0, SETTINGS.measureGames);
  for (let e = 1; e <= SETTINGS.epochs; e++) {
    steps.push(() => { shuffle(lists.direct, rng); shuffle(lists.think, rng); });
    for (let i = 0; i < lists.think.length; i += SETTINGS.batch) steps.push(() => {
      tf.trainBatch(models.direct, lists.direct.slice(i, i + SETTINGS.batch), SETTINGS.rate);
      tf.trainBatch(models.think, lists.think.slice(i, i + SETTINGS.batch), SETTINGS.rate);
    });
    steps.push(() => onEpoch({ epoch: e, direct: measure(models.direct, data, games).correct, think: measure(models.think, data, games).correct }));
  }
  return steps;
}

// 07 · A few written examples of thinking, trained until they stop helping.
export function demoSteps(model, data) {
  return trainSteps(model, data.demos.map(g => conversation(g.encoded.prompt, g.encoded.think)), SETTINGS.demoEpochs, SETTINGS.demoRate, random(SETTINGS.seed + 300));
}
// One round of rewards. For every question the model writes several replies and the checker keeps one:
//  answer → right final cup · steps → every step right · random → any reply · demos → no replies, revise the written examples.
// «lucky» counts kept replies whose answer is right but whose steps are wrong.
export function rewardRoundSteps(model, data, mode, rng, onDone) {
  const chosen = [], stats = { kept: 0, lucky: 0 };
  const steps = mode === 'demos' ? [] : shuffle([...data.questions], rng).slice(0, SETTINGS.questions).map(g => () => {
    const replies = Array.from({ length: SETTINGS.candidates }, () => reply(model, data, g, { temperature: SETTINGS.temperature, rng }));
    const verdicts = replies.map(r => grade(r, g));
    const ok = replies.map((_, i) => i).filter(i => mode === 'random' || (mode === 'steps' ? verdicts[i].chain && verdicts[i].correct : verdicts[i].correct));
    if (!ok.length) return;
    const pick = ok[Math.floor(rng() * ok.length)];
    chosen.push(conversation(g.encoded.prompt, data.encode(replies[pick])));
    stats.kept++; if (verdicts[pick].correct && !verdicts[pick].chain) stats.lucky++;
  });
  steps.push(() => {
    const list = mode === 'demos' ? Array.from({ length: SETTINGS.questions }, (_, i) => conversation(data.demos[i % data.demos.length].encoded.prompt, data.demos[i % data.demos.length].encoded.think)) : chosen;
    if (mode === 'demos') stats.kept = list.length;
    for (const step of trainSteps(model, list, SETTINGS.roundEpochs, SETTINGS.roundRate, rng)) step();
    onDone(stats);
  });
  return steps;
}
