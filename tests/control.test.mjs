import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import english from '../i18n/en.js';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('the chapter 18 page says that its examples are illustrations and cites its sources', async () => {
  const html = await read('control/index.html');
  assert.match(html, /Ilustración: la tienda, los archivos y lo que hace el agente están escritos a mano/);
  assert.match(html, /Ilustración: el correo, la dirección y lo que hace el agente son inventados/);
  assert.match(html, /Fuentes: documentación de Claude Code/);
  for (const idea of ['Las instrucciones sugieren; el arnés obliga.', 'Lo prohibido gana siempre.', 'Lo que lee puede traer órdenes, y lo que lee sale de casa.']) assert.ok(html.includes(idea), idea);
});

test('every text of the chapter 18 page has an English translation, and its script carries its own', async () => {
  const html = (await read('control/index.html')).replace(/<script[\s\S]*?<\/script>/g, '').replace(/<code>[^<]*<\/code>/g, '<x>');
  const texts = [...html.matchAll(/>([^<]+)</g), ...html.matchAll(/(?:aria-label|title)="([^"]+)"/g)].map(m => m[1].trim()).filter(t => /[a-záéíóúñ]/i.test(t));
  const same = new Set(['neural /', 'labs']);
  for (const text of texts) if (!same.has(text)) assert.ok(Object.hasOwn(english, text), text);
  const app = (await read('control/src/app.js')).replace(/say\(('[^'\\]*(?:\\.[^'\\]*)*'|`[^`]*`), ('[^'\\]*(?:\\.[^'\\]*)*'|`[^`]*`)\)/g, '');
  const loose = [...app.matchAll(/'([^'\n]*)'/g)].map(m => m[1]).filter(t => /[a-záéíóúñ]{3,}\s+[a-záéíóúñ]{2,}/i.test(t) && !/\$\{|=>/.test(t) && !/^[a-z-]+( [a-z-]+)*$/.test(t));
  assert.deepEqual(loose, []);
});

test('no new English key is a single short word that the fragment translator could misuse', () => {
  // Short keys are matched inside other texts: «red» would turn «la red» into «the safety net».
  for (const key of ['red', 'y', 'En', 'modo', 'Trabaja', 'En la mesa', 'Casi siempre']) assert.ok(!Object.hasOwn(english, key), key);
});

test('a forbidden rule is forbidden in every mode', async () => {
  const app = await read('control/src/app.js');
  assert.match(app, /modes: \{ manual: 'deny', edits: 'deny', plan: 'deny', auto: 'deny', bypass: 'deny' \}/);
});
