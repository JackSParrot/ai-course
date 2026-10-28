import { $, element, tokenElement, Stepper } from '../../tokens/src/ui.js';
import { getLanguage, getLocale } from '../../i18n/i18n.js';

// Every answer, score and curve on this page is an illustration: scripted, not produced or measured by a model.
const say = (es, en) => getLanguage() === 'en' ? en : es;
const fmt = (value, digits = 0) => value.toLocaleString(getLocale(), { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: 'always' });
const pct = value => say(`${fmt(value)} %`, `${fmt(value)}%`);
// Text already written in the page language; the translator leaves it alone.
const raw = (tag, className, ...children) => { const node = element(tag, className, ...children); node.dataset.i18nIgnore = ''; return node; };
const strong = text => raw('strong', '', String(text));
const flow = items => element('div', 'block-flow', ...items.map(text => element('span', 'block-step', text)));
const desk = (label, ...children) => element('div', 'mini-desk', element('span', 'eyebrow', label), ...children);
const chip = (value, className) => tokenElement(String(value), { className });

// ---------- The shell game ----------
// Each swap exchanges two cups; if the ball is under one of them, it moves to the other.
const move = (ball, [a, b]) => ball === a ? b : ball === b ? a : ball;
const trace = (start, swaps) => { const steps = []; let ball = start; for (const swap of swaps) steps.push(ball = move(ball, swap)); return steps; };
const game = (start, swaps) => { const steps = trace(start, swaps); return { start, swaps, steps, ball: steps.at(-1) }; };
const PAIRS = [[1, 2], [1, 3], [2, 3]];
const SWAPS = 6;

const swapText = ([a, b]) => say(`Cambio ${a} y ${b}.`, `Swap ${a} and ${b}.`);
const startText = cup => say(`La bola está en el vaso ${cup}.`, `The ball is under cup ${cup}.`);
const askText = () => say('¿Dónde está la bola?', 'Where is the ball?');
const questionText = g => [startText(g.start), ...g.swaps.map(swapText), askText()].join(' ');
const answerText = cup => say(`Está en el vaso ${cup}.`, `It is under cup ${cup}.`);
const thinkText = (start, steps, ball) => say(`Pienso: ${[start, ...steps].join(' ')}. Está en el vaso ${ball}.`, `Thinking: ${[start, ...steps].join(' ')}. It is under cup ${ball}.`);
const arrow = ([a, b]) => `${a} ↔ ${b}`;

// A row of cups with the ball under one of them; a swap highlights its two cups.
function cupsRow(cups, ball, swap = null, label = '') {
  const row = element('div', 'cups-row');
  if (label) row.append(raw('span', 'cups-label', label));
  for (let cup = 1; cup <= cups; cup++) row.append(raw('span', 'cup' + (cup === ball ? ' ball' : '') + (swap && swap.includes(cup) ? ' swapped' : ''), element('span', '', String(cup))));
  return row;
}
const trail = (cups, g) => element('div', 'cups-trail', cupsRow(cups, g.start, null, say('Al empezar', 'At the start')), ...g.swaps.map((swap, i) => cupsRow(cups, g.steps[i], swap, arrow(swap))));
const reply = (label, text, className = '') => element('div', 'reply-line' + (className ? ' ' + className : ''), element('span', 'eyebrow', label), raw('p', '', text));

