// The shell game for chapter 11: where is the ball after six swaps?
// A reply either answers at once or first writes where the ball is after every swap.
import { random } from '../../tokens/src/corpus.js';

export const STOP = ' ⏹';
export const SWAPS = 6;
export const pairsFor = cups => Array.from({ length: cups }, (_, a) => Array.from({ length: cups - a - 1 }, (_, i) => [a + 1, a + i + 2])).flat();
export const move = (ball, [a, b]) => ball === a ? b : ball === b ? a : ball;
export function trace(start, swaps) { const steps = []; let ball = start; for (const swap of swaps) steps.push(ball = move(ball, swap)); return steps; }

export function game(start, swaps) {
  const steps = trace(start, swaps), ball = steps.at(-1);
  return {
    start, swaps, steps, ball,
    prompt: `Usuario: La bola está en el vaso ${start}. ${swaps.map(([a, b]) => `Cambio ${a} y ${b}.`).join(' ')} ¿Dónde está la bola? Asistente:`,
    direct: ` Está en el vaso ${ball}.${STOP}`,
    think: ` Pienso: ${start} ${steps.join(' ')}. Está en el vaso ${ball}.${STOP}`,
  };
}
// With many cups a random swap rarely touches the ball, and «the starting cup» would often be right.
// So half the swaps involve the ball's cup, never repeating the previous pair.
export function randomGame(rng, cups) {
  const all = pairsFor(cups), start = 1 + Math.floor(rng() * cups), swaps = [];
  let ball = start;
  for (let k = 0; k < SWAPS; k++) {
    let options = all;
    if (cups > 3) { const touch = rng() < 0.5; options = all.filter(p => (p[0] === ball || p[1] === ball) === touch && p !== swaps.at(-1)); }
    const pair = options[Math.floor(rng() * options.length)];
    swaps.push(pair); ball = move(ball, pair);
  }
  return game(start, swaps);
}
// Distinct games; the test games never appear in training.
export function buildGames({ cups = 3, train = 2000, test = 300, seed = 5 } = {}) {
  const rng = random(seed), seen = new Map(), limit = cups * pairsFor(cups).length ** SWAPS;
  let guard = 0;
  while (seen.size < Math.min(train + test, limit) && guard++ < 50000) { const g = randomGame(rng, cups); seen.set(g.prompt, g); }
  const list = [...seen.values()], cut = Math.round(list.length * test / (train + test));
  return { cups, test: list.slice(0, cut), train: list.slice(cut) };
}

// Reads a reply: the final cup, the written steps and whether every step was right.
export function grade(reply, g) {
  const final = Number([...reply.matchAll(/Está en el vaso (\d)\./g)].map(m => m[1]).at(-1));
  const written = (reply.match(/Pienso: ([\d ]+)\./) || [, ''])[1].trim().split(' ').map(Number);
  const steps = written.slice(1);
  return {
    correct: final === g.ball,
    chain: written.length === SWAPS + 1 && written[0] === g.start && steps.every((s, i) => s === g.steps[i]),
    thinks: reply.startsWith(' Pienso:'),
    stops: reply.trim().endsWith('⏹'),
  };
}
