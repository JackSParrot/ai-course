// A tiny next-token model written from scratch:
// previous N tokens → embeddings → tanh hidden layer → softmax over the vocabulary.
import { random } from '../../tokens/src/corpus.js';

export const BOS = 0, UNK = 1;
export const CONTEXTS = [1, 2, 4];
export const DEFAULTS = { context: 4, embedding: 16, hidden: 64, rate: 0.01, batch: 32, seed: 42 };

// The model only predicts tokens seen in training; index 0 marks "before the text".
export function buildVocabulary(tokenIds) {
  const tokens = [...new Set(tokenIds)].sort((a, b) => a - b);
  return { tokens: [null, null, ...tokens], index: new Map(tokens.map((id, i) => [id, i + 2])) };
}
export const toIndices = (vocabulary, tokenIds) => tokenIds.map(id => vocabulary.index.get(id) ?? UNK);

export function examples(indices, context) {
  const list = [];
  for (let i = 0; i < indices.length; i++) {
    const window = [];
    for (let k = context; k > 0; k--) window.push(i - k >= 0 ? indices[i - k] : BOS);
    list.push({ context: window, target: indices[i] });
  }
  return list;
}
export const contextWindow = (indices, context) => Array.from({ length: context }, (_, k) => indices[indices.length - context + k] ?? BOS);

export function createModel({ vocabularySize, context = DEFAULTS.context, embedding = DEFAULTS.embedding, hidden = DEFAULTS.hidden, seed = DEFAULTS.seed }) {
  const rng = random(seed), inputs = context * embedding;
  const init = (n, scale) => Float32Array.from({ length: n }, () => (rng() * 2 - 1) * scale);
  const params = {
    E: init(vocabularySize * embedding, 0.5),
    W1: init(inputs * hidden, Math.sqrt(6 / (inputs + hidden))), b1: new Float32Array(hidden),
    W2: init(hidden * vocabularySize, Math.sqrt(6 / (hidden + vocabularySize))), b2: new Float32Array(vocabularySize),
  };
  const zeros = () => Object.fromEntries(Object.entries(params).map(([k, v]) => [k, new Float32Array(v.length)]));
  return { V: vocabularySize, N: context, D: embedding, H: hidden, params, grads: zeros(), m: zeros(), v: zeros(), step: 0 };
}
export const parameterCount = model => Object.values(model.params).reduce((n, p) => n + p.length, 0);

export function forward(model, window) {
  const { V, N, D, H, params: { E, W1, b1, W2, b2 } } = model;
  const x = new Float32Array(N * D);
  for (let k = 0; k < N; k++) x.set(E.subarray(window[k] * D, window[k] * D + D), k * D);
  const h = Float32Array.from(b1);
  for (let i = 0; i < N * D; i++) { const xi = x[i]; if (xi) for (let j = 0, row = i * H; j < H; j++) h[j] += xi * W1[row + j]; }
  for (let j = 0; j < H; j++) h[j] = Math.tanh(h[j]);
  const logits = Float32Array.from(b2);
  for (let j = 0; j < H; j++) { const hj = h[j], row = j * V; for (let v = 0; v < V; v++) logits[v] += hj * W2[row + v]; }
  return { x, h, logits };
}
export function softmax(logits, temperature = 1) {
  let max = -Infinity;
  for (const value of logits) if (value > max) max = value;
  const out = new Float32Array(logits.length);
  let sum = 0;
  for (let i = 0; i < logits.length; i++) sum += out[i] = Math.exp((logits[i] - max) / temperature);
  for (let i = 0; i < out.length; i++) out[i] /= sum;
  return out;
}
export const predict = (model, window) => softmax(forward(model, window).logits);

// Accumulates gradients for one batch; returns its mean cross-entropy.
export function backward(model, batch) {
  const { V, N, D, H, params: { E, W1, W2 }, grads: g } = model;
  for (const grad of Object.values(g)) grad.fill(0);
  let loss = 0;
  const scale = 1 / batch.length, dh = new Float32Array(H), dz = new Float32Array(H);
  for (const { context, target } of batch) {
    const { x, h, logits } = forward(model, context), p = softmax(logits);
    loss -= Math.log(Math.max(p[target], 1e-12));
    p[target] -= 1;
    dh.fill(0);
    for (let j = 0; j < H; j++) {
      const hj = h[j], row = j * V; let sum = 0;
      for (let v = 0; v < V; v++) { const d = p[v] * scale; g.W2[row + v] += hj * d; sum += W2[row + v] * d; }
      dh[j] = sum;
    }
    for (let v = 0; v < V; v++) g.b2[v] += p[v] * scale;
    for (let j = 0; j < H; j++) { dz[j] = dh[j] * (1 - h[j] * h[j]); g.b1[j] += dz[j]; }
    for (let i = 0; i < N * D; i++) {
      const xi = x[i], row = i * H; let dx = 0;
      for (let j = 0; j < H; j++) { g.W1[row + j] += xi * dz[j]; dx += W1[row + j] * dz[j]; }
      const k = Math.floor(i / D), d = i % D;
      g.E[context[k] * D + d] += dx;
    }
  }
  return loss / batch.length;
}
export function adam(model, rate = DEFAULTS.rate) {
  const b1 = 0.9, b2 = 0.999, t = ++model.step, c1 = 1 - b1 ** t, c2 = 1 - b2 ** t;
  for (const [name, p] of Object.entries(model.params)) {
    const g = model.grads[name], m = model.m[name], v = model.v[name];
    for (let i = 0; i < p.length; i++) {
      m[i] = b1 * m[i] + (1 - b1) * g[i];
      v[i] = b2 * v[i] + (1 - b2) * g[i] * g[i];
      p[i] -= rate * (m[i] / c1) / (Math.sqrt(v[i] / c2) + 1e-8);
    }
  }
}
export function trainBatch(model, batch, rate) { const loss = backward(model, batch); adam(model, rate); return loss; }

export function evaluate(model, list) {
  let loss = 0, correct = 0;
  for (const { context, target } of list) {
    const p = predict(model, context);
    loss -= Math.log(Math.max(p[target], 1e-12));
    let best = 0; for (let i = 1; i < p.length; i++) if (p[i] > p[best]) best = i;
    if (best === target) correct++;
  }
  return { loss: loss / list.length, accuracy: correct / list.length };
}

// Temperature 0 always chooses the most likely token; higher values flatten the distribution.
export function sample(probabilities, temperature, rng = Math.random) {
  const allowed = i => i !== BOS && i !== UNK;
  if (temperature <= 0) {
    let best = -1; for (let i = 0; i < probabilities.length; i++) if (allowed(i) && (best < 0 || probabilities[i] > probabilities[best])) best = i;
    return best;
  }
  const weights = Array.from(probabilities, (p, i) => allowed(i) ? Math.pow(Math.max(p, 1e-12), 1 / temperature) : 0);
  let r = rng() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) if ((r -= weights[i]) <= 0) return i;
  return weights.findLastIndex(w => w > 0);
}

export function snapshot(model) {
  const { V, N, D, H, step } = model;
  return { V, N, D, H, step, params: Object.fromEntries(Object.entries(model.params).map(([k, p]) => [k, Float32Array.from(p)])) };
}
export function restore(data) {
  const model = createModel({ vocabularySize: data.V, context: data.N, embedding: data.D, hidden: data.H });
  for (const [k, p] of Object.entries(model.params)) {
    if (!data.params[k] || data.params[k].length !== p.length) throw Error('Invalid model snapshot');
    p.set(data.params[k]);
  }
  model.step = data.step;
  return model;
}