// ---------- 01 · The problem ----------
const example = game(3, [[2, 3], [1, 2], [1, 3], [1, 2], [1, 3], [2, 3]]);
function problemSteps() {
  return [
    { stage: 1, title: 'Una partida de trile', caption: say(`La bola empieza en el vaso ${example.start}. Después se hacen seis cambios: cada «Cambio 2 y 3» intercambia esos dos vasos. Si la bola estaba en uno de ellos, pasa al otro.`, `The ball starts under cup ${example.start}. Then six swaps are made: each «Swap 2 and 3» exchanges those two cups. If the ball was under one of them, it moves to the other.`),
      render: () => element('div', 'stack', cupsRow(3, example.start), raw('p', 'shell-text', questionText(example))) },
    { stage: 2, title: 'Una persona la sigue paso a paso', caption: 'Nadie calcula el final de golpe: miras dónde está la bola después de cada cambio. Son seis pasos sencillos, uno detrás de otro.', render: () => trail(3, example) },
    { stage: 3, title: '¿Y de golpe?', caption: say(`Prueba a decir el vaso final mirando solo la pregunta, sin seguir la bola. Hay que aplicar los seis cambios en orden a la vez. Es difícil, y la red tendría que hacerlo en un solo token. La respuesta es el vaso ${example.ball}.`, `Try to say the final cup looking only at the question, without following the ball. You have to apply the six swaps in order, all at once. It is hard, and the network would have to do it in a single token. The answer is cup ${example.ball}.`),
      render: () => element('div', 'stack', raw('p', 'shell-text', questionText(example)), element('div', 'big-text', '¿Dónde está la bola?')) },
    { stage: 4, title: 'Dos maneras de responder', caption: 'Arriba, de golpe: solo el vaso final. Abajo, pensando: primero escribe dónde está la bola al empezar y tras cada cambio, y después responde. Las dos dicen lo mismo, pero la segunda ha hecho el trabajo a la vista.',
      render: () => element('div', 'stack', reply('DE GOLPE', answerText(example.ball)), reply('PENSANDO', thinkText(example.start, example.steps, example.ball), 'good')) },
  ];
}

// ---------- 02 · One pass per token ----------
function passSteps() {
  const n = value => fmt(value);
  return [
    { stage: 1, title: 'Cada token, una pasada', caption: 'Para escribir un token, la red hace siempre el mismo recorrido: mira los tokens anteriores con la atención, combina lo que encuentra en la capa oculta y da una probabilidad para cada token. Siempre el mismo número de cálculos.', render: () => flow(['Tokens anteriores', 'Atención', 'Capa oculta', 'Siguiente token']) },
    { stage: 2, title: 'De golpe: seis cambios en una pasada', caption: 'Para escribir el vaso final de golpe, esa única pasada tendría que aplicar los seis cambios en orden. La atención puede mirar los seis cambios a la vez, pero solo los mezcla: pierde el orden y no puede encadenarlos.',
      render: () => element('div', 'stack', raw('p', 'shell-text', questionText(example)), element('div', 'step-line', element('span', 'arrow', 'Una pasada →'), chip(example.ball, 'generated'))) },
    { stage: 3, title: 'Pensando: un cambio por token', caption: 'Pensando, cada cifra solo tiene que aplicar un cambio: la atención busca el cambio que toca y decide si la bola se mueve. La cifra anterior ya está escrita, y la red la vuelve a leer. Buscar y copiar es justo lo que la atención sabe hacer (capítulo 09).',
      render: () => element('div', 'cups-trail', ...example.swaps.map((swap, i) => element('div', 'step-line', chip(i ? example.steps[i - 1] : example.start, 'prompt'), raw('span', 'arrow', '+ ' + arrow(swap) + ' →'), chip(example.steps[i], 'generated')))) },
    { stage: 4, title: 'A ti te pasa lo mismo', caption: 'Multiplicar 347 × 28 de cabeza, de una vez, es difícil. En un papel, apuntando los resultados intermedios, es fácil: cada línea es una cuenta pequeña. El razonamiento es el papel del modelo.',
      render: () => element('div', 'two-cases', desk('DE CABEZA, DE GOLPE', raw('div', 'big-text', '347 × 28 = ?')),
        desk('EN UN PAPEL, PASO A PASO', raw('pre', 'paper-sum', `347 × 8  = ${n(2776)}\n347 × 20 = ${n(6940)}\n${n(2776)} + ${n(6940)} = ${n(9716)}`))) },
  ];
}

