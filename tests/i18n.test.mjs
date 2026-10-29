import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolveLanguage, translateText, setLanguage, getLanguage, getLocale } from '../i18n/i18n.js';

test('valid link language takes priority over the saved preference; Spanish is the fallback', () => {
  assert.equal(resolveLanguage('?lang=en', 'es'), 'en');
  assert.equal(resolveLanguage('?lang=es', 'en'), 'es');
  assert.equal(resolveLanguage('?lang=fr', 'en'), 'en');
  assert.equal(resolveLanguage('?lang=fr', 'invalid'), 'es');
  assert.equal(resolveLanguage('', null), 'es');
});
test('static and generated messages translate while retaining numbers, whitespace and unknown text', () => {
  assert.equal(translateText('  Editor de imágenes\n', 'en'), '  Image editor\n');
  assert.equal(translateText('La suma es −0.25. Como z < 0, la salida es 0.', 'en'), 'The sum is −0.25. Since z < 0, the output is 0.');
  assert.equal(translateText('4 de 4 correctos', 'en'), '4 of 4 correct');
  assert.equal(translateText('CAPÍTULO 02 / 03', 'en'), 'CHAPTER 02 / 03');
  assert.equal(translateText('Peso w₁', 'es'), 'Peso w₁');
  assert.equal(translateText('custom_identifier_de_123', 'en'), 'custom_identifier_de_123');
  assert.equal(translateText('model.weight = 0.125', 'en'), 'model.weight = 0.125');
  assert.equal(translateText('suma', 'en'), 'sum');
  assert.equal(translateText('sumatorio', 'en'), 'sumatorio');
});
test('language changes work without browser storage and invalid language changes are ignored', () => {
  setLanguage('en');
  assert.equal(getLanguage(), 'en');
  assert.equal(getLocale(), 'en-GB');
  assert.equal(translateText('Entrenamiento'), 'Training');
  setLanguage('fr');
  assert.equal(getLanguage(), 'en');
  setLanguage('es');
  assert.equal(getLocale(), 'es-ES');
  assert.equal(translateText('Entrenamiento'), 'Entrenamiento');
});
test('one shared locale runtime and catalog are published on every existing page', async () => {
  const manifest = JSON.parse(await readFile(new URL('../publication-manifest.json', import.meta.url)));
  for (const path of ['index.html', 'perceptrons/index.html', 'digits/index.html', 'maze/index.html', 'cars/index.html', 'autoencoder/index.html', 'superresolution/index.html', 'tokens/index.html', 'predictor/index.html', 'attention/index.html', 'assistant/index.html', 'reasoning/index.html', 'tools/index.html', 'cache/index.html', 'harness/index.html', 'skills/index.html', 'memory/index.html', 'subagents/index.html']) {
    const html = await readFile(new URL('../public/' + path, import.meta.url), 'utf8');
    assert.match(html, /i18n\/dom\.js\?v=[a-f0-9]{12}/);
    assert.match(html, /i18n\/language\.css\?v=[a-f0-9]{12}/);
  }
  const dom = await readFile(new URL('../public/i18n/dom.js', import.meta.url), 'utf8');
  const version = dom.match(/i18n\.js\?v=([a-f0-9]{12})/)[1];
  for (const path of ['perceptrons/lesson.js', 'digits/src/view.js', 'cars/src/renderer.js', 'cars/src/training-chart.js', 'cars/src/map-editor.js']) {
    assert.ok((await readFile(new URL('../public/' + path, import.meta.url), 'utf8')).includes('i18n.js?v=' + version), path);
  }
  assert.ok(manifest.files['/i18n/en.js']);
  assert.ok(!Object.keys(manifest.files).some(path => /^\/(en|es)\//.test(path)));
});
