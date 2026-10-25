// A tiny transformer written from scratch: one block with single-head causal
// self-attention and a small feed-forward layer, plus learned position embeddings.
// tokens → embedding + position → attention (+ residual) → tanh layer (+ residual) → softmax
import { random } from '../../tokens/src/corpus.js';
import { softmax } from '../../predictor/src/model.js';

export const DEFAULTS = { length: 32, width: 32, hidden: 64, rate: 0.003, batch: 4, seed: 42 };
const NAMES = ['E', 'P', 'Wq', 'Wk', 'Wv', 'Wo', 'W1', 'b1', 'W2', 'b2', 'Wout', 'bout'];

export function createTransformer({ vocabularySize: V, length: T = DEFAULTS.length, width: D = DEFAULTS.width, hidden: H = DEFAULTS.hidden, seed = DEFAULTS.seed }) {
  const rng = random(seed), init = (n, scale) => Float32Array.from({ length: n }, () => (rng() * 2 - 1) * scale);
  const square = Math.sqrt(3 / D);
  const params = {
    E: init(V * D, 0.5), P: init(T * D, 0.1),
    Wq: init(D * D, square), Wk: init(D * D, square), Wv: init(D * D, square), Wo: init(D * D, square),
    W1: init(D * H, Math.sqrt(6 / (D + H))), b1: new Float32Array(H), W2: init(H * D, Math.sqrt(6 / (D + H))), b2: new Float32Array(D),
    Wout: init(D * V, Math.sqrt(6 / (D + V))), bout: new Float32Array(V),
  };
  const zeros = () => Object.fromEntries(NAMES.map(k => [k, new Float32Array(params[k].length)]));
  return { kind: 'transformer', V, T, D, H, params, grads: zeros(), m: zeros(), v: zeros(), step: 0 };
}
export const parameterCount = model => NAMES.reduce((n, k) => n + model.params[k].length, 0);

// out[n×cols] = input[n×rows] · W[rows×cols] (+ bias)
function matmul(input, n, rows, W, cols, bias) {
  const out = new Float32Array(n * cols);
  for (let t = 0; t < n; t++) {
    const o = t * cols; if (bias) out.set(bias, o);
    for (let i = 0; i < rows; i++) { const x = input[t * rows + i]; if (x) for (let j = 0, w = i * cols; j < cols; j++) out[o + j] += x * W[w + j]; }
  }
  return out;
}
// Accumulates dW += inputᵀ · dOut and returns dInput = dOut · Wᵀ.
function matmulBack(input, n, rows, W, cols, dOut, dW) {
  const dIn = new Float32Array(n * rows);
  for (let t = 0; t < n; t++) for (let i = 0; i < rows; i++) {
    const x = input[t * rows + i], w = i * cols; let sum = 0;
    for (let j = 0; j < cols; j++) { const g = dOut[t * cols + j]; dW[w + j] += x * g; sum += W[w + j] * g; }
    dIn[t * rows + i] = sum;
  }
  return dIn;
}

// Runs a sequence of up to T token indices and keeps every intermediate value for inspection and training.
export function forward(model, tokens) {
  const { V, D, H, params: p } = model, n = tokens.length, scale = 1 / Math.sqrt(D);
  const x0 = new Float32Array(n * D);
  for (let t = 0; t < n; t++) for (let d = 0; d < D; d++) x0[t * D + d] = p.E[tokens[t] * D + d] + p.P[t * D + d];
  const q = matmul(x0, n, D, p.Wq, D), k = matmul(x0, n, D, p.Wk, D), v = matmul(x0, n, D, p.Wv, D);
  // Each position may only look at itself and earlier positions (causal attention).
  const attention = new Float32Array(n * n), z = new Float32Array(n * D);
  for (let t = 0; t < n; t++) {
    const scores = new Float32Array(t + 1);
    for (let s = 0; s <= t; s++) { let dot = 0; for (let d = 0; d < D; d++) dot += q[t * D + d] * k[s * D + d]; scores[s] = dot * scale; }
    const weights = softmax(scores);
    for (let s = 0; s <= t; s++) { attention[t * n + s] = weights[s]; for (let d = 0; d < D; d++) z[t * D + d] += weights[s] * v[s * D + d]; }
  }
  const o = matmul(z, n, D, p.Wo, D), x1 = x0.map((value, i) => value + o[i]);
  const r = matmul(x1, n, D, p.W1, H, p.b1).map(Math.tanh), m = matmul(r, n, H, p.W2, D, p.b2), x2 = x1.map((value, i) => value + m[i]);
  const logits = matmul(x2, n, D, p.Wout, V, p.bout);
  return { n, x0, q, k, v, attention, z, x1, r, x2, logits };
}
export function probabilitiesAt(model, cache, t) { return softmax(cache.logits.subarray(t * model.V, (t + 1) * model.V)); }

