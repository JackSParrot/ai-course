// The three training stages of chapter 10 as plain functions, shared by the worker and the tests.
// Each stage returns a list of small steps so a caller can run them in slices.
import * as tf from '../../attention/src/transformer.js';
import { judge, rate } from './world.js';

export const SETTINGS = { length: 48, rate: 0.005, batch: 8, pretrainEpochs: 5, instructionEpochs: 3, preferenceRate: 0.008, preferenceEpochs: 3, candidates: 12, temperature: 1.5, seed: 42 };

// Each stage starts from a saved model with a fresh optimizer, like a new fine-tuning run.
export function fresh(saved) { const model = tf.restore(saved); model.step = 0; return model; }
export function shuffle(list, rng) { for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; } return list; }
// A conversation trains only the reply: prompt positions get target -1.
export function conversation(prompt, reply) {
  const all = [0, ...prompt, ...reply];
  return { tokens: all.slice(0, -1), targets: all.slice(1).map((y, i) => i >= prompt.length ? y : -1) };
}
export function sequence(line) { const all = [0, ...line]; return { tokens: all.slice(0, -1), targets: all.slice(1) }; }
export function trainSteps(model, list, epochs, learningRate, rng, batch = SETTINGS.batch) {
  const steps = [];
  for (let e = 0; e < epochs; e++) {
    steps.push(() => shuffle(list, rng));
    for (let i = 0; i < list.length; i += batch) steps.push(() => tf.trainBatch(model, list.slice(i, i + batch), learningRate));
  }
  return steps;
}
export function answer(model, data, item, temperature = 0, rng) {
  return data.decode(tf.generate(model, [0, ...item.prompt], { maxTokens: 10, temperature, stop: data.stop, rng }));
}
export function measure(model, data) {
  let truthful = 0, agrees = 0, stops = 0;
  for (const item of data.test) { const v = judge(answer(model, data, item), item); truthful += v.truthful; agrees += v.agrees; stops += v.stops; }
  const n = data.test.length;
  return { truthful: truthful / n, agrees: agrees / n, stops: stops / n };
}
// One preference round: sample several replies per question, let a rater choose, train on the chosen ones.
export function preferenceRoundSteps(model, data, raters, rng, onDone) {
  let chosen = [];
  const steps = data.preferences.map(item => () => {
    const candidates = Array.from({ length: SETTINGS.candidates }, () => answer(model, data, item, SETTINGS.temperature, rng));
    const pick = rate(candidates, item, raters, rng);
    if (pick >= 0) chosen.push(conversation(item.prompt, data.encodeReply(candidates[pick])));
  });
  // Training happens in one step so the next round samples from the updated model.
  steps.push(() => {
    const list = chosen; chosen = [];
    for (const step of trainSteps(model, list, SETTINGS.preferenceEpochs, SETTINGS.preferenceRate, rng)) step();
    onDone();
  });
  return steps;
}
