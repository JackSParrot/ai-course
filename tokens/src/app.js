import { buildCorpus, joinText, DEMO_CORPUS } from './corpus.js';
import { BpeTrainer, characterPieces, wordPieces, chunks } from './bpe.js';
import { $, element, fmt, css, reducedMotion, tokenElement, renderStrip, drawChart, Stepper } from './ui.js';

const VOCABULARY_SIZE = 600, CONTEXT_WINDOW = 32;

// The course tokenizer is trained once from the template corpus.
const corpus = buildCorpus();
const trainText = joinText(corpus.train);
const tokenizer = new BpeTrainer(trainText).train(VOCABULARY_SIZE).tokenizer();
const characterVocabulary = new Set(characterPieces(trainText)), wordVocabulary = new Set(wordPieces(trainText));
const chips = (pieces, options = () => ({})) => element('div', 'token-strip', ...pieces.map((text, i) => tokenElement(text, options(text, i))));

// Outlines a pair about to be merged, and marks a freshly merged piece, wherever they appear.
function markPair(strip, pieces, pair, fresh) {
  [...strip.children].forEach((chip, i) => {
    if (fresh && pieces[i] === fresh) chip.classList.add('fresh', 'merged');
    if (pair && ((pieces[i] === pair.a && pieces[i + 1] === pair.b) || (pieces[i - 1] === pair.a && pieces[i] === pair.b))) chip.classList.add('seen');
  });
  return strip;
}

// ---------- Introduction ----------
const heroText = 'El coche rojo gira';
renderStrip($('route-tokens'), tokenizer.pieces(heroText).map(text => ({ text })));
$('route-ids').textContent = tokenizer.encode(heroText).join(' · ');

// ---------- 01 · What a tokenizer does ----------
function pipelineSteps() {
  const text = $('pipeline-input').value || ' ', words = chunks(text), pieces = tokenizer.pieces(text), ids = tokenizer.encode(text), decoded = tokenizer.decode(ids);
  const idList = () => element('code', 'id-list', '[' + ids.join(', ') + ']');
  return [
    { stage: 1, title: 'Partimos de texto', caption: 'Para nosotros es una frase. Para la red todavía no es nada: solo sabe sumar y multiplicar números.', render: () => element('div', 'big-text', text) },
    { stage: 2, title: 'Se separa en palabras y signos', caption: 'Primero se corta por espacios y signos de puntuación. Cada espacio se queda pegado a la palabra que va detrás: lo verás como un punto (·).', render: () => chips(words, () => ({ className: 'word' })) },
    {
      stage: 3, title: 'Cada palabra se parte en piezas conocidas', caption: 'Después, cada palabra se busca en el vocabulario. Las frecuentes son una sola pieza. Las raras se forman con varias piezas más pequeñas, así que nunca hay palabras desconocidas.',
      render: () => element('div', 'split-list', ...words.map(word => {
        const parts = tokenizer.splitChunk(word);
        return element('div', 'split-line' + (parts.length > 1 ? ' several' : ''), tokenElement(word, { className: 'word' }), element('span', 'arrow', '→'), chips(parts));
      })),
    },
    { stage: 4, title: 'Cada pieza se cambia por su número', caption: 'Cada pieza tiene un número fijo en el vocabulario, como el número de página de un diccionario. Esta lista de números es lo único que recibe la red.', render: () => element('div', 'stack', chips(pieces, (_, i) => ({ small: ids[i] })), idList()) },
    { stage: 5, title: 'Y el camino de vuelta', caption: 'Para escribir, la red devuelve números de token. El tokenizador junta sus piezas y recupera el texto exacto, letra por letra y espacio por espacio.', render: () => element('div', 'stack decode', idList(), element('span', 'arrow', '↓'), element('div', 'big-text', decoded), element('span', 'check', decoded === text ? '✓ Mismo texto' : '')) },
  ];
}
const pipeline = new Stepper($('pipeline-explainer'), pipelineSteps);
$('pipeline-input').addEventListener('input', () => pipeline.refresh());

// ---------- 02 · Three ways to split ----------
const splitModes = {
  chars: { pieces: text => characterPieces(text), vocabulary: characterVocabulary.size, unknown: piece => !characterVocabulary.has(piece) },
  words: { pieces: text => wordPieces(text), vocabulary: wordVocabulary.size, unknown: piece => !wordVocabulary.has(piece) },
  bpe: { pieces: text => tokenizer.pieces(text), vocabulary: tokenizer.size, unknown: () => false },
};
function renderSplit() {
  const text = $('split-input').value;
  for (const row of document.querySelectorAll('.split-row')) {
    const mode = splitModes[row.dataset.mode], pieces = mode.pieces(text);
    renderStrip(row.querySelector('.token-strip'), pieces.map(piece => ({ text: piece, className: mode.unknown(piece) ? 'unknown' : '' })));
    row.querySelector('[data-stat=pieces]').textContent = fmt(pieces.length);
    row.querySelector('[data-stat=vocabulary]').textContent = fmt(mode.vocabulary);
    row.querySelector('[data-stat=unknown]').textContent = fmt(pieces.filter(mode.unknown).length);
  }
}
$('split-input').addEventListener('input', renderSplit);
for (const chip of document.querySelectorAll('.example-chips .chip')) chip.addEventListener('click', () => { $('split-input').value = chip.dataset.text; renderSplit(); });

