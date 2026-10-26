import { random } from '../../tokens/src/corpus.js';
import { $, element, fmt, css, percent, tokenElement, drawChart, Stepper } from '../../tokens/src/ui.js';
import { BOS, UNK } from '../../predictor/src/model.js';
import * as tf from '../../attention/src/transformer.js';
import { prepareData, threeCups, nineCups } from './data.js';
import { game, pairsFor, trace, grade, SWAPS } from './shell-game.js';
import { SETTINGS } from './training.js';

// The same games, tokenizer and vocabulary as the worker.
const data = prepareData(), three = threeCups(data), nine = nineCups(data), { tokenizer, encode, decode } = data, STOP_INDEX = data.stop;
// Scores measured on 100–300 games read better as whole percentages.
const whole = value => fmt(value * 100) + ' %';
const modelText = index => index === BOS ? '∅' : index === UNK ? '?' : tokenizer.vocab[data.vocabulary.tokens[index]];
const strong = value => element('strong', '', String(value));
const chipRow = items => element('div', 'token-strip', ...items.map(i => tokenElement(i.text, i)));
const promptChips = text => tokenizer.pieces(text).map(t => ({ text: t, className: 'prompt' }));
const replyChips = text => tokenizer.pieces(text).map(t => ({ text: t, className: 'generated' }));
const continueGame = (model, tokens, maxTokens = 30) => tf.generate(model, [BOS, ...tokens], { maxTokens, stop: STOP_INDEX });
const MODE_COLORS = { answer: '--chart-train', steps: '--chart-3', random: '--chart-validation', demos: '--chart-4' };
const MODE_LABELS = { answer: 'Comprueba la respuesta', steps: 'Comprueba cada paso', random: 'No comprueba nada', demos: 'Sin premios: repasar los ejemplos' };
const MODE_NOTES = {
  answer: 'Premia una de las respuestas que aciertan el vaso final. No lee los pasos.',
  steps: 'Premia solo respuestas con los seis pasos correctos. Más fiable, pero hay que poder revisar los pasos.',
  random: 'Control: se queda con una respuesta cualquiera, sin comprobar nada.',
  demos: 'Control: no genera respuestas; repasa los mismos 100 ejemplos con el mismo cálculo.',
};

let models = {}, busy = false, mode = 'answer', current = null;
const runs = [];

// A row of cups with the ball under one of them; a swap highlights its two cups.
function cupsRow(cups, ball, swap = null, label = '') {
  const row = element('div', 'cups-row');
  if (label) row.append(element('span', 'cups-label', label));
  for (let cup = 1; cup <= cups; cup++) {
    const box = element('span', 'cup' + (cup === ball ? ' ball' : '') + (swap && swap.includes(cup) ? ' swapped' : ''), element('span', '', String(cup)));
    box.dataset.i18nIgnore = '';
    row.append(box);
  }
  return row;
}
const swapText = ([a, b]) => `${a} ↔ ${b}`;

// ---------- 01 · The problem ----------
const example = game(3, [[2, 3], [1, 2], [1, 3], [1, 2], [1, 3], [2, 3]]);
function problemSteps() {
  return [
    { stage: 1, title: 'Una partida de trile', caption: ['La bola empieza en el vaso ', strong(example.start), '. Después se hacen seis cambios: cada «Cambio 2 y 3» intercambia esos dos vasos. Si la bola estaba en uno de ellos, pasa al otro.'], render: () => element('div', 'stack', cupsRow(3, example.start), chipRow(promptChips(example.prompt))) },
    { stage: 2, title: 'Una persona la sigue paso a paso', caption: 'Nadie calcula el final de golpe: miras dónde está la bola después de cada cambio. Son seis pasos sencillos, uno detrás de otro.', render: () => element('div', 'cups-trail', cupsRow(3, example.start, null, 'Al empezar'), ...example.swaps.map((swap, i) => cupsRow(3, example.steps[i], swap, swapText(swap)))) },
    { stage: 3, title: '¿Y de golpe?', caption: ['Prueba a decir el vaso final mirando solo la pregunta, sin seguir la bola. Hay que aplicar los seis cambios en orden a la vez. Es difícil, y la red tendría que hacerlo en un solo token. La respuesta es el vaso ', strong(example.ball), '.'], render: () => element('div', 'big-text', '¿Dónde está la bola?') },
    { stage: 4, title: 'Dos maneras de responder', caption: 'Arriba, de golpe: solo el vaso final. Abajo, pensando: primero escribe dónde está la bola al empezar y tras cada cambio, y después responde. Vas a enseñar las dos a dos copias del mismo modelo.', render: () => element('div', 'stack', chipRow(replyChips(example.direct)), chipRow(replyChips(example.think))) },
  ];
}
new Stepper($('problem-explainer'), problemSteps);

