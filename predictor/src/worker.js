// Trains the next-token model off the main thread and reports after every epoch.
import { createModel, examples, trainBatch, evaluate, snapshot, DEFAULTS } from './model.js';
import { random } from '../../tokens/src/corpus.js';

let model = null, train = [], validation = [], epoch = 0, cursor = 0, remaining = 0, running = false, timer = 0, history = [], settings = DEFAULTS;
function report(kind = 'progress') {
  postMessage({ kind, epoch, cursor, total: train.length, running, history, model: model && snapshot(model) });
}
function measure() {
  const t = evaluate(model, train.slice(0, 1500)), v = evaluate(model, validation);
  history.push({ epoch, trainLoss: t.loss, validationLoss: v.loss, accuracy: v.accuracy });
}
function stop() { running = false; clearTimeout(timer); }
function shuffle(list, seed) {
  const rng = random(seed);
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
}
// Small slices keep pause responsive and the page smooth.
function work() {
  if (!running) return;
  const end = performance.now() + 30;
  while (performance.now() < end && running) {
    if (cursor === 0) shuffle(train, settings.seed + epoch);
    trainBatch(model, train.slice(cursor, cursor + settings.batch), settings.rate);
    cursor += settings.batch;
    if (cursor >= train.length) {
      cursor = 0; epoch++; remaining--; measure();
      if (remaining <= 0) stop();
      report();
    }
  }
  if (running) { postMessage({ kind: 'tick', epoch, cursor, total: train.length }); timer = setTimeout(work, 0); }
}
self.onmessage = ({ data }) => {
  if (data.kind === 'reset') {
    stop();
    settings = { ...DEFAULTS, ...data.settings };
    model = createModel({ vocabularySize: data.vocabularySize, ...settings });
    train = examples(data.train, settings.context); validation = examples(data.validation, settings.context);
    epoch = 0; cursor = 0; history = []; measure(); report('reset');
  } else if (data.kind === 'train' && model) {
    remaining = data.epochs; running = true; report(); work();
  } else if (data.kind === 'pause') { stop(); report(); }
};