// ---------- 03 · How BPE learns, told with four words ----------
const STORY = 'gato gata gatos gatas', STORY_MERGES = 4;
function pairBars(pairs) {
  const max = pairs[0]?.count || 1;
  return element('div', 'pair-bars', element('span', 'vocab-label', 'Parejas vecinas y cuántas veces aparecen'), ...pairs.map((p, i) => {
    const fill = element('span'); fill.style.width = p.count / max * 100 + '%';
    return element('div', 'pair-bar' + (i ? '' : ' best'), element('span', 'pair', tokenElement(p.a), '+', tokenElement(p.b)), element('span', 'fill', fill), element('span', 'value', fmt(p.count)));
  }));
}
function bpeSteps() {
  const trainer = new BpeTrainer(STORY), steps = [];
  // Each view is built at its moment in training and cloned when shown.
  const words = (pair, fresh) => element('div', 'word-rows', ...chunks(STORY).map(word => {
    const pieces = trainer.tokenizer().splitChunk(word);
    return markPair(chips(pieces), pieces, pair, fresh);
  }));
  const vocabulary = fresh => element('div', 'vocab-row', element('span', 'vocab-label', 'Vocabulario'),
    ...trainer.chars.concat(trainer.merges.map(m => m.token)).map(piece => tokenElement(piece, { className: piece === fresh ? 'fresh merged' : '' })));
  const frozen = node => () => node.cloneNode(true);
  steps.push({ stage: 1, title: 'Empezamos con letras sueltas', caption: 'Cada letra es una pieza, también el espacio (·). El vocabulario inicial son solo las letras que aparecen en el texto.', render: frozen(element('div', 'bpe-story', words(), vocabulary())) });
  for (let k = 1; k <= STORY_MERGES; k++) {
    const pairs = trainer.topPairs(4), best = pairs[0];
    steps.push({
      stage: k === 1 ? 2 : 4, title: k === 1 ? 'Contamos las parejas vecinas' : `Repetimos: contar otra vez (fusión ${k})`,
      caption: ['La pareja más frecuente es ', tokenElement(best.a), ' + ', tokenElement(best.b), ` (${fmt(best.count)} veces).`],
      render: frozen(element('div', 'bpe-story', words(best), pairBars(pairs))),
    });
    const merge = trainer.step();
    steps.push({
      stage: k === 1 ? 3 : 4, title: k === 1 ? 'Fusionamos la más frecuente' : `Fusionamos otra vez (fusión ${k})`,
      caption: ['Nueva pieza: ', tokenElement(merge.token), '. Se añade al vocabulario y sustituye a la pareja en todas las palabras.'],
      render: frozen(element('div', 'bpe-story', words(null, merge.token), vocabulary(merge.token))),
    });
  }
  const order = element('ol', 'merge-list', ...trainer.merges.map(m => element('li', '', tokenElement(m.a), ' + ', tokenElement(m.b), ' → ', tokenElement(m.token))));
  steps.push({ stage: 5, title: 'El resultado: una lista de fusiones', caption: 'El tokenizador entrenado es esta lista ordenada. Para trocear un texto nuevo se aplican las mismas fusiones en el mismo orden. Con textos reales se repite miles de veces.', render: frozen(element('div', 'bpe-story', words(), order)) });
  return steps;
}
new Stepper($('bpe-explainer'), bpeSteps);

