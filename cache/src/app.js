import { $, element, fmt, css, reducedMotion, drawChart } from '../../tokens/src/ui.js';
import { getLanguage } from '../../i18n/i18n.js';
import { createTransformer } from '../../attention/src/transformer.js';
import { random } from '../../tokens/src/corpus.js';
import { PRICES, BLOCKS, positionsWithout, compareDecoding, timeDecoding, promptCost, agentBill } from './cost.js';

const WORDS = ['El', 'gato', 'negro', 'duerme', 'sobre', 'la', 'alfombra', 'roja', '.'];
const LAYERS = 4;
const strong = value => element('strong', '', String(value));
const money = (value, digits = 2) => getLanguage() === 'en' ? '$' + fmt(value, digits) : fmt(value, digits) + ' $';
const cents = value => fmt(value * 100, 2) + ' ¢';

// A grid of K and V per layer (rows) and token (columns). `fresh` is the column computed in this
// step (-1: all of them, as in the prompt); earlier columns are read from the cache or computed again.
function kvGrid(count, fresh, cached) {
  const words = WORDS;
  const layerLabels = element('div', 'kv-col kv-labels', element('span', 'kv-word', ' '), ...Array.from({ length: LAYERS }, (_, l) => element('span', 'kv-layer', 'capa ' + (LAYERS - l))));
  const columns = words.map((word, i) => {
    const state = i >= count ? 'empty' : fresh < 0 || i === fresh ? 'now' : cached ? 'cached' : 'redo';
    const label = element('span', 'kv-word' + (i === fresh ? ' fresh' : '') + (i >= count ? ' ghost' : ''), word);
    label.dataset.i18nIgnore = '';
    const cells = Array.from({ length: LAYERS }, () => element('span', 'kv-cell', element('span', 'kv-key ' + state, 'K'), element('span', 'kv-key value ' + state, 'V')));
    return element('div', 'kv-col', label, ...cells);
  });
  return element('div', 'kv-scroll', element('div', 'kv-grid', layerLabels, ...columns));
}

// ---------- 01 · Generate it yourself ----------
const START = 3;
let shown = START, fresh = -1, cached = true, without = positionsWithout(START), withCache = START;
function renderLab() {
  $('kv-grid').replaceWith(Object.assign(kvGrid(shown, fresh, cached).firstChild, { id: 'kv-grid' }));
  $('kv-without').textContent = fmt(without);
  $('kv-with').textContent = fmt(withCache);
  $('kv-next').disabled = shown >= WORDS.length;
  for (const chip of $('kv-mode').children) chip.setAttribute('aria-pressed', String((chip.dataset.mode === 'cache') === cached));
}
$('kv-next').addEventListener('click', () => { if (shown >= WORDS.length) return; fresh = shown; shown++; without += shown; withCache++; renderLab(); });
$('kv-reset').addEventListener('click', () => { shown = START; fresh = -1; without = positionsWithout(START); withCache = START; renderLab(); });
$('kv-mode').addEventListener('click', event => { const chip = event.target.closest('[data-mode]'); if (chip) { cached = chip.dataset.mode === 'cache'; renderLab(); } });

// ---------- 01 · Measure with the chapter 09 network ----------
const LENGTH = 32;
let measured = null;
function renderMeasure() {
  if (!measured) return;
  const { counts, times } = measured;
  $('measure-without').textContent = fmt(counts.without);
  $('measure-with').textContent = fmt(counts.withCache);
  $('measure-difference').textContent = fmt(counts.maxDifference, counts.maxDifference ? 6 : 0);
  $('measure-time').replaceChildren('En tu navegador: ', strong(fmt(times.without, 1) + ' ms'), ' sin caché y ', strong(fmt(times.withCache, 1) + ' ms'), ' con caché, ', strong(fmt(times.without / times.withCache, 1) + '×'), ' más rápido. Con 32 tokens el ahorro es pequeño; con miles, sin caché sería impracticable.');
}
$('measure').addEventListener('click', () => {
  $('measure').disabled = true; $('measure-status').textContent = 'Midiendo…';
  // Let the status paint before the main thread is busy.
  setTimeout(() => {
    const rng = random(9), model = createTransformer({ vocabularySize: 64, length: LENGTH });
    const tokens = Array.from({ length: LENGTH }, () => Math.floor(rng() * 64));
    measured = { counts: compareDecoding(model, tokens), times: timeDecoding(model, tokens, 20) };
    $('measure-status').textContent = 'Medido.'; $('measure').disabled = false; renderMeasure();
  }, 30);
});