// ---------- 02 · One pass per token ----------
function passSteps() {
  const directCount = encode(example.direct).length, thinkCount = encode(example.think).length;
  return [
    { stage: 1, title: 'Cada token, una pasada', caption: 'Para escribir un token, la red hace siempre el mismo recorrido: mira los tokens anteriores con la atención, combina lo que encuentra en la capa oculta y da una probabilidad para cada token. Siempre el mismo número de cálculos.', render: () => element('div', 'block-flow', ...['Tokens anteriores', 'Atención', 'Capa oculta', 'Siguiente token'].map(text => element('span', 'block-step', text))) },
    { stage: 2, title: 'De golpe: seis cambios en una pasada', caption: 'Para escribir el vaso final de golpe, esa única pasada tendría que aplicar los seis cambios en orden. La atención puede mirar los seis cambios a la vez, pero solo los mezcla: pierde el orden y no puede encadenarlos.', render: () => element('div', 'stack', chipRow(promptChips(example.prompt)), chipRow(replyChips(example.direct))) },
    { stage: 3, title: 'Pensando: un cambio por token', caption: 'Pensando, cada cifra solo tiene que aplicar un cambio: la atención busca el cambio que toca y la capa oculta decide si la bola se mueve. La cifra anterior ya está escrita, y la red la vuelve a leer. Buscar y copiar es justo lo que la atención sabe hacer (capítulo 09).', render: () => element('div', 'cups-trail', ...example.swaps.map((swap, i) => element('div', 'step-line', tokenElement(' ' + (i ? example.steps[i - 1] : example.start), { className: 'prompt' }), element('span', 'arrow', '+ ' + swapText(swap) + ' →'), tokenElement(' ' + example.steps[i], { className: 'generated' })))) },
    { stage: 4, title: 'El precio: más tokens', caption: ['La respuesta directa ocupa ', strong(directCount), ' tokens; pensando, ', strong(thinkCount), '. Pensar es gastar más tokens, es decir, más pasadas por la red, en el mismo problema.'], render: () => element('div', 'stack', chipRow(replyChips(example.direct)), chipRow(replyChips(example.think))) },
  ];
}
new Stepper($('pass-explainer'), passSteps);

// ---------- Worker ----------
const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
worker.postMessage({ kind: 'setup', tokenizer: tokenizer.toJSON() });
let progressBar = null, compareHistory = [];
worker.onmessage = ({ data: message }) => {
  if (message.kind === 'progress') { if (progressBar) progressBar.style.width = message.done * 100 + '%'; return; }
  if (message.kind === 'epoch') { compareHistory = message.history; renderCompare(); return; }
  if (message.kind === 'round') { current = { mode: message.mode, history: message.history }; models.tuned = tf.restore(message.model); renderReward(); renderRoundNote(); return; }
  if (message.kind !== 'stage') return;
  if (message.stage === 'compare') {
    models.direct = tf.restore(message.direct); models.think = tf.restore(message.think); compareHistory = message.history;
    $('compare-status').textContent = 'Entrenados.'; renderCompare(); renderGame();
  }
  if (message.stage === 'demos') {
    models.demos = tf.restore(message.model);
    $('demos-status').textContent = 'Listo.'; $('reward-status').textContent = '';
    $('demos-chain').textContent = whole(message.metrics.chain); $('demos-correct').textContent = whole(message.metrics.correct);
    rewards.refresh();
  }
  if (message.stage === 'reward') {
    runs.push({ mode: message.mode, history: message.history }); current = null;
    $('reward-status').textContent = 'Terminado.'; $('stop').disabled = true;
    renderReward(); renderRuns();
  }
  if (progressBar) progressBar.style.width = '100%';
  setBusy(false);
};
function setBusy(value) {
  busy = value;
  $('compare').disabled = busy; $('demos').disabled = busy; $('reward').disabled = busy || !models.demos;
}
function start(kind, bar, message = {}) { progressBar = $(bar); progressBar.style.width = '0%'; setBusy(true); worker.postMessage({ kind, ...message }); }

