import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import english from '../i18n/en.js';
import { LEVELS, RUNS } from '../effort/src/data.js';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('the chapter 18 page says what is measured and what is invented, and cites its sources', async () => {
  const html = await read('effort/index.html');
  assert.match(html, /La panadería y sus facturas son inventadas/);
  assert.match(html, /Medido el 1 de noviembre de 2026 con <code>claude-opus-5-5<\/code>/);
  assert.match(html, /Fuentes: documentación de Claude Code/);
  for (const idea of ['El modelo es lo que sabe; el esfuerzo, cuánto trabaja.', 'Lo sencillo no mejora con más esfuerzo.', 'Más esfuerzo compra comprobaciones, no otra respuesta.']) assert.ok(html.includes(idea), idea);
});

test('every text of the chapter 18 page has an English translation, and its script carries its own', async () => {
  const html = (await read('effort/index.html')).replace(/<script[\s\S]*?<\/script>/g, '').replace(/<code>[^<]*<\/code>/g, '<x>');
  const texts = [...html.matchAll(/>([^<]+)</g), ...html.matchAll(/(?:aria-label|title)="([^"]+)"/g)].map(m => m[1].trim()).filter(t => /[a-záéíóúñ]/i.test(t));
  const same = new Set(['neural /', 'labs']);
  for (const text of texts) if (!same.has(text)) assert.ok(Object.hasOwn(english, text), text);
  const app = (await read('effort/src/app.js')).replace(/say\(('[^'\\]*(?:\\.[^'\\]*)*'|`[^`]*`), ('[^'\\]*(?:\\.[^'\\]*)*'|`[^`]*`)\)/g, '');
  const loose = [...app.matchAll(/'([^'\n]*)'/g)].map(m => m[1]).filter(t => /[a-záéíóúñ]{3,}\s+[a-záéíóúñ]{2,}/i.test(t) && !/\$\{|=>/.test(t) && !/^[a-z-]+( [a-z-]+)*$/.test(t));
  assert.deepEqual(loose, []);
});

test('the measurements cover every task at every level, with the planned repetitions', () => {
  const reps = { explicar: 3, tabla: 2, informe: 1 };
  for (const [task, n] of Object.entries(reps)) for (const effort of LEVELS) assert.equal(RUNS.filter(r => r.task === task && r.effort === effort).length, n, `${task} ${effort}`);
  for (const run of RUNS) for (const key of ['seconds', 'usd', 'turns', 'output', 'thinking']) assert.ok(run[key] > 0, `${run.task} ${run.effort} ${key}`);
});

test('the page text agrees with the measurements it quotes', () => {
  const runs = (task, effort) => RUNS.filter(r => r.task === task && r.effort === effort);
  // «Las 15 ejecuciones vieron el error de la luz»
  assert.ok(RUNS.filter(r => r.task === 'explicar').every(r => r.caught));
  // «De medium hacia arriba, todas lo vieron»; low lo pasó por alto en una tabla y en el informe.
  for (const effort of LEVELS.slice(1)) for (const task of ['tabla', 'informe']) assert.ok(runs(task, effort).every(r => r.caught), `${task} ${effort}`);
  assert.equal(runs('tabla', 'low').filter(r => !r.caught).length, 1);
  assert.equal(runs('informe', 'low')[0].caught, false);
  // «el de max tardó 43 minutos»
  assert.equal(Math.round(runs('informe', 'max')[0].seconds / 60), 43);
});
