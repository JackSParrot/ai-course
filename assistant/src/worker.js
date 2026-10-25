// Runs the three training stages of chapter 10 off the main thread, in small slices.
import * as tf from '../../attention/src/transformer.js';
import { random } from '../../tokens/src/corpus.js';
import { Tokenizer } from '../../tokens/src/bpe.js';
import { SETTINGS, fresh, conversation, sequence, trainSteps, measure, preferenceRoundSteps } from './training.js';

let data = null, model = null, saved = {}, job = null, timer = 0;
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
function pretrain() {
  model = tf.createTransformer({ vocabularySize: data.vocabularySize, length: SETTINGS.length, seed: SETTINGS.seed });
  run(trainSteps(model, data.pretrain.map(sequence), SETTINGS.pretrainEpochs, SETTINGS.rate, random(SETTINGS.seed)), () => {
    saved.base = tf.snapshot(model);
    post('stage', { stage: 'base', model: saved.base });
  });
}
function instruct() {
  model = fresh(saved.base);
  const list = data.instructions.map(item => conversation(item.prompt, item.reply));
  run(trainSteps(model, list, SETTINGS.instructionEpochs, SETTINGS.rate, random(SETTINGS.seed + 1)), () => {
    saved.assistant = tf.snapshot(model);
    post('stage', { stage: 'assistant', model: saved.assistant, metrics: measure(model, data) });
  });
}
// Every experiment starts again from the same assistant, so different raters can be compared.
function prefer({ likesAgreement, checksFacts, rounds }) {
  model = fresh(saved.assistant);
  const rng = random(SETTINGS.seed + 7), history = [{ round: 0, ...measure(model, data) }], steps = [];
  for (let round = 1; round <= rounds; round++) steps.push(...preferenceRoundSteps(model, data, { likesAgreement, checksFacts }, rng, () => {
    history.push({ round, ...measure(model, data) });
    post('round', { history, model: tf.snapshot(model) });
  }));
  run(steps, () => post('stage', { stage: 'tuned', history, model: tf.snapshot(model) }));
}

self.onmessage = ({ data: message }) => {
  if (message.kind === 'setup') {
    // Replies come back as text, so the worker re-tokenises them with the same tokenizer and vocabulary.
    const tokenizer = new Tokenizer(message.tokenizer), index = new Map(message.tokens.map((id, i) => [id, i]));
    data = { ...message, decode: indices => tokenizer.decode(indices.map(i => message.tokens[i] ?? 0)), encodeReply: text => tokenizer.encode(text).map(id => index.get(id) ?? 1) };
  } else if (message.kind === 'pretrain') pretrain();
  else if (message.kind === 'instruct' && saved.base) instruct();
  else if (message.kind === 'prefer' && saved.assistant) prefer(message.settings);
  else if (message.kind === 'stop' && job) job.steps.length = job.index;
};
