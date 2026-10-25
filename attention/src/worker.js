// Trains the chapter 08 network and the transformer side by side on the same sentences.
import * as mlp from '../../predictor/src/model.js';
import * as tf from './transformer.js';
import { random } from '../../tokens/src/corpus.js';

const SETTINGS = { mlpRate: 0.01, mlpBatch: 32, tfRate: 0.005, tfBatch: 8, context: 4, seed: 42 };
let models = null, data = null, epoch = 0, remaining = 0, running = false, timer = 0, history = [], stage = null;

// Each line becomes one sequence that starts with the start marker (index 0).
const sequences = lines => lines.map(line => ({ tokens: [mlp.BOS, ...line.slice(0, -1)], targets: line }));
const mlpExamples = lines => lines.flatMap(line => mlp.examples(line, SETTINGS.context));
function shuffle(list, seed) {
  const rng = random(seed);
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
}
function argmax(values) { let best = 0; for (let i = 1; i < values.length; i++) if (values[i] > values[best]) best = i; return best; }
// The story score looks only at the repeated place: the token that needs the distant clue.
function measure() {
  const point = { epoch, mlp: { story: 0, accuracy: 0 }, transformer: { story: 0, accuracy: 0 } };
  for (const { line, at } of data.stories) {
    const before = line.slice(0, at), target = line[at];
    if (argmax(mlp.predict(models.mlp, mlp.contextWindow(before, SETTINGS.context))) === target) point.mlp.story++;
    const cache = tf.forward(models.transformer, [mlp.BOS, ...before]);
    if (argmax(tf.probabilitiesAt(models.transformer, cache, before.length)) === target) point.transformer.story++;
  }
  let total = 0;
  for (const line of data.validation) {
    const cache = tf.forward(models.transformer, [mlp.BOS, ...line.slice(0, -1)]);
    line.forEach((target, t) => {
      total++;
      if (argmax(tf.probabilitiesAt(models.transformer, cache, t)) === target) point.transformer.accuracy++;
      if (argmax(mlp.predict(models.mlp, mlp.contextWindow(line.slice(0, t), SETTINGS.context))) === target) point.mlp.accuracy++;
    });
  }
  for (const key of ['mlp', 'transformer']) { point[key].story /= data.stories.length; point[key].accuracy /= total; }
  history.push(point);
}
function report(kind = 'progress') {
  postMessage({ kind, epoch, running, history, mlp: mlp.snapshot(models.mlp), transformer: tf.snapshot(models.transformer) });
}
function stop() { running = false; clearTimeout(timer); }
function startEpoch() {
  const tfList = sequences(data.train), mlpList = mlpExamples(data.train);
  shuffle(tfList, SETTINGS.seed + epoch); shuffle(mlpList, SETTINGS.seed + 100 + epoch);
  stage = { tfList, mlpList, tf: 0, mlp: 0 };
}
// Short slices keep pausing responsive; both networks see the whole text once per epoch.
function work() {
  if (!running) return;
  const end = performance.now() + 30;
  while (performance.now() < end && running) {
    if (!stage) startEpoch();
    if (stage.tf < stage.tfList.length) { tf.trainBatch(models.transformer, stage.tfList.slice(stage.tf, stage.tf + SETTINGS.tfBatch), SETTINGS.tfRate); stage.tf += SETTINGS.tfBatch; }
    if (stage.mlp < stage.mlpList.length) { mlp.trainBatch(models.mlp, stage.mlpList.slice(stage.mlp, stage.mlp + SETTINGS.mlpBatch), SETTINGS.mlpRate); stage.mlp += SETTINGS.mlpBatch; }
    if (stage.tf >= stage.tfList.length && stage.mlp >= stage.mlpList.length) {
      stage = null; epoch++; remaining--; measure();
      if (remaining <= 0) stop();
      report();
    }
  }
  if (running) {
    const done = stage ? (stage.tf / stage.tfList.length + stage.mlp / stage.mlpList.length) / 2 : 0;
    postMessage({ kind: 'tick', epoch, done });
    timer = setTimeout(work, 0);
  }
}
self.onmessage = ({ data: message }) => {
  if (message.kind === 'reset') {
    stop();
    data = message;
    models = {
      mlp: mlp.createModel({ vocabularySize: message.vocabularySize, context: SETTINGS.context, seed: SETTINGS.seed }),
      transformer: tf.createTransformer({ vocabularySize: message.vocabularySize, seed: SETTINGS.seed }),
    };
    epoch = 0; history = []; stage = null; measure(); report('reset');
  } else if (message.kind === 'train' && models) {
    remaining = message.epochs; running = true; report(); work();
  } else if (message.kind === 'pause') { stop(); report(); }
};
