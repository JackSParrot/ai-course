import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import english from '../i18n/en.js';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('the chapter 16 page says that its examples and figures are illustrations', async () => {
  const html = await read('memory/index.html');
  assert.match(html, /Ilustración: la conversación y las respuestas son inventadas/);
  assert.match(html, /las cifras son hipotéticas/);
  assert.match(html, /estimaciones a ojo/);
  // The three ideas to take away.
  for (const idea of ['Lo que no está en la mesa no existe.', 'Una mesa demasiado llena cuesta y estorba.', 'Con un mapa, se carga solo lo necesario.']) assert.ok(html.includes(idea), idea);
});

test('chapter 15 now leads to chapter 16', async () => {
  assert.match(await read('skills/index.html'), /href="\.\.\/memory\/"/);
});

test('every text of the chapter 16 page and its script has an English translation', async () => {
  const html = (await read('memory/index.html')).replace(/<script[\s\S]*?<\/script>/g, '').replace(/<code>[^<]*<\/code>/g, '<x>');
  const texts = [...html.matchAll(/>([^<]+)</g), ...html.matchAll(/(?:aria-label|title)="([^"]+)"/g)].map(m => m[1].trim()).filter(t => /[a-záéíóúñ]/i.test(t));
  const same = new Set(['neural /', 'labs']);
  for (const text of texts) if (!same.has(text)) assert.ok(Object.hasOwn(english, text), text);
  // say('…', '…') carries its own English: leave both halves out. File names stay as written.
  const app = (await read('memory/src/app.js')).replace(/say\(('[^']*'|`[^`]*`), ('[^']*'|`[^`]*`)\)/g, '');
  const strings = [...app.matchAll(/'([^'\n]*)'/g)].map(m => m[1].trim())
    .filter(t => /[a-záéíóúñ]{2}/i.test(t) && /\s|^[A-ZÁÉÍÓÚ¿«+=…📄]/.test(t) && !/\$\{|==|=>|^\.|\.md$|^[a-z-]+\.md/.test(t) && !/^[a-z-]+( [a-z-]+)*$/.test(t));
  assert.ok(strings.length > 100, String(strings.length));
  for (const text of strings) assert.ok(Object.hasOwn(english, text), text);
});
