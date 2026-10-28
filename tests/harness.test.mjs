import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import english from '../i18n/en.js';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('the chapter 14 page says that its examples and answers are illustrations', async () => {
  const html = await read('harness/index.html');
  assert.match(html, /Ilustración: la petición está simplificada/);
  assert.match(html, /Ilustración: los tickets, las respuestas y las cifras son inventados/);
  assert.match(html, /Ilustración: las tres respuestas son ejemplos escritos para este capítulo/);
  assert.match(html, /<footer>.*inventados como ilustración/);
  // No recording metadata and no experiment grid: the page shows, it does not measure.
  assert.doesNotMatch(html, /grabad|Claude Code 2\.|23 intentos|repeat-rows/i);
  for (const idea of ['Un modelo solo escribe texto.', 'El arnés hace lo que el modelo pide.', 'Del chat al agente cambia el programa, no el modelo.']) assert.ok(html.includes(idea), idea);
});

test('the trip is to a neutral trade fair, not a video-game fair', async () => {
  for (const path of ['harness/index.html', 'harness/src/app.js']) assert.doesNotMatch(await read(path), /gamescom/i, path);
  const block = (await read('i18n/tokens.js')).split('// Chapter 14 (harness)')[1].split('// Chapter 15')[0];
  assert.doesNotMatch(block, /gamescom/i);
});

test('the category totals add up to the total of the 40 receipts', async () => {
  const app = await read('harness/src/app.js');
  const totals = [...app.match(/const TOTALS = (\[.*\]);/)[1].matchAll(/\['[^']+', (\d+), ([\d.]+)\]/g)].map(m => [Number(m[1]), Number(m[2])]);
  assert.equal(totals.reduce((sum, [count]) => sum + count, 0), 40);
  assert.equal(Math.round(totals.reduce((sum, [, value]) => sum + value, 0) * 100), 361636);
});

test('every text of the chapter 14 page and its script has an English translation', async () => {
  const html = (await read('harness/index.html')).replace(/<script[\s\S]*?<\/script>/g, '');
  const texts = [...html.matchAll(/>([^<]+)</g), ...html.matchAll(/(?:aria-label|title)="([^"]+)"/g)].map(m => m[1].trim()).filter(t => /[a-záéíóúñ]/i.test(t));
  const same = new Set(['neural /', 'labs', 'harness', '(en inglés,', 'Claude, ChatGPT, Gemini', 'Cursor, GitHub Copilot']);
  for (const text of texts) if (!same.has(text)) assert.ok(Object.hasOwn(english, text), text);
  // say('…', '…') carries its own English: leave both halves out. Code, file names and class names stay as written.
  const app = (await read('harness/src/app.js')).replace(/say\(('[^']*'|`[^`]*`),\s*('[^']*'|`[^`]*`)\)/g, '');
  const strings = [...app.matchAll(/'([^'\n]*)'/g)].map(m => m[1].trim())
    .filter(t => /[a-záéíóúñ]{2}/i.test(t) && /\s|^[A-ZÁÉÍÓÚ¿«+✗✓↺=⏳]/.test(t) && !/[(){}[\]/]|\$\{|==/.test(t) && !/^[a-z-]+( [a-z-]+)*$/.test(t)
      && !['Read', 'Write', 'Glob', 'Grep', 'Bash'].includes(t));
  assert.ok(strings.length > 60, String(strings.length));
  for (const text of strings) assert.ok(Object.hasOwn(english, text), text);
  // The comments of the code in section 06 are translated one by one.
  const comments = [...app.matchAll(/^ +\/\/ (\d\. .+)$/gm)].map(m => m[1]);
  assert.equal(comments.length, 5);
  for (const text of comments) assert.ok(Object.hasOwn(english, text), text);
});