// One training batch: every position predicts the following token. Returns the mean cross-entropy.
export function backward(model, batch) {
  const { V, D, H, params: p, grads: g } = model, scale = 1 / Math.sqrt(D);
  for (const grad of Object.values(g)) grad.fill(0);
  const total = batch.reduce((sum, item) => sum + item.targets.length, 0);
  let loss = 0;
  for (const { tokens, targets } of batch) {
    const c = forward(model, tokens), n = c.n, dLogits = new Float32Array(n * V);
    for (let t = 0; t < n; t++) {
      const probabilities = softmax(c.logits.subarray(t * V, (t + 1) * V));
      loss -= Math.log(Math.max(probabilities[targets[t]], 1e-12));
      probabilities[targets[t]] -= 1;
      for (let j = 0; j < V; j++) { dLogits[t * V + j] = probabilities[j] / total; g.bout[j] += probabilities[j] / total; }
    }
    const dX2 = matmulBack(c.x2, n, D, p.Wout, V, dLogits, g.Wout);
    for (let t = 0; t < n; t++) for (let d = 0; d < D; d++) g.b2[d] += dX2[t * D + d];
    const dR = matmulBack(c.r, n, H, p.W2, D, dX2, g.W2);
    const dU = dR.map((value, i) => value * (1 - c.r[i] * c.r[i]));
    for (let t = 0; t < n; t++) for (let j = 0; j < H; j++) g.b1[j] += dU[t * H + j];
    const dX1 = matmulBack(c.x1, n, D, p.W1, H, dU, g.W1).map((value, i) => value + dX2[i]);
    const dZ = matmulBack(c.z, n, D, p.Wo, D, dX1, g.Wo);
    // Back through the weighted mix and the softmax of each attention row.
    const dq = new Float32Array(n * D), dk = new Float32Array(n * D), dv = new Float32Array(n * D);
    for (let t = 0; t < n; t++) {
      const dA = new Float32Array(t + 1); let weighted = 0;
      for (let s = 0; s <= t; s++) {
        const a = c.attention[t * n + s]; let dot = 0;
        for (let d = 0; d < D; d++) { dot += dZ[t * D + d] * c.v[s * D + d]; dv[s * D + d] += a * dZ[t * D + d]; }
        dA[s] = dot; weighted += a * dot;
      }
      for (let s = 0; s <= t; s++) {
        const dScore = c.attention[t * n + s] * (dA[s] - weighted) * scale;
        for (let d = 0; d < D; d++) { dq[t * D + d] += dScore * c.k[s * D + d]; dk[s * D + d] += dScore * c.q[t * D + d]; }
      }
    }
    const dX0 = dX1.slice();
    for (const [dProjection, W, dW] of [[dq, p.Wq, g.Wq], [dk, p.Wk, g.Wk], [dv, p.Wv, g.Wv]]) {
      const back = matmulBack(c.x0, n, D, W, D, dProjection, dW);
      for (let i = 0; i < back.length; i++) dX0[i] += back[i];
    }
    for (let t = 0; t < n; t++) for (let d = 0; d < D; d++) { g.E[tokens[t] * D + d] += dX0[t * D + d]; g.P[t * D + d] += dX0[t * D + d]; }
  }
  return loss / total;
}
export function adam(model, rate = DEFAULTS.rate) {
  const b1 = 0.9, b2 = 0.999, t = ++model.step, c1 = 1 - b1 ** t, c2 = 1 - b2 ** t;
  for (const name of NAMES) {
    const p = model.params[name], g = model.grads[name], m = model.m[name], v = model.v[name];
    for (let i = 0; i < p.length; i++) {
      m[i] = b1 * m[i] + (1 - b1) * g[i];
      v[i] = b2 * v[i] + (1 - b2) * g[i] * g[i];
      p[i] -= rate * (m[i] / c1) / (Math.sqrt(v[i] / c2) + 1e-8);
    }
  }
}
export function trainBatch(model, batch, rate) { const loss = backward(model, batch); adam(model, rate); return loss; }

// Windows of T+1 tokens: the first T are the input and the last T are the targets.
export function windows(indices, T, offset = 0) {
  const list = [];
  for (let start = offset; start + 1 < indices.length; start += T) {
    const slice = indices.slice(start, start + T + 1);
    if (slice.length < 2) break;
    list.push({ tokens: slice.slice(0, -1), targets: slice.slice(1) });
  }
  return list;
}
export function snapshot(model) {
  const { V, T, D, H, step } = model;
  return { kind: 'transformer', V, T, D, H, step, params: Object.fromEntries(NAMES.map(k => [k, Float32Array.from(model.params[k])])) };
}
export function restore(data) {
  const model = createTransformer({ vocabularySize: data.V, length: data.T, width: data.D, hidden: data.H });
  for (const k of NAMES) {
    if (!data.params[k] || data.params[k].length !== model.params[k].length) throw Error('Invalid transformer snapshot');
    model.params[k].set(data.params[k]);
  }
  model.step = data.step;
  return model;
}