// ---------- 03 · Train both ----------
$('chance-score').textContent = whole(1 / 3);
$('compare').addEventListener('click', () => { compareHistory = []; $('compare-status').textContent = 'Entrenando…'; start('compare', 'compare-progress'); });
function renderCompare() {
  drawChart($('compare-chart'), [
    { values: [33.3, ...compareHistory.map(h => h.think * 100)], color: css('--chart-train'), xLabel: 'Épocas →' },
    { values: [33.3, ...compareHistory.map(h => h.direct * 100)], color: css('--chart-validation') },
  ]);
  const last = compareHistory.at(-1);
  $('direct-score').textContent = last ? whole(last.direct) : '—';
  $('think-score').textContent = last ? whole(last.think) : '—';
}

// ---------- 04 · Look inside a game ----------
const pairs = pairsFor(3);
const option = (value, label) => Object.assign(element('option', '', label), { value });
$('game-start').replaceChildren(...[1, 2, 3].map(cup => option(cup, String(cup))));
$('game-swaps').replaceChildren(...Array.from({ length: SWAPS }, (_, i) => {
  const select = element('select'); select.setAttribute('aria-label', 'Cambio ' + (i + 1));
  select.replaceChildren(...pairs.map((pair, p) => option(p, `${pair[0]} y ${pair[1]}`)));
  select.dataset.i18nIgnore = '';
  return element('label', '', element('span', '', 'Cambio ' + (i + 1)), select);
}));
$('game-start').dataset.i18nIgnore = '';
function setGame(g) {
  $('game-start').value = g.start;
  [...$('game-swaps').querySelectorAll('select')].forEach((select, i) => { select.value = pairs.findIndex(p => p[0] === g.swaps[i][0] && p[1] === g.swaps[i][1]); });
}
const currentGame = () => game(Number($('game-start').value), [...$('game-swaps').querySelectorAll('select')].map(select => pairs[Number(select.value)]));
let focusDigit = 3;
function verdict(ok, yes, no) { return element('span', 'verdict ' + (ok ? 'good' : 'bad'), ok ? yes : no); }
function renderGame() {
  const g = currentGame();
  $('game-cups').replaceChildren(cupsRow(3, g.start, null, 'Al empezar'), ...g.swaps.map((swap, i) => cupsRow(3, g.steps[i], swap, swapText(swap))));
  renderCost(g);
  if (!models.direct) {
    for (const id of ['game-direct', 'game-think', 'game-attention']) $(id).replaceChildren(element('span', 'fine', 'Entrena los modelos en la sección 03.'));
    $('focus-note').textContent = ''; renderMistake(); return;
  }
  const prompt = encode(g.prompt), direct = decode(continueGame(models.direct, prompt)), reply = continueGame(models.think, prompt), replyText = decode(reply);
  $('game-direct').replaceChildren(...replyChips(direct).map(i => tokenElement(i.text, i)), verdict(grade(direct, g).correct, '✓ acierta', '✗ falla'));
  // The thinking digits are buttons: each shows where the model looked when it wrote that digit.
  const sequence = [BOS, ...prompt, ...reply], digits = [];
  const chips = reply.map((index, j) => {
    const text = modelText(index), chip = tokenElement(text, { className: 'generated' }), position = 1 + prompt.length + j;
    if (/^ \d$/.test(text) && sequence.slice(1 + prompt.length, position).some(i => modelText(i).trim() === 'Pienso') && !sequence.slice(1 + prompt.length, position).some(i => modelText(i) === '.')) {
      const digit = digits.length; digits.push(position);
      chip.classList.add('pickable'); chip.tabIndex = 0; chip.setAttribute('role', 'button');
      if (digit === focusDigit) chip.classList.add('picked');
      const pick = () => { focusDigit = digit; renderGame(); };
      chip.addEventListener('click', pick); chip.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); pick(); } });
    }
    return chip;
  });
  const v = grade(replyText, g);
  $('game-think').replaceChildren(...chips, verdict(v.correct && v.chain, '✓ acierta, pasos correctos', v.correct ? '✗ acierta, pero con pasos equivocados' : '✗ falla'));
  renderAttention(g, sequence, prompt, digits);
  renderMistake();
}
function renderAttention(g, sequence, prompt, digits) {
  if (!digits.length) { $('game-attention').replaceChildren(); $('focus-note').textContent = ''; return; }
  focusDigit = Math.min(focusDigit, digits.length - 1);
  // The digit at position p is predicted at position p − 1: that row of attention is where it looked.
  const from = digits[focusDigit] - 1, run = tf.decoder(models.think);
  let row = null;
  for (let t = 0; t <= from; t++) { const out = run.push(sequence[t]); if (t === from) row = out.attention; }
  $('game-attention').replaceChildren(...sequence.slice(0, from + 1).map((index, s) => {
    const chip = tokenElement(modelText(index), { small: row[s] >= 0.05 ? Math.round(row[s] * 100) + '%' : undefined });
    chip.style.setProperty('--weight', row[s].toFixed(3)); chip.classList.add('weighted');
    return chip;
  }));
  // Where each swap sits in the prompt: «Cambio», a, «y», b, «.».
  const texts = sequence.map(modelText), swapStarts = texts.map((t, i) => t.trim() === 'Cambio' && i <= prompt.length ? i : -1).filter(i => i >= 0);
  const spanWeight = ([a, b]) => row.slice(a, b + 1).reduce((x, y) => x + y, 0);
  if (focusDigit === 0) {
    const where = texts.findIndex((t, i) => i > 0 && i <= prompt.length && /^ \d$/.test(t));
    $('focus-note').replaceChildren('Primera cifra: copia el vaso inicial. Mira ', strong(percent(row[where] ?? 0)), ' al número del vaso inicial.');
  } else {
    const swap = g.swaps[focusDigit - 1], spans = swapStarts.map(s => spanWeight([s, s + 4])), own = spans[focusDigit - 1], others = spans.reduce((a, b) => a + b, 0) - own;
    const quoted = Object.assign(strong(`Cambio ${swap[0]} y ${swap[1]}`), { lang: 'es' }); quoted.dataset.i18nIgnore = '';
    $('focus-note').replaceChildren('Paso ', strong(focusDigit), ': tenía que aplicar «', quoted, '». Pone ', strong(percent(own)), ' de su atención en ese cambio y ', strong(percent(others)), ' en los otros cinco. ',
      own === Math.max(...spans) ? 'Es el cambio al que más mira.' : 'Esta vez no es el cambio al que más mira.');
  }
}
$('game-start').addEventListener('change', renderGame);
$('game-swaps').addEventListener('change', renderGame);
const gameRng = random(11);
$('game-random').addEventListener('click', () => { setGame(three.test[Math.floor(gameRng() * three.test.length)]); renderGame(); });

