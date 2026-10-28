import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import english from '../i18n/en.js';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('the chapter 15 page says that its examples and results are illustrations', async () => {
  const html = await read('skills/index.html');
  assert.match(html, /Ilustración: la agencia Brújula y sus skills son inventadas/);
  assert.match(html, /Ilustración: los pasos y las respuestas están escritos para mostrar la idea, no grabados/);
  assert.match(html, /Ilustración: lo que «piensa» el modelo y lo que hace son un guion escrito para mostrar la idea, no una medida/);
  assert.match(html, /Ilustración: los pasos, lo que contesta el servidor y la respuesta final están escritos a mano/);
  assert.match(html, /inventados como ilustración/);
  // No recordings, tries or measured counts are presented any more.
  assert.doesNotMatch(html, /grabaci|grabad[oa]s? (el|con)|10 intentos|de 10\b|Claude Code 2\.|Gamescom/i);
  for (const idea of ['El modelo ve un menú, no los manuales.', 'La etiqueta decide si se usa.', 'Una skill enseña a saber. MCP deja hacer.']) assert.ok(html.includes(idea), idea);
});

test('the script holds its own hand-written data and imports no recording', async () => {
  const app = await read('skills/src/app.js');
  assert.doesNotMatch(app, /session\.js|grabaci|Gamescom|GSC-/i);
  // The four ways of labelling the policy, from a clear label to no hint at all.
  for (const odds of ['Siempre, y lo primero', 'Casi siempre, pero tarde', 'A veces', 'Es lotería']) assert.ok(app.includes(`'${odds}'`), odds);
  // The totals of the illustration add up: the receipts minus the tips and the leisure over the cap.
  assert.equal(Math.round((3616.36 - 9.10 - 4) * 100) / 100, 3603.26);
  assert.ok(app.includes('3.603,26 €') && app.includes('3.616,36 €'));
});

test('chapter 15 leads to chapter 16', async () => {
  assert.match(await read('skills/index.html'), /href="\.\.\/memory\/"/);
});

test('every text of the chapter 15 page and its script has an English translation', async () => {
  const html = (await read('skills/index.html')).replace(/<script[\s\S]*?<\/script>/g, '').replace(/<code>[^<]*<\/code>/g, '<x>');
  const texts = [...html.matchAll(/>([^<]+)</g), ...html.matchAll(/(?:aria-label|title)="([^"]+)"/g)].map(m => m[1].trim()).filter(t => /[a-záéíóúñ]/i.test(t));
  const same = new Set(['neural /', 'labs', 'MCP']);
  for (const text of texts) if (!same.has(text)) assert.ok(Object.hasOwn(english, text), text);
  // say('…', '…') carries its own English: leave both halves out. Names, files and the folder tree stay as written.
  const app = (await read('skills/src/app.js')).replace(/say\(\s*('[^']*'|`[^`]*`),\s*('[^']*'|`[^`]*`)\)/g, '');
  const strings = [...app.matchAll(/'([^'\n]*)'/g)].map(m => m[1].trim())
    .filter(t => /[a-záéíóúñ]{2}/i.test(t) && /\s|^[A-ZÁÉÍÓÚ¿«+=…↓?]/.test(t) && !/\$\{|==|=>|^\.|\.md$|\.py$|_|\/$/.test(t)
      && !/^[a-z-]+( [a-z-]+)*$/.test(t) && !/^[├│└]/.test(t));
  assert.ok(strings.length > 60, String(strings.length));
  for (const text of strings) assert.ok(Object.hasOwn(english, text), text);
});