// ---------- 03 · At once or thinking ----------
const option = (value, label) => Object.assign(raw('option', '', label), { value });
let current = example, focus = 1;
function buildControls() {
  $('game-start').replaceChildren(...[1, 2, 3].map(cup => option(cup, String(cup))));
  $('game-start').dataset.i18nIgnore = '';
  $('game-swaps').replaceChildren(...Array.from({ length: SWAPS }, (_, i) => {
    const select = raw('select', '', ...PAIRS.map((pair, p) => option(p, say(`${pair[0]} y ${pair[1]}`, `${pair[0]} and ${pair[1]}`))));
    select.setAttribute('aria-label', say(`Cambio ${i + 1}`, `Swap ${i + 1}`));
    return element('label', '', raw('span', '', say(`Cambio ${i + 1}`, `Swap ${i + 1}`)), select);
  }));
  $('game-start').value = current.start;
  [...$('game-swaps').querySelectorAll('select')].forEach((select, i) => { select.value = PAIRS.findIndex(p => p[0] === current.swaps[i][0] && p[1] === current.swaps[i][1]); });
}
function readGame() {
  current = game(Number($('game-start').value), [...$('game-swaps').querySelectorAll('select')].map(select => PAIRS[Number(select.value)]));
}
// Answering at once, the network barely knows more than chance: a fixed, almost flat guess per game.
function guessAtOnce(g) {
  const seed = g.swaps.reduce((sum, pair, i) => sum + (PAIRS.findIndex(p => p[0] === pair[0] && p[1] === pair[1]) + 1) * (i + 2), g.start * 5);
  const pick = 1 + seed % 3, beliefs = [1, 2, 3].map(cup => cup === pick ? 36 : cup === 1 + (seed + 1) % 3 ? 33 : 31);
  return { pick, beliefs };
}
function renderQuestion() {
  const g = current, focused = focus >= 1 ? focus - 1 : -1;
  $('game-question').replaceChildren(raw('span', focus === 0 ? 'focus' : '', startText(g.start)), ' ',
    ...g.swaps.flatMap((swap, i) => [raw('span', i === focused ? 'focus' : '', swapText(swap)), ' ']), raw('span', '', askText()));
}
function renderDirect() {
  const g = current, { pick, beliefs } = guessAtOnce(g), right = pick === g.ball;
  const bar = (cup, value) => { const fill = element('span', cup === pick ? 'good' : 'muted'); fill.style.width = value / 40 * 100 + '%'; return element('div', 'compare-row', raw('small', '', say(`Vaso ${cup}`, `Cup ${cup}`)), element('div', 'compare-track', fill), raw('strong', '', pct(value))); };
  $('game-direct').replaceChildren(
    element('p', 'fine', 'Lo que cree tras una sola pasada:'),
    element('div', 'compare-bars', ...beliefs.map((value, i) => bar(i + 1, value))),
    reply('RESPONDE', answerText(pick), right ? 'lucky' : 'bad'),
    raw('p', 'verdict ' + (right ? 'good' : 'bad'), right ? say('✓ Acierta, pero por casualidad.', '✓ Right, but by chance.') : say(`✗ Falla: la bola está en el vaso ${g.ball}.`, `✗ Wrong: the ball is under cup ${g.ball}.`)),
    element('p', 'fine', 'Seis cambios no le caben en una pasada: duda casi lo mismo entre los tres vasos.'));
}
function renderThink() {
  const g = current, values = [g.start, ...g.steps];
  const rows = values.map((cup, i) => {
    const row = element('button', 'think-step' + (i === focus ? ' picked' : ''));
    row.type = 'button'; row.setAttribute('aria-pressed', String(i === focus));
    row.append(raw('span', 'think-label', i === 0 ? say('Al empezar', 'At the start') : say(`Paso ${i} · ${arrow(g.swaps[i - 1])}`, `Step ${i} · ${arrow(g.swaps[i - 1])}`)),
      cupsRow(3, cup, i ? g.swaps[i - 1] : null), chip(cup, 'generated'));
    row.addEventListener('click', () => { focus = i; renderGame(); });
    return row;
  });
  const note = focus === 0
    ? say(`Primer paso: copia el vaso donde empieza la bola, el ${g.start}.`, `First step: it copies the cup where the ball starts, cup ${g.start}.`)
    : say(`Paso ${focus}: solo mira «Cambio ${g.swaps[focus - 1].join(' y ')}» y la cifra anterior (${values[focus - 1]}). Una cuenta pequeña: la bola queda en el vaso ${values[focus]}.`,
      `Step ${focus}: it only looks at «Swap ${g.swaps[focus - 1].join(' and ')}» and the previous digit (${values[focus - 1]}). A small sum: the ball ends under cup ${values[focus]}.`);
  $('game-think').replaceChildren(element('div', 'think-steps', ...rows), raw('p', 'think-note', note),
    reply('RESPONDE', thinkText(g.start, g.steps, g.ball), 'good'), raw('p', 'verdict good', say('✓ Acierta, con todos los pasos bien.', '✓ Right, with every step right.')));
}
function renderCompareBars() {
  const bar = (label, value, className) => { const fill = element('span', className); fill.style.width = value + '%'; return element('div', 'compare-row', element('small', '', label), element('div', 'compare-track', fill), raw('strong', '', '≈ ' + pct(value))); };
  $('compare-bars').replaceChildren(bar('Adivinar al azar', 33, 'muted'), bar('De golpe', 36, 'bad'), bar('Pensando', 99, 'good'));
}
function renderGame() { renderQuestion(); renderDirect(); renderThink(); renderMistake(); }
$('game-start').addEventListener('change', () => { readGame(); renderGame(); });
$('game-swaps').addEventListener('change', () => { readGame(); renderGame(); });
let gameSeed = 7;
$('game-random').addEventListener('click', () => {
  const next = () => (gameSeed = (gameSeed * 1103515245 + 12345) % 2147483648) / 2147483648;
  current = game(1 + Math.floor(next() * 3), Array.from({ length: SWAPS }, () => PAIRS[Math.floor(next() * 3)]));
  buildControls(); renderGame();
});