// ---------- 05 · Make a mistake ----------
$('mistake-step').replaceChildren(...Array.from({ length: SWAPS }, (_, i) => option(i + 1, String(i + 1))));
$('mistake-cup').replaceChildren(...[1, 2, 3].map(cup => option(cup, String(cup))));
for (const id of ['mistake-step', 'mistake-cup']) $(id).dataset.i18nIgnore = '';
$('mistake-step').value = 2; $('mistake-cup').value = 3;
function renderMistake() {
  const g = currentGame(), k = Number($('mistake-step').value), chosen = Number($('mistake-cup').value);
  if (!models.think) { $('mistake-output').replaceChildren(element('span', 'fine', 'Entrena los modelos en la sección 03.')); $('mistake-verdict').textContent = ''; return; }
  // The reasoning is right up to step k − 1; step k is what you wrote.
  const before = ` Pienso: ${g.start}${g.steps.slice(0, k - 1).map(s => ' ' + s).join('')}`, forced = ' ' + chosen;
  const tokens = [...encode(g.prompt), ...encode(before + forced)], out = continueGame(models.think, tokens), text = before + forced + decode(out);
  $('mistake-output').replaceChildren(...promptChips(before).map(i => tokenElement(i.text, i)), tokenElement(forced, { className: 'seen' }), ...out.map(index => tokenElement(modelText(index), { className: 'generated' })));
  const follow = trace(chosen, g.swaps.slice(k)).at(-1) ?? chosen, final = Number([...text.matchAll(/Está en el vaso (\d)\./g)].map(m => m[1]).at(-1));
  if (chosen === g.steps[k - 1]) $('mistake-verdict').replaceChildren(strong('Ese es el paso correcto.'), ' Elige otro vaso para equivocarte.');
  else if (final === follow) $('mistake-verdict').replaceChildren(strong('Sigue tu error.'), ' Con la bola en el vaso ', strong(chosen), ' tras el paso ', strong(k), ', los cambios que quedan la llevan al vaso ', strong(follow), ', y eso responde. La bola estaba de verdad en el vaso ', strong(g.ball), '.');
  else $('mistake-verdict').replaceChildren(strong('No sigue tu error.'), ' Responde el vaso ', strong(Number.isFinite(final) ? final : '?'), '; siguiendo tu cambio habría salido el ', strong(follow), '.');
}
for (const id of ['mistake-step', 'mistake-cup']) $(id).addEventListener('change', renderMistake);