// ---------- 04 · Build a tokenizer yourself ----------
let demo, demoHistory, demoTop = null, autoTimer = 0;
function resetDemo() {
  stopAuto(); demo = new BpeTrainer(DEMO_CORPUS); demoHistory = [demo.tokenCount()]; demoTop = null;
  $('bpe-status').textContent = 'Cada letra empieza siendo una pieza. Cuenta las parejas para ver cuál se repite más.';
  $('bpe-pairs').replaceChildren(); $('bpe-pairs-empty').hidden = false;
  renderDemo();
}
function renderDemo() {
  const demoTokenizer = demo.tokenizer();
  $('bpe-corpus').replaceChildren(...chunks(DEMO_CORPUS).flatMap(chunk => {
    const pieces = demoTokenizer.splitChunk(chunk);
    return [...markPair(chips(pieces), pieces, demoTop).children];
  }));
  $('bpe-token-count').textContent = fmt(demo.tokenCount());
  $('bpe-vocab-size').textContent = fmt(demo.vocabularySize());
  $('bpe-merges').replaceChildren(...demo.merges.map(m => element('li', '', tokenElement(m.a), ' + ', tokenElement(m.b), ' → ', tokenElement(m.token))));
  $('bpe-merges-empty').hidden = demo.merges.length > 0;
  $('bpe-merges').scrollTop = $('bpe-merges').scrollHeight;
  renderTry();
  drawChart($('bpe-chart'), [{ values: demoHistory, color: css('--chart-train'), xLabel: 'Fusiones →' }], { fromZero: false });
}
function countPairs(updateStatus = true) {
  const pairs = demo.topPairs(8);
  demoTop = pairs[0]?.count > 1 ? pairs[0] : null;
  $('bpe-pairs').replaceChildren(...pairs.map((p, i) => element('tr', i ? '' : 'best', element('td', '', tokenElement(p.a), ' + ', tokenElement(p.b)), element('td', '', fmt(p.count)))));
  $('bpe-pairs-empty').hidden = pairs.length > 0;
  if (updateStatus) $('bpe-status').textContent = demoTop ? 'Resaltada en el texto: la pareja más frecuente. Fusiónala para crear una pieza nueva.' : 'No quedan parejas que se repitan.';
  renderDemo();
}
function mergeOnce() {
  const merge = demo.step();
  if (!merge) { stopAuto(); $('bpe-status').textContent = 'No quedan parejas que se repitan.'; return false; }
  demoHistory.push(demo.tokenCount());
  countPairs(false);
  $('bpe-status').replaceChildren('Nueva pieza: ', tokenElement(merge.a), ' + ', tokenElement(merge.b), ' → ', tokenElement(merge.token), ` · ${fmt(merge.count)} veces`);
  return true;
}
function stopAuto() { clearInterval(autoTimer); autoTimer = 0; $('bpe-auto').textContent = 'Continuar automáticamente'; }
$('bpe-count').addEventListener('click', () => countPairs());
$('bpe-merge').addEventListener('click', mergeOnce);
$('bpe-reset').addEventListener('click', resetDemo);
$('bpe-auto').addEventListener('click', () => {
  if (autoTimer) return stopAuto();
  $('bpe-auto').textContent = 'Pausar';
  autoTimer = setInterval(() => { if (!mergeOnce()) stopAuto(); }, reducedMotion ? 50 : 450);
});
function renderTry() { renderStrip($('bpe-try-output'), demo.tokenizer().pieces($('bpe-try-input').value).map(text => ({ text }))); }
$('bpe-try-input').addEventListener('input', renderTry);

// ---------- 05 · Oddities ----------
function renderOddities() {
  for (const box of document.querySelectorAll('[data-oddity]')) {
    box.replaceChildren(...box.dataset.oddity.split('|').map(sample => {
      const pieces = tokenizer.pieces(sample);
      return element('div', 'oddity-line', ...pieces.map(text => tokenElement(text)), element('em', '', `${pieces.length} ${pieces.length === 1 ? 'token' : 'tokens'}`));
    }));
  }
}
const languageSentences = ['El jugador encuentra la llave dorada en el castillo.', 'The player finds the golden key in the castle.', 'La red aprende a conducir con mil ejemplos.', 'The network learns to drive with a thousand examples.'];
function renderLanguages() {
  const only = language => new BpeTrainer(joinText(buildCorpus({ languages: [language] }).train)).train(VOCABULARY_SIZE).tokenizer();
  const tokenizers = [only('es'), only('en'), tokenizer];
  $('language-table').replaceChildren(...languageSentences.map(sentence => {
    const counts = tokenizers.map(t => t.encode(sentence).length), best = Math.min(...counts);
    const text = element('td', '', sentence); text.dataset.i18nIgnore = '';
    return element('tr', '', text, ...counts.map(count => element('td', count === best ? 'best-count' : '', fmt(count))));
  }));
}
function renderCounter() {
  const text = $('count-input').value, tokens = tokenizer.encode(text).length, words = text.trim() ? text.trim().split(/\s+/).length : 0, chars = [...text].length;
  $('count-tokens').textContent = fmt(tokens); $('count-words').textContent = fmt(words); $('count-chars').textContent = fmt(chars);
  $('count-ratio').textContent = tokens ? fmt(chars / tokens, 1) : '0';
  $('context-used').textContent = `${fmt(tokens)} / ${CONTEXT_WINDOW}`;
  $('context-fill').style.width = Math.min(100, tokens / CONTEXT_WINDOW * 100) + '%';
  $('context-fill').parentElement.classList.toggle('full', tokens > CONTEXT_WINDOW);
  $('context-overflow').hidden = tokens <= CONTEXT_WINDOW;
}
$('count-input').addEventListener('input', renderCounter);

// Canvas labels are drawn text, so redraw them when the language or theme changes.
document.addEventListener('languagechange', renderDemo);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', renderDemo);

renderSplit(); resetDemo(); renderOddities(); renderCounter();
// The two single-language tokenizers take a moment; build them after the first paint.
setTimeout(renderLanguages, 50);
