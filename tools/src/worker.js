// Runs the experiments of chapter 12 off the main thread, in small slices.
import * as tf from '../../attention/src/transformer.js';
import { prepareData } from './bestiary.js';
import { create, compareSteps, singleSteps, report, fixedReport } from './training.js';

let data = null, job = null, timer = 0;
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
  const models = { memory: create(data.vocabularySize), tool: create(data.vocabularySize) }, history = [];
  run(compareSteps(models, data, epoch => { history.push(epoch); post('epoch', { history }); }), () => {
    post('stage', { stage: 'compare', history, memory: tf.snapshot(models.memory), tool: tf.snapshot(models.tool) });
  });
}
// fixed → the tool model trained on one database · obey → the tool model that follows corrections.
function single(mode) {
  const model = create(data.vocabularySize);
  run(singleSteps(model, data, mode), () => post('stage', { stage: mode, model: tf.snapshot(model), metrics: mode === 'fixed' ? fixedReport(model, data) : report(model, data) }));
}

self.onmessage = ({ data: message }) => {
  if (message.kind === 'setup') data = prepareData(message.tokenizer);
  else if (message.kind === 'compare') compare();
  else if (message.kind === 'fixed' || message.kind === 'obey') single(message.kind);
};
