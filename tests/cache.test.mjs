import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTransformer } from '../attention/src/transformer.js';
import { random } from '../tokens/src/corpus.js';
import english from '../i18n/en.js';
import { PRICES, BLOCKS, positionsWithout, positionsWith, compareDecoding, timeDecoding, promptCost, agentBill } from '../cache/src/cost.js';

test('the prices keep the ratios the page states: output 5×, cache write 1.25× and cache read 0.1× the input', () => {
  assert.equal(PRICES.output / PRICES.input, 5);
  assert.equal(PRICES.cacheWrite / PRICES.input, 1.25);
  assert.equal(PRICES.cacheRead / PRICES.input, 0.1);
  assert.equal(positionsWithout(1000), 500500);
  assert.equal(positionsWith(1000), 1000);
});

test('the chapter 09 transformer gives the same probabilities with and without the KV cache, with 32 positions instead of 528', () => {
  const rng = random(9), model = createTransformer({ vocabularySize: 64, length: 32 });
  const tokens = Array.from({ length: 32 }, () => Math.floor(rng() * 64));
  const result = compareDecoding(model, tokens);
  assert.equal(result.without, 528);
  assert.equal(result.withCache, 32);
  assert.ok(result.maxDifference < 1e-6, String(result.maxDifference));
  let clock = 0;
  const times = timeDecoding(model, tokens.slice(0, 4), 2, () => (clock += 10));
  assert.deepEqual(times, { without: 5, withCache: 5 });
});

test('changing only the question reuses almost everything; changing the start costs more than no cache at all', () => {
  const question = promptCost(BLOCKS, BLOCKS.length - 1);
  assert.equal(question.read, 54000); assert.equal(question.written, 200);
  assert.ok(question.plain / question.cached > 9, String(question.plain / question.cached));
  const start = promptCost(BLOCKS, 0);
  assert.equal(start.read, 0);
  assert.ok(Math.abs(start.cached - start.plain * 1.25) < 1e-12);
});

test('an agent with the default settings costs about six times less with the cache', () => {
  const bill = agentBill({ turns: 50, system: 20000, perTurn: 3000, output: 500 });
  assert.ok(Math.abs(bill.without[50] - 9.9) < 1e-9, String(bill.without[50]));
  assert.ok(Math.abs(bill.withCache[50] - 1.606) < 1e-9, String(bill.withCache[50]));
  // The first turn only writes, so it costs more; from then on the cache wins.
  assert.ok(bill.withCache[1] > bill.without[1]);
  for (let t = 2; t <= 50; t++) assert.ok(bill.withCache[t] < bill.without[t], String(t));
});

test('every text of the chapter 13 page and its scripts has an English translation', async () => {
  const html = (await readFile(new URL('../cache/index.html', import.meta.url), 'utf8')).replace(/<script[\s\S]*?<\/script>/g, '');
  const texts = [...html.matchAll(/>([^<]+)</g), ...html.matchAll(/(?:aria-label|title)="([^"]+)"/g)].map(m => m[1].trim()).filter(t => /[a-záéíóúñ]/i.test(t));
  const same = new Set(['neural /', 'labs', 'KV cache', 'prefill', 'decode', 'Prefill', 'Decode', 'K']);
  for (const text of texts) if (!same.has(text)) assert.ok(Object.hasOwn(english, text), text);
  const app = await readFile(new URL('../cache/src/app.js', import.meta.url), 'utf8');
  // Messages are the quoted strings with a space or a capital letter; code, paths and class names are left out.
  const strings = [...app.matchAll(/'([^'\n]*)'/g)].map(m => m[1].trim())
    .filter(t => /[a-záéíóúñ]{2}/i.test(t) && /\s|^[A-ZÁÉÍÓÚ¿]/.test(t) && !/[(){}[\]=/]|\$\{/.test(t) && !/^[a-z-]+( [a-z-]+)*$/.test(t) && !['El', 'KV cache'].includes(t));
  assert.ok(strings.length > 10, String(strings.length));
  for (const text of strings) assert.ok(Object.hasOwn(english, text), text);
  for (const block of BLOCKS) assert.ok(Object.hasOwn(english, block.name), block.name);
});
