import { $, element, css, reducedMotion, drawChart, Stepper } from '../../tokens/src/ui.js';
import { getLanguage, getLocale } from '../../i18n/i18n.js';
import { PRICES, BLOCKS, positionsWithout, promptCost, agentBill } from './cost.js';

// Every example on this page is an illustration: an invented sentence, invented prompt blocks and an
// imaginary agent. Only the prices (Claude Sonnet 5.5) and the arithmetic are real.
const say = (es, en) => getLanguage() === 'en' ? en : es;
// Always group thousands (Spanish leaves «8000» ungrouped by default).
const fmt = (value, digits = 0) => value.toLocaleString(getLocale(), { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: 'always' });
// Numbers and sums stay as written; the translator leaves them alone.
const raw = (tag, className, ...children) => { const node = element(tag, className, ...children); node.dataset.i18nIgnore = ''; return node; };
const WORDS = ['El', 'gato', 'negro', 'duerme', 'sobre', 'la', 'alfombra', 'roja', '.'];
const LAYERS = 4;
const strong = value => element('strong', '', String(value));
const money = (value, digits = 2) => say(fmt(value, digits) + ' $', '$' + fmt(value, digits));
const cents = value => fmt(value * 100, 2) + ' ¢';

// A grid of K and V per layer (rows) and token (columns). `fresh` is the column computed in this
// step (-1: all of them, as in the prompt); earlier columns are read from the cache or computed again.
function kvGrid(count, fresh, cached) {
  const layerLabels = element('div', 'kv-col kv-labels', element('span', 'kv-word', ' '), ...Array.from({ length: LAYERS }, (_, l) => element('span', 'kv-layer', say('capa ', 'layer ') + (LAYERS - l))));
  const columns = WORDS.map((word, i) => {
    const state = i >= count ? 'empty' : fresh < 0 || i === fresh ? 'now' : cached ? 'cached' : 'redo';
    const label = raw('span', 'kv-word' + (i === fresh ? ' fresh' : '') + (i >= count ? ' ghost' : ''), word);
    const cells = Array.from({ length: LAYERS }, () => element('span', 'kv-cell', element('span', 'kv-key ' + state, 'K'), element('span', 'kv-key value ' + state, 'V')));
    return element('div', 'kv-col', label, ...cells);
  });
  return element('div', 'kv-grid', layerLabels, ...columns);
}

// ---------- 01 · Generate it yourself ----------
const START = 3;
let shown = START, fresh = -1, cached = true, without = positionsWithout(START), withCache = START;
function renderLab() {
  $('kv-grid').replaceWith(Object.assign(kvGrid(shown, fresh, cached), { id: 'kv-grid' }));
  $('kv-without').textContent = fmt(without);
  $('kv-with').textContent = fmt(withCache);
  $('kv-next').disabled = shown >= WORDS.length;
  for (const chip of $('kv-mode').children) chip.setAttribute('aria-pressed', String((chip.dataset.mode === 'cache') === cached));
}
$('kv-next').addEventListener('click', () => { if (shown >= WORDS.length) return; fresh = shown; shown++; without += shown; withCache++; renderLab(); });
$('kv-reset').addEventListener('click', () => { shown = START; fresh = -1; without = positionsWithout(START); withCache = START; renderLab(); });
$('kv-mode').addEventListener('click', event => { const chip = event.target.closest('[data-mode]'); if (chip) { cached = chip.dataset.mode === 'cache'; renderLab(); } });

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