// ---------- 06 · The cost ----------
function renderCost(g) {
  const direct = encode(g.direct).length, think = encode(g.think).length;
  $('cost-direct').textContent = fmt(direct); $('cost-think').textContent = fmt(think); $('cost-ratio').textContent = '× ' + fmt(think / direct, 1);
}

// ---------- 07 · Rewards ----------
const rewardExample = nine.test[1];
function label(v) { return v.correct && v.chain ? '✓ razonamiento correcto' : v.correct ? '✓ acierta por suerte' : '✗ falla'; }
function rewardSteps() {
  const g = rewardExample, intro = { stage: 1, title: 'Una pregunta que se puede comprobar', caption: ['Nueve vasos y seis cambios. Solo sabemos la respuesta: el vaso ', strong(g.ball), '. Nadie ha escrito los pasos.'], render: () => element('div', 'stack', cupsRow(9, g.start), chipRow(promptChips(g.prompt))) };
  if (!models.demos) return [intro, { stage: 2, title: 'Primero, los 100 ejemplos', caption: 'Esta explicación usa el modelo de abajo. Pulsa «2. Aprender de 100 ejemplos» y vuelve aquí.', render: () => element('div', 'big-text', '…') }];
  const rng = random(5), replies = Array.from({ length: 6 }, () => decode(tf.generate(models.demos, [BOS, ...encode(g.prompt)], { maxTokens: 30, temperature: SETTINGS.temperature, stop: STOP_INDEX, rng })));
  const verdicts = replies.map(r => grade(r, g)), kept = replies.map((_, i) => i).filter(i => mode === 'random' || (mode === 'steps' ? verdicts[i].chain && verdicts[i].correct : verdicts[i].correct));
  const list = (marks = false) => element('div', 'stack', ...replies.map((reply, i) => element('div', 'candidate' + (marks && kept.includes(i) ? ' chosen' : ''), chipRow(replyChips(reply)), element('span', 'fine', label(verdicts[i]) + (marks && kept.includes(i) ? ' · premiable' : '')))));
  const lucky = replies.findIndex((_, i) => verdicts[i].correct && !verdicts[i].chain);
  return [
    intro,
    { stage: 2, title: 'El modelo escribe varias respuestas', caption: 'Con algo de azar (temperatura 0,7), el modelo de los 100 ejemplos piensa varias veces la misma partida. En el experimento son 12 respuestas por pregunta; aquí ves 6 reales.', render: () => list() },
    { stage: 3, title: 'Se comprueba cuáles acierta', caption: mode === 'demos' ? 'Con el control «repasar los ejemplos» no se mira ninguna respuesta. Elige otro modo abajo y vuelve a este paso.' : ['Con el modo elegido abajo («', MODE_LABELS[mode], '»), estas son las que podrían premiarse. Se elige una al azar entre ellas.'], render: () => list(true) },
    { stage: 4, title: 'Se reentrena con las premiadas', caption: 'Se repite con 300 preguntas, se entrena con las respuestas premiadas y empieza otra ronda. Lo que se premió será más probable en la siguiente.', render: () => element('div', 'block-flow', ...['300 preguntas', '12 respuestas cada una', 'Comprobar', 'Entrenar con las premiadas', 'Repetir'].map(text => element('span', 'block-step', text))) },
    { stage: 5, title: 'La trampa: acertar por suerte', caption: lucky >= 0 ? 'Esta respuesta acierta el vaso final con pasos equivocados. Quien solo comprueba la respuesta la premia igual, y eso enseña pasos falsos. Funciona porque, a medida que el modelo razona mejor, sus aciertos dejan de ser casualidad.' : 'Ninguna de estas seis acierta por suerte, pero pasa a menudo: una respuesta con pasos equivocados que acierta el vaso final. Quien solo comprueba la respuesta la premia igual. Funciona porque, a medida que el modelo razona mejor, sus aciertos dejan de ser casualidad.', render: () => lucky >= 0 ? chipRow(replyChips(replies[lucky])) : chipRow(replyChips(rewardExample.think)) },
  ];
}
const rewards = new Stepper($('reward-explainer'), rewardSteps);
$('demos-chance').textContent = whole(1 / 9);
$('demos').addEventListener('click', () => { $('demos-status').textContent = 'Aprendiendo…'; start('demos', 'demos-progress'); });
function renderModes() {
  for (const chip of $('reward-modes').children) chip.setAttribute('aria-pressed', String(chip.dataset.mode === mode));
  $('mode-note').textContent = MODE_NOTES[mode];
}
$('reward-modes').addEventListener('click', event => { const chip = event.target.closest('[data-mode]'); if (!chip) return; mode = chip.dataset.mode; renderModes(); rewards.refresh(); });
$('reward').addEventListener('click', () => {
  current = { mode, history: [] }; $('stop').disabled = false; $('reward-status').textContent = 'Aplicando rondas…'; $('round-note').textContent = '';
  start('reward', 'reward-progress', { mode });
});
$('stop').addEventListener('click', () => worker.postMessage({ kind: 'stop' }));
function renderRoundNote() {
  const last = current?.history.at(-1); if (!last || !last.round) return;
  $('round-note').replaceChildren('Ronda ', strong(last.round), ': ', strong(last.kept), ' respuestas premiadas, ', strong(last.lucky), ' por suerte. Razonamientos correctos: ', strong(percent(last.chain)), '.');
}
function renderReward() {
  const all = [...runs, ...(current ? [current] : [])].filter(run => run.history.length);
  const series = all.map(run => ({ values: run.history.map(h => h.chain * 100), color: css(MODE_COLORS[run.mode]), xLabel: 'Rondas →' }));
  drawChart($('reward-chart'), series.length ? series : []);
  const modes = [...new Set(all.map(run => run.mode))];
  $('reward-legend').replaceChildren(...modes.map(m => { const span = element('span', '', '━ ' + MODE_LABELS[m]); span.style.color = css(MODE_COLORS[m]); return span; }));
}
function renderRuns() {
  $('runs').replaceChildren(...runs.map(run => {
    const first = run.history[1], last = run.history.at(-1), luck = run.mode === 'demos' || !first ? '—' : `${first.lucky} / ${first.kept} → ${last.lucky} / ${last.kept}`;
    return element('tr', '', element('td', '', MODE_LABELS[run.mode]), element('td', '', percent(run.history[0].chain)), element('td', '', percent(last.chain)), element('td', '', luck));
  }));
  $('runs-empty').hidden = runs.length > 0;
}

const redraw = () => { renderCompare(); renderReward(); };
document.addEventListener('languagechange', redraw);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redraw);
setGame(example); renderModes(); renderGame(); renderRuns(); redraw(); setBusy(false);
