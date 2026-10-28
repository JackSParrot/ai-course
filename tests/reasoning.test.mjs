import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import english from '../i18n/en.js';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('the chapter 11 page says that its answers, scores and curves are illustrations', async () => {
  const html = await read('reasoning/index.html');
  assert.match(html, /Ilustración: las respuestas están escritas a mano/);
  assert.match(html, /Ilustración: cifras hipotéticas y redondeadas/);
  assert.match(html, /Ilustración: curvas hipotéticas/);
  assert.match(html, /Ilustración: recuento aproximado/);
  assert.match(html, /Ilustración: la partida y las respuestas están inventadas/);
  // No live training any more: no worker, no waiting.
  assert.doesNotMatch(html, /Tarda unos|Entrenar los dos modelos/);
  assert.doesNotMatch(await read('reasoning/src/app.js'), /new Worker|import .*training/);
  for (const idea of ['Cada token, una pasada.', 'Escribir los pasos parte el problema.', 'Se aprende premiando lo comprobable.']) assert.ok(html.includes(idea), idea);
  assert.match(html, /href="\.\.\/tools\/"/);
});

test('every text of the chapter 11 page and its script has an English translation', async () => {
  const html = (await read('reasoning/index.html')).replace(/<script[\s\S]*?<\/script>/g, '').replace(/<code>[^<]*<\/code>/g, '<x>');
  const texts = [...html.matchAll(/>([^<]+)</g), ...html.matchAll(/(?:aria-label|title)="([^"]+)"/g)].map(m => m[1].trim()).filter(t => /[a-záéíóúñ]/i.test(t));
  const same = new Set(['neural /', 'labs']);
  for (const text of texts) if (!same.has(text)) assert.ok(Object.hasOwn(english, text), text);
  // say('…', '…') carries its own English: leave both halves out.
  const app = (await read('reasoning/src/app.js')).replace(/say\((?:'[^']*'|`[^`]*`),\s*(?:'[^']*'|`[^`]*`)\)/g, '');
  const strings = [...app.matchAll(/'([^'\n]*)'/g)].map(m => m[1].trim())
    .filter(t => /[a-záéíóúñ]{2}/i.test(t) && /\s|^[A-ZÁÉÍÓÚ¿«]/.test(t) && !/\$\{|==|=>|^\./.test(t) && !/^[a-z-]+( [a-z-]+)*$/.test(t));
  assert.ok(strings.length > 50, String(strings.length));
  for (const text of strings) assert.ok(Object.hasOwn(english, text), text);
});