// ---------- 04 · Make a mistake ----------
function buildMistakeControls() {
  $('mistake-step').replaceChildren(...Array.from({ length: SWAPS }, (_, i) => option(i + 1, String(i + 1))));
  $('mistake-cup').replaceChildren(...[1, 2, 3].map(cup => option(cup, String(cup))));
  for (const id of ['mistake-step', 'mistake-cup']) $(id).dataset.i18nIgnore = '';
  $('mistake-step').value = 2; $('mistake-cup').value = 3;
}
function renderMistake() {
  const g = current, k = Number($('mistake-step').value), chosen = Number($('mistake-cup').value);
  // Right up to step k − 1; step k is yours; every later step starts from yours.
  const after = trace(chosen, g.swaps.slice(k)), final = after.at(-1) ?? chosen;
  $('mistake-output').replaceChildren(element('div', 'token-strip',
    raw('span', 'trail-word', say('Pienso:', 'Thinking:')),
    ...[g.start, ...g.steps.slice(0, k - 1)].map(cup => chip(cup, 'prompt')),
    chip(chosen, 'seen'), ...after.map(cup => chip(cup, 'generated')),
    raw('span', 'trail-word', answerText(final))));
  const verdict = $('mistake-verdict');
  if (chosen === g.steps[k - 1]) verdict.replaceChildren(strong(say('Ese es el paso correcto.', 'That is the right step.')), raw('span', '', say(' Elige otro vaso para equivocarte.', ' Pick another cup to make a mistake.')));
  else verdict.replaceChildren(strong(say('Sigue tu error.', 'It follows your mistake.')),
    raw('span', '', say(` Con la bola en el vaso ${chosen} tras el paso ${k}, los cambios que quedan la llevan al vaso ${final}, y eso responde. La bola estaba de verdad en el vaso ${g.ball}.`,
      ` With the ball under cup ${chosen} after step ${k}, the remaining swaps take it to cup ${final}, and that is the answer. The ball was really under cup ${g.ball}.`)));
}
for (const id of ['mistake-step', 'mistake-cup']) $(id).addEventListener('change', renderMistake);

