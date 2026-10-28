import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import english from '../i18n/en.js';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('the chapter 12 page says that its shop, prices, answers and documents are illustrations', async () => {
  const html = await read('tools/index.html');
  assert.match(html, /Ilustración: la papelería, sus productos, los precios y las respuestas son inventados/);
  assert.match(html, /Ilustración: las respuestas están escritas a mano/);
  assert.match(html, /Ilustración: la página, las reseñas y las respuestas son inventadas/);
  assert.match(html, /Ilustración: la carpeta y los documentos son inventados/);
  // The three ideas to take away.
  for (const idea of ['La herramienta da acceso, no inteligencia.', 'Una llamada es texto, y se cree lo que vuelve.', 'Un agente es un bucle.']) assert.ok(html.includes(idea), idea);
});

test('chapter 12 shows instead of training: no worker, no training run, no game examples', async () => {
  const html = await read('tools/index.html'), app = await read('tools/src/app.js');
  assert.doesNotMatch(app, /new Worker|import .*training|import .*transformer/);
  assert.doesNotMatch(html + app, /Entrenar|Tarda unos|enemig|mazmorra|bestiario|parche|game loop|vidas/i);
  for (const gone of ['tools/src/worker.js', 'tools/src/training.js', 'tools/src/bestiary.js']) await assert.rejects(access(new URL('../' + gone, import.meta.url)), gone);
  // Three step-by-step explainers plus the memory-versus-tool one.
  assert.equal((html.match(/class="explainer"/g) || []).length, 4);
});

test('chapter 11 still leads to chapter 12, and chapter 12 to chapter 13', async () => {
  assert.match(await read('reasoning/index.html'), /href="\.\.\/tools\/"/);
  assert.match(await read('tools/index.html'), /href="\.\.\/cache\/"/);
});

test('every text of the chapter 12 page and its script has an English translation', async () => {
  const html = (await read('tools/index.html')).replace(/<script[\s\S]*?<\/script>/g, '').replace(/<code>[^<]*<\/code>/g, '<x>');
  const texts = [...html.matchAll(/>([^<]+)</g), ...html.matchAll(/(?:aria-label|title)="([^"]+)"/g)].map(m => m[1].trim()).filter(t => /[a-záéíóúñ]/i.test(t));
  const same = new Set(['neural /', 'labs']);
  for (const text of texts) if (!same.has(text)) assert.ok(Object.hasOwn(english, text), text);
  // say('…', '…') and ['…', '…'] pairs carry their own English: leave both halves out.
  // Calls, paths and file names stay as written, like the text the model reads.
  const app = (await read('tools/src/app.js'))
    .replace(/say\(('[^']*'|`[^`]*`), ('[^']*'|`[^`]*`)\)/g, '')
    .replace(/\[('[^']*'|`[^`]*`), ('[^']*'|`[^`]*`)\]/g, '');
  const kept = new Set(['«strawberry»', 'contar(texto, "r")']);
  const strings = [...app.matchAll(/'([^'\n]*)'/g)].map(m => m[1].trim())
    .filter(t => /[a-záéíóúñ]{2}/i.test(t) && /\s|^[A-ZÁÉÍÓÚ¿«+=…↺]/.test(t) && !/\$\{|==|=>|^\.|\/$|\.txt$/.test(t) && !/^[a-z-]+( [a-z-]+)*$/.test(t) && !kept.has(t));
  assert.ok(strings.length > 60, String(strings.length));
  for (const text of strings) assert.ok(Object.hasOwn(english, text), text);
  // Short labels the filter above leaves out.
  for (const text of ['nuevo', 'Cliente', 'Asistente', 'Tú', 'Programa']) assert.ok(Object.hasOwn(english, text), text);
});
