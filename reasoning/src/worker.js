// Runs the experiments of chapter 11 off the main thread, in small slices.
import * as tf from '../../attention/src/transformer.js';
import { random } from '../../tokens/src/corpus.js';
import { prepareData, threeCups, nineCups } from './data.js';
import { SETTINGS, create, compareSteps, demoSteps, rewardRoundSteps, measure, freshOptimizer } from './training.js';

let data = null, saved = {}, job = null, timer = 0;
const post = (kind, extra = {}) => postMessage({ kind, ...extra });

function run(steps, finish) {
  clearTimeout(timer);
  job = { steps, index: 0 };
  const tick = () => {
    const end = performance.now() + 30;
    while (job.index < job.steps.length && performance.now() < end) job.steps[job.index++]();
    post('progress', { done: job.index / Math.max(1, job.steps.length) });
    if (job.index < job.steps.length) timer = setTimeout(tick, 0); else finish();
  };
  tick();
}
function compare() {
  const models = { direct: create(data.vocabularySize), think: create(data.vocabularySize) }, history = [];
  run(compareSteps(models, threeCups(data), epoch => { history.push(epoch); post('epoch', { history }); }), () => {
    post('stage', { stage: 'compare', history, direct: tf.snapshot(models.direct), think: tf.snapshot(models.think) });
  });
}
function demos() {
  const model = create(data.vocabularySize), nine = nineCups(data);
  run(demoSteps(model, nine), () => {
    saved.demos = tf.snapshot(model);
    post('stage', { stage: 'demos', model: saved.demos, metrics: measure(model, nine, nine.test) });
  });
}
// Every run starts again from the same model trained on the written examples, so modes can be compared.
function reward({ mode }) {
  const model = tf.restore(saved.demos), nine = nineCups(data), rng = random(SETTINGS.seed + 50), steps = [];
  freshOptimizer(model);
  const history = [{ round: 0, ...measure(model, nine, nine.test), kept: 0, lucky: 0 }];
  for (let round = 1; round <= SETTINGS.rounds; round++) steps.push(...rewardRoundSteps(model, nine, mode, rng, stats => {
    history.push({ round, ...measure(model, nine, nine.test), ...stats });
    post('round', { mode, history, model: tf.snapshot(model) });
  }));
  run(steps, () => post('stage', { stage: 'reward', mode, history, model: tf.snapshot(model) }));
}

self.onmessage = ({ data: message }) => {
  if (message.kind === 'setup') data = prepareData(message.tokenizer);
  else if (message.kind === 'compare') compare();
  else if (message.kind === 'demos') demos();
  else if (message.kind === 'reward' && saved.demos) reward(message);
  else if (message.kind === 'stop' && job) job.steps.length = job.index;
};