// ---------- 05 · The cost ----------
// Rough count: «Está en el vaso 1.» is about 6 tokens; thinking adds «Pienso:», seven digits and a full stop.
const COST = { direct: 6, think: 16 };
function renderCost() {
  $('cost-direct').textContent = fmt(COST.direct); $('cost-think').textContent = fmt(COST.think);
  $('cost-ratio').textContent = '× ' + fmt(COST.think / COST.direct, 1);
}

// ---------- 06 · Learning to think from rewards ----------
// Nine cups: only the final cup is known. The six replies are invented.
const nine = game(4, [[4, 7], [2, 9], [1, 7], [3, 5], [1, 8], [2, 6]]);
const CANDIDATES = [
  { steps: [7, 7, 1, 1, 8, 8] },
  { steps: [7, 7, 1, 1, 1, 1] },
  { steps: [7, 2, 2, 2, 8, 8] },
  { steps: [7, 7, 7, 7, 7, 7] },
  { steps: [7, 7, 1, 1, 8, 8] },
  { steps: [4, 4, 4, 4, 4, 4] },
].map(c => ({ ...c, final: c.steps.at(-1), right: c.steps.at(-1) === nine.ball, chain: c.steps.every((s, i) => s === nine.steps[i]) }));
function candidateList({ marks = false, only = null } = {}) {
  return element('div', 'stack', ...CANDIDATES.map((c, i) => {
    if (only !== null && i !== only) return '';
    const label = !marks ? '' : c.right && c.chain ? say('✓ acierta · premiada', '✓ right · rewarded') : c.right ? say('✓ acierta · premiada (con pasos falsos)', '✓ right · rewarded (with false steps)') : say('✗ falla', '✗ wrong');
    return element('div', 'candidate' + (marks && c.right ? ' chosen' : '') + (marks && c.right && !c.chain ? ' lucky' : ''), raw('code', '', thinkText(nine.start, c.steps, c.final)), ...(label ? [raw('span', 'fine', label)] : []));
  }));
}
function rewardSteps() {
  const lucky = CANDIDATES.findIndex(c => c.right && !c.chain);
  return [
    { stage: 1, title: 'Una pregunta que se puede comprobar', caption: say(`Nueve vasos y seis cambios. Solo sabemos la respuesta: el vaso ${nine.ball}. Nadie ha escrito los pasos.`, `Nine cups and six swaps. We only know the answer: cup ${nine.ball}. Nobody has written the steps.`),
      render: () => element('div', 'stack', cupsRow(9, nine.start), raw('p', 'shell-text', questionText(nine))) },
    { stage: 2, title: 'El modelo escribe varias respuestas', caption: 'Con algo de azar, el modelo piensa varias veces la misma pregunta. Unas veces sigue bien la bola y otras se pierde.', render: () => candidateList() },
    { stage: 3, title: 'Se comprueba cuáles aciertan', caption: 'Un programa mira solo el vaso final. Las que aciertan se premian; las demás, no. No hace falta que nadie lea los pasos.', render: () => candidateList({ marks: true }) },
    { stage: 4, title: 'Se reentrena con las premiadas', caption: 'Se repite con muchas preguntas, se entrena con las respuestas premiadas y empieza otra ronda. Lo que se premió será más probable en la siguiente. Es el bucle del capítulo 10, pero el evaluador es un programa que comprueba.',
      render: () => flow(['Muchas preguntas', 'Varias respuestas a cada una', 'Comprobar', 'Entrenar con las premiadas', 'Repetir']) },
    { stage: 5, title: 'La trampa: acertar por suerte', caption: say(`Esta respuesta acierta el vaso final con pasos equivocados: dice que la bola fue al vaso 2, y no fue. Quien solo comprueba la respuesta la premia igual, y eso enseña pasos falsos. Funciona porque, a medida que el modelo razona mejor, sus aciertos dejan de ser casualidad.`, `This answer gets the final cup right with wrong steps: it says the ball went to cup 2, and it did not. A checker that only looks at the answer rewards it anyway, and that teaches false steps. It works because, as the model reasons better, its right answers stop being chance.`),
      render: () => candidateList({ marks: true, only: lucky }) },
    { stage: 6, title: 'Por qué nueve vasos y no tres', caption: 'Con tres vasos, una respuesta inventada acierta una de cada tres veces, y se premiarían muchos razonamientos equivocados. Con nueve, la suerte acierta solo una de cada nueve. Cuantas más respuestas posibles, menos cuenta la suerte.',
      render: () => element('div', 'two-cases', desk('TRES VASOS', cupsRow(3, 2), raw('strong', 'luck-odds', say('1 de cada 3', '1 in 3')), element('small', '', 'acierta por suerte')),
        desk('NUEVE VASOS', cupsRow(9, 5), raw('strong', 'luck-odds', say('1 de cada 9', '1 in 9')), element('small', '', 'acierta por suerte'))) },
  ];
}