// ---------- 03 · Prompt caching, step by step ----------
// One request as a row of blocks: those before `changed` are read from the cache, the rest are processed and stored.
const blockWidth = tokens => Math.max(tokens, 6000);
function request(label, blocks, changed, marked = -1) {
  const cost = promptCost(blocks, changed);
  const row = element('div', 'prompt-blocks', ...blocks.map((block, i) => {
    const node = element('span', 'prompt-block ' + (i < changed ? 'hit' : 'miss') + (i === marked ? ' changed' : ''), element('span', 'prompt-name', block.name), raw('span', 'prompt-tokens', fmt(block.tokens)));
    node.style.flexGrow = blockWidth(block.tokens);
    return node;
  }));
  return element('div', 'request-view', raw('span', 'eyebrow', label), row,
    raw('span', 'request-cost', say(`Entrada: ${cents(cost.cached)} · sin caché: ${cents(cost.plain)}`, `Input: ${cents(cost.cached)} · without cache: ${cents(cost.plain)}`)));
}
const legend = () => element('div', 'request-legend', element('span', '', element('i', 'hit'), 'Leído de la caché'), element('span', '', element('i', 'miss'), 'Procesado y guardado'));
const view = (...children) => element('div', 'request-steps', ...children, legend());
const CLOCK = { name: 'Fecha y hora', tokens: 20 };
function promptSteps() {
  const last = BLOCKS.length - 1;
  return [
    { stage: 1, title: 'La primera vez, se lee todo', caption: 'No hay nada guardado. El proveedor lee el prompt entero y guarda lo que ha calculado durante unos minutos. Guardar cuesta un 25 % más que leer, así que esta primera petición sale algo más cara que sin caché.', render: () => view(request(say('PETICIÓN 1', 'REQUEST 1'), BLOCKS, 0)) },
    { stage: 2, title: 'La siguiente empieza igual', caption: 'La segunda petición repite herramientas, instrucciones, documento e historial, y solo añade una pregunta. Todo lo repetido se lee de la caché, a una décima parte del precio. Solo la pregunta nueva se procesa y se guarda.', render: () => view(request(say('PETICIÓN 2', 'REQUEST 2'), BLOCKS, last)) },
    { stage: 3, title: 'Un cambio arriba lo estropea', caption: 'Ahora las instrucciones llevan la hora, y la hora ha cambiado. Lo que el modelo calcula de cada token depende de todo lo que va antes, así que desde el cambio nada de lo guardado sirve: el documento y el historial se vuelven a procesar aunque sean idénticos.', render: () => view(request(say('PETICIÓN 3', 'REQUEST 3'), BLOCKS, 1, 1), raw('p', 'fine', say('Las instrucciones decían «Son las 10:42»; ahora dicen «Son las 10:43».', 'The instructions said “It is 10:42”; now they say “It is 10:43”.'))) },
    { stage: 4, title: 'Lo estable primero, lo que cambia al final', caption: 'Es la regla más útil del capítulo. Con la hora al final, se aprovecha casi todo. Con la hora al principio, no se aprovecha nada, aunque el resto del prompt no cambie ni una letra.', render: () => view(
      request(say('BIEN: LA HORA AL FINAL', 'GOOD: THE TIME AT THE END'), [...BLOCKS.slice(0, last), CLOCK, BLOCKS[last]], last, last),
      request(say('MAL: LA HORA AL PRINCIPIO', 'BAD: THE TIME AT THE START'), [CLOCK, ...BLOCKS], 0, 0)) },
  ];
}
const promptStepper = new Stepper($('prompt-explainer'), promptSteps);

// ---------- 03 · Prompt caching, your turn ----------
let changed = BLOCKS.length - 1;
function renderPrompt() {
  $('prompt-blocks').replaceChildren(...BLOCKS.map((block, i) => {
    const button = element('button', 'prompt-block ' + (i < changed ? 'hit' : 'miss') + (i === changed ? ' changed' : ''), element('span', 'prompt-name', block.name), raw('span', 'prompt-tokens', fmt(block.tokens)));
    button.type = 'button'; button.style.flexGrow = blockWidth(block.tokens);
    button.setAttribute('aria-pressed', String(i === changed));
    button.addEventListener('click', () => { changed = i; renderPrompt(); });
    return button;
  }));
  const cost = promptCost(BLOCKS, changed);
  $('prompt-read').textContent = fmt(cost.read);
  $('prompt-written').textContent = fmt(cost.written);
  $('prompt-cost').textContent = cents(cost.cached);
  $('prompt-verdict').replaceChildren(...(cost.cached <= cost.plain
    ? ['Sin caché, esta petición costaría ', strong(cents(cost.plain)), ': ', strong(say(`${fmt(cost.plain / cost.cached, 1)} veces más`, `${fmt(cost.plain / cost.cached, 1)} times more`)), '.']
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

function renderAll() { renderLab(); renderPrices(); promptStepper.refresh(); renderPrompt(); renderBill(); }
document.addEventListener('languagechange', renderAll);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', renderBill);
showPhases(); renderAll();
