import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import english from '../i18n/en.js';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('the chapter 19 page says that its examples are illustrations and closes the course', async () => {
  const html = await read('practice/index.html');
  assert.match(html, /Ilustración: la tienda, los archivos y lo que hace el agente están escritos a mano/);
  assert.match(html, /Ilustración: los productos, los precios y los cambios son inventados/);
  assert.match(html, /FIN DEL CURSO/);
  assert.match(html, /href="\.\.\/" class="button primary"/);
  // The three ideas to take away.
  for (const idea of ['Un buen encargo dice dónde, cuándo está hecho y qué no tocar.', 'Plan antes, prueba después.', 'Lo que se puede deshacer, se puede delegar.']) assert.ok(html.includes(idea), idea);
});

test('chapter 17 leads to 18 and 18 to 19, and no chapter promises talks that will not come', async () => {
  assert.match(await read('subagents/index.html'), /href="\.\.\/control\/"/);
  assert.match(await read('control/index.html'), /href="\.\.\/practice\/"/);
  for (const path of ['tools/index.html', 'cache/index.html', 'subagents/index.html', 'control/index.html', 'practice/index.html']) {
    const html = await read(path);
    assert.doesNotMatch(html, /próximas charlas|ejecutemos modelos en local/, path);
  }
});

test('every text of the chapter 19 page has an English translation, and its script carries its own', async () => {
  const html = (await read('practice/index.html')).replace(/<script[\s\S]*?<\/script>/g, '').replace(/<code>[^<]*<\/code>/g, '<x>');
  const texts = [...html.matchAll(/>([^<]+)</g), ...html.matchAll(/(?:aria-label|title)="([^"]+)"/g)].map(m => m[1].trim()).filter(t => /[a-záéíóúñ]/i.test(t));
  const same = new Set(['neural /', 'labs']);
  for (const text of texts) if (!same.has(text)) assert.ok(Object.hasOwn(english, text), text);
  // Every sentence in the script goes through say('…', '…') with its English beside it.
  const app = (await read('practice/src/app.js')).replace(/say\(('[^'\\]*(?:\\.[^'\\]*)*'|`[^`]*`), ('[^'\\]*(?:\\.[^'\\]*)*'|`[^`]*`)\)/g, '');
  const loose = [...app.matchAll(/'([^'\n]*)'/g)].map(m => m[1]).filter(t => /[a-záéíóúñ]{3,}\s+[a-záéíóúñ]{2,}/i.test(t) && !/\$\{|=>/.test(t) && !/^[a-z-]+( [a-z-]+)*$/.test(t));
  assert.deepEqual(loose, []);
});

test('the review exercise has exactly three faults', async () => {
  const app = await read('practice/src/app.js');
  assert.equal((app.match(/wrong: true/g) || []).length, 3);
});
