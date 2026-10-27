// The arithmetic behind chapter 13: work saved by the KV cache and money saved by prompt caching.
import { forward, probabilitiesAt, decoder } from '../../attention/src/transformer.js';

// Claude Sonnet 5.5, dollars per million tokens (Anthropic API, October 2026).
// A cache write lasts 5 minutes and costs 1.25× the input price; a cache read costs 0.1×.
export const PRICES = { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 };

// Positions passed through the network to generate n tokens from scratch.
// Without a cache every step runs the whole sequence again: 1 + 2 + … + n.
export const positionsWithout = n => n * (n + 1) / 2;
export const positionsWith = n => n;

// Generates with the chapter 09 transformer both ways and checks they give the same probabilities.
export function compareDecoding(model, tokens) {
  const run = decoder(model);
  let without = 0, withCache = 0, maxDifference = 0;
  for (let t = 1; t <= tokens.length; t++) {
    const again = forward(model, tokens.slice(0, t)); without += t;
    const full = probabilitiesAt(model, again, t - 1);
    const cached = run.push(tokens[t - 1]).probabilities; withCache += 1;
    for (let i = 0; i < full.length; i++) maxDifference = Math.max(maxDifference, Math.abs(full[i] - cached[i]));
  }
  return { without, withCache, maxDifference };
}

// Milliseconds to generate the sequence each way, repeated so the clock can see it.
export function timeDecoding(model, tokens, repeats, now = () => performance.now()) {
  let start = now();
  for (let r = 0; r < repeats; r++) for (let t = 1; t <= tokens.length; t++) probabilitiesAt(model, forward(model, tokens.slice(0, t)), t - 1);
  const without = now() - start;
  start = now();
  for (let r = 0; r < repeats; r++) { const run = decoder(model); for (const token of tokens) run.push(token); }
  return { without: without / repeats, withCache: (now() - start) / repeats };
}

// The parts of a prompt, in the order they are sent. Sizes are an invented example.
export const BLOCKS = [
  { name: 'Herramientas', tokens: 8000 },
  { name: 'Instrucciones', tokens: 4000 },
  { name: 'Documento', tokens: 30000 },
  { name: 'Historial', tokens: 12000 },
  { name: 'Pregunta nueva', tokens: 200 },
];

// Input cost of one request when block `changed` differs from the previous request.
// Everything before it is read from the cache; it and everything after are processed and written again.
export function promptCost(blocks, changed) {
  const total = blocks.reduce((sum, b) => sum + b.tokens, 0);
  const read = blocks.slice(0, changed).reduce((sum, b) => sum + b.tokens, 0), written = total - read;
  return {
    total, read, written,
    cached: (read * PRICES.cacheRead + written * PRICES.cacheWrite) / 1e6,
    plain: total * PRICES.input / 1e6,
  };
}

// Cumulative cost of an agent that sends the whole conversation every turn.
// Turn t sends the instructions plus t turns of new tokens; with the cache, all but the newest
// tokens were already sent the turn before (as long as fewer than 5 minutes pass between turns).
export function agentBill({ turns, system, perTurn, output }) {
  const without = [0], withCache = [0];
  for (let t = 1; t <= turns; t++) {
    const input = system + t * perTurn, read = t === 1 ? 0 : system + (t - 1) * perTurn, written = input - read;
    without.push(without[t - 1] + (input * PRICES.input + output * PRICES.output) / 1e6);
    withCache.push(withCache[t - 1] + (read * PRICES.cacheRead + written * PRICES.cacheWrite + output * PRICES.output) / 1e6);
  }
  return { without, withCache };
}
