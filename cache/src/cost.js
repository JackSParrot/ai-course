// The arithmetic behind chapter 13: work saved by the KV cache and money saved by prompt caching.

// Claude Sonnet 5.5, dollars per million tokens (Anthropic API, October 2026).
// A cache write lasts 5 minutes and costs 1.25× the input price; a cache read costs 0.1×.
export const PRICES = { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 };

// Positions passed through the network to generate n tokens from scratch.
// Without a cache every step runs the whole sequence again: 1 + 2 + … + n.
export const positionsWithout = n => n * (n + 1) / 2;
export const positionsWith = n => n;

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