// ---------- 02 · Prefill and decode ----------
const PREFILL = 24, DECODE = 12;
let phaseTimers = [];
const fillTrack = (id, count, className) => $(id).replaceChildren(...Array.from({ length: count }, () => element('span', 'phase-token ' + className)));
function showPhases() { fillTrack('phase-prefill', PREFILL, 'read'); fillTrack('phase-decode', DECODE, 'written'); }
$('phase-play').addEventListener('click', () => {
  phaseTimers.forEach(clearTimeout); phaseTimers = [];
  if (reducedMotion) { showPhases(); return; }
  fillTrack('phase-prefill', PREFILL, ''); fillTrack('phase-decode', DECODE, '');
  phaseTimers.push(setTimeout(() => { for (const token of $('phase-prefill').children) token.classList.add('read'); }, 400));
  for (let i = 0; i < DECODE; i++) phaseTimers.push(setTimeout(() => $('phase-decode').children[i].classList.add('written'), 900 + i * 380));
});
function renderPrices() {
  $('price-input').textContent = money(PRICES.input, 0);
  $('price-output').textContent = money(PRICES.output, 0);
  $('price-read').textContent = money(PRICES.cacheRead);
}

// ---------- 03 · Prompt caching ----------
let changed = BLOCKS.length - 1;
function renderPrompt() {
  $('prompt-blocks').replaceChildren(...BLOCKS.map((block, i) => {
    const button = element('button', 'prompt-block ' + (i < changed ? 'hit' : 'miss') + (i === changed ? ' changed' : ''), element('span', 'prompt-name', block.name), element('span', 'prompt-tokens', fmt(block.tokens)));
    button.type = 'button'; button.style.flexGrow = Math.max(block.tokens, 4000);
    button.setAttribute('aria-pressed', String(i === changed));
    button.addEventListener('click', () => { changed = i; renderPrompt(); });
    return button;
  }));
  const cost = promptCost(BLOCKS, changed);
  $('prompt-read').textContent = fmt(cost.read);
  $('prompt-written').textContent = fmt(cost.written);
  $('prompt-cost').textContent = cents(cost.cached);
  $('prompt-verdict').replaceChildren(...(cost.cached <= cost.plain
    ? ['Sin caché, esta petición costaría ', strong(cents(cost.plain)), ': ', strong(fmt(cost.plain / cost.cached, 1) + ' veces más'), '.']
    : ['Sin caché costaría ', strong(cents(cost.plain)), '. Esta vez sale ', strong('más cara con caché'), ': casi nada se reutiliza y guardar cuesta más que leer.']));
}
$('prompt-reset').addEventListener('click', () => { changed = BLOCKS.length - 1; renderPrompt(); });

// ---------- 04 · An agent's bill ----------
const billInputs = { turns: 'bill-turns', system: 'bill-system', perTurn: 'bill-turn', output: 'bill-output' };
function renderBill() {
  const settings = Object.fromEntries(Object.entries(billInputs).map(([key, id]) => [key, Number($(id).value)]));
  for (const id of Object.values(billInputs)) $(id + '-value').textContent = fmt(Number($(id).value));
  const bill = agentBill(settings), last = settings.turns;
  $('bill-without').textContent = money(bill.without[last]);
  $('bill-with').textContent = money(bill.withCache[last]);
  $('bill-ratio').textContent = fmt(bill.without[last] / bill.withCache[last], 1) + '×';
  drawChart($('bill-chart'), [
    { values: bill.without, color: css('--accent'), xLabel: 'Turnos →' },
    { values: bill.withCache, color: css('--green') },
  ]);
}
for (const id of Object.values(billInputs)) $(id).addEventListener('input', renderBill);

function renderAll() { renderLab(); renderMeasure(); renderPrices(); renderPrompt(); renderBill(); }
document.addEventListener('languagechange', renderAll);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', renderBill);
showPhases(); renderAll();
