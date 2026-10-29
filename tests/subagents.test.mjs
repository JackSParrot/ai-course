import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import english from '../i18n/en.js';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('the chapter 17 page says that its examples and figures are illustrations', async () => {
  const html = await read('subagents/index.html');
  assert.match(html, /Ilustración: el encargo y los tamaños son inventados/);
  assert.match(html, /Ilustración: tamaños inventados/);
  assert.match(html, /Perfiles y precios inventados/);
  // The three ideas to take away.
  for (const idea of ['Un sub-agente es una misión con su propia mesa.', 'Cada tarea, con quien mejor la haga.', 'Una mesa despejada aguanta más.']) assert.ok(html.includes(idea), idea);
});

test('every text of the chapter 17 page and its script has an English translation', async () => {
  const html = (await read('subagents/index.html')).replace(/<script[\s\S]*?<\/script>/g, '').replace(/<code>[^<]*<\/code>/g, '<x>');
  const texts = [...html.matchAll(/>([^<]+)</g), ...html.matchAll(/(?:aria-label|title)="([^"]+)"/g)].map(m => m[1].trim()).filter(t => /[a-záéíóúñ]/i.test(t));
  const same = new Set(['neural /', 'labs']);
  for (const text of texts) if (!same.has(text)) assert.ok(Object.hasOwn(english, text), text);
  // say('…', '…') carries its own English: leave both halves out.
  const app = (await read('subagents/src/app.js')).replace(/say\(('[^']*'|`[^`]*`), ('[^']*'|`[^`]*`)\)/g, '');
  const strings = [...app.matchAll(/'([^'\n]*)'/g)].map(m => m[1].trim())
    .filter(t => /[a-záéíóúñ]{2}/i.test(t) && /\s|^[A-ZÁÉÍÓÚ¿«¡]/.test(t) && !/\$\{|==|=>|^\./.test(t) && !/^[a-z-]+( [a-z-]+)*$/.test(t));
  assert.ok(strings.length > 80, String(strings.length));
  for (const text of strings) assert.ok(Object.hasOwn(english, text), text);
});

test('the long-run figures follow from the per-step sizes', async () => {
  // 20.000 to start, 60.000 per step alone and 10.000 with helpers: half the desk by step 9 and step 49.
  const app = await read('subagents/src/app.js');
  assert.match(app, /const BASE = 20_000/);
  for (const size of ['30_000', '5_000', '20_000', '2_000', '1_000']) assert.ok(app.includes(size), size);
});