// Hypothetical curves: share of correct reasoning per round, and of rewarded answers that were right by luck.
const MODES = [
  { key: 'answer', label: 'Comprueba la respuesta', curve: [55, 63, 71, 78, 84, 89, 92, 95, 97, 98, 99, 99], luck: [18, 1], verdict: 'Los razonamientos correctos suben ronda a ronda. Al principio se cuelan aciertos por suerte, pero cuanto mejor razona, menos depende de la suerte.' },
  { key: 'steps', label: 'Comprueba cada paso', curve: [55, 70, 82, 90, 95, 97, 98, 99, 99, 100, 100, 100], luck: [0, 0], verdict: 'Sube más deprisa y nunca premia la suerte. Pero exige poder revisar cada paso, y eso no siempre se puede.' },
  { key: 'random', label: 'No comprueba nada', curve: [55, 54, 52, 51, 50, 48, 47, 46, 45, 44, 43, 42], luck: null, verdict: 'Sin comprobar, premia lo bueno y lo malo por igual. El modelo no aprende a razonar mejor.' },
];
let mode = 'answer';
function renderRewards() {
  $('reward-modes').replaceChildren(...MODES.map(m => {
    const button = element('button', 'chip', m.label); button.type = 'button';
    button.setAttribute('aria-pressed', String(m.key === mode));
    button.addEventListener('click', () => { mode = m.key; renderRewards(); });
    return button;
  }));
  const m = MODES.find(x => x.key === mode);
  $('reward-chart').replaceChildren(...m.curve.map((value, i) => {
    const column = element('span', 'round-bar ' + m.key); column.style.height = value + '%';
    column.title = say(`Ronda ${i + 1}: ${pct(value)}`, `Round ${i + 1}: ${pct(value)}`);
    return element('div', 'round-col', raw('small', '', String(value)), column);
  }));
  const stat = (label, value, note) => element('div', 'desk-stat', element('small', '', label), raw('strong', '', value), ...(note ? [element('small', '', note)] : []));
  $('reward-stats').replaceChildren(
    stat('Al empezar', pct(m.curve[0])), stat('Tras 12 rondas', pct(m.curve.at(-1))),
    m.luck === null ? stat('Premiadas por suerte', '—', 'premia también las que fallan')
      : m.luck[0] === 0 ? stat('Premiadas por suerte', say('ninguna', 'none'), 'revisa todos los pasos')
      : stat('Premiadas por suerte', `${pct(m.luck[0])} → ${pct(m.luck[1])}`, 'de la primera a la última ronda'));
  $('reward-verdict').textContent = m.verdict;
}

// ---------- Start ----------
const steppers = [new Stepper($('problem-explainer'), problemSteps), new Stepper($('pass-explainer'), passSteps), new Stepper($('reward-explainer'), rewardSteps)];
buildMistakeControls();
function renderAll() { buildControls(); renderGame(); renderCompareBars(); renderCost(); renderRewards(); }
document.addEventListener('languagechange', () => { renderAll(); steppers.forEach(s => s.refresh()); });
renderAll();
