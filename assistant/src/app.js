import { BpeTrainer } from '../../tokens/src/bpe.js';
import { random } from '../../tokens/src/corpus.js';
import { $, element, fmt, css, percent, tokenElement, drawChart, Stepper } from '../../tokens/src/ui.js';
import { buildVocabulary, toIndices, BOS, UNK } from '../../predictor/src/model.js';
import * as tf from '../../attention/src/transformer.js';
import { buildWorld, conversation, judge, rate, CHARACTERS, PLACES, STOP } from './world.js';

const VOCABULARY_SIZE = 600, ROUNDS = 6, INSTRUCTIONS = 120;

// One tokenizer for everything the model will read: plain text and conversations.
const world = buildWorld();
const instructions = world.instructions.slice(0, INSTRUCTIONS);
const allText = [...world.pretrain, ...world.instructions.map(c => c.prompt + c.reply)].join('\n');
const tokenizer = new BpeTrainer(allText).train(VOCABULARY_SIZE).tokenizer();
const vocabulary = buildVocabulary(tokenizer.encode(allText));
const encode = text => toIndices(vocabulary, tokenizer.encode(text));
const modelText = index => index === BOS ? '∅' : index === UNK ? '?' : tokenizer.vocab[vocabulary.tokens[index]];
const decode = indices => tokenizer.decode(indices.map(i => vocabulary.tokens[i] ?? 0));
const STOP_INDEX = encode(STOP)[0];
const item = c => ({ prompt: encode(c.prompt), reply: encode(c.reply), place: c.place, opinion: c.opinion });
const strong = value => element('strong', '', String(value));
const chipRow = items => element('div', 'token-strip', ...items.map(i => tokenElement(i.text, i)));
const promptChips = text => tokenizer.pieces(text).map(t => ({ text: t, className: 'prompt' }));

let models = {}, history = [], running = false;
const runs = [];

// ---------- 01 · The three phases (illustration) ----------
function phaseSteps() {
  const sample = world.instructions[0];
  return [
    { stage: 1, title: 'Preentrenar: leer muchísimo texto', caption: 'Billones de tokens de libros, webs y código. La red aprende el idioma, datos del mundo y también costumbres del texto, por ejemplo que la gente suele darse la razón. El resultado es un modelo base: solo continúa textos.', render: () => element('div', 'stack', ...world.pretrain.slice(0, 4).map(line => chipRow(tokenizer.pieces(line).map(text => ({ text }))))) },
    { stage: 2, title: 'Instrucciones: conversaciones de ejemplo', caption: 'Personas escriben miles de conversaciones con la respuesta ideal. Se entrena igual, pero solo con los tokens de la respuesta. El modelo aprende el formato, a responder y a terminar su turno.', render: () => chipRow([...promptChips(sample.prompt), ...tokenizer.pieces(sample.reply).map(text => ({ text, className: 'generated' }))]) },
    { stage: 3, title: 'Preferencias: elegir la mejor', caption: 'El modelo genera varias respuestas y una persona elige la que prefiere. Se entrena con las elegidas y se repite. Es barato y escala, pero el modelo aprende exactamente lo que se premia.', render: () => element('div', 'stack', ...[' Está en el desierto.', ' Sí, está en el bosque.', ' Está en el puerto.'].map((reply, i) => element('div', 'candidate' + (i === 0 ? ' chosen' : ''), chipRow(tokenizer.pieces(reply + STOP).map(text => ({ text, className: 'generated' }))), element('span', 'fine', i === 0 ? '✓ elegida' : '')))) },
    { stage: 4, title: 'El resultado: un asistente', caption: 'Responde preguntas, sigue instrucciones y sabe cuándo parar. Casi todo lo que sabe viene del preentrenamiento; las otras dos fases cambian sobre todo cómo se comporta. Vas a hacer las tres fases ahora.', render: () => element('div', 'block-flow', ...['Modelo base', '+ instrucciones', '+ preferencias', '= asistente'].map(label => element('span', 'block-step', label))) },
  ];
}
new Stepper($('phases-explainer'), phaseSteps);

// ---------- Worker ----------
const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
worker.postMessage({
  kind: 'setup', vocabularySize: vocabulary.tokens.length, stop: STOP_INDEX, tokenizer: tokenizer.toJSON(), tokens: vocabulary.tokens,
  pretrain: world.pretrain.map(encode), instructions: instructions.map(item), preferences: world.preferences.map(item), test: world.test.map(item),
});
let progressBar = null;
worker.onmessage = ({ data }) => {
  if (data.kind === 'progress') { if (progressBar) progressBar.style.width = data.done * 100 + '%'; return; }
  if (data.kind === 'round') { history = data.history; models.tuned = tf.restore(data.model); renderExperiment(); return; }
  if (data.kind !== 'stage') return;
  models[data.stage] = tf.restore(data.model);
  if (data.stage === 'base') { $('base-status').textContent = 'Preentrenado.'; $('instruct').disabled = false; $('instruct-status').textContent = ''; renderBase(); }
  if (data.stage === 'assistant') {
    $('instruct-status').textContent = 'Ajustado.'; $('prefer').disabled = false; $('prefer-status').textContent = '';
    $('assistant-truth').textContent = percent(data.metrics.truthful); $('assistant-agree').textContent = percent(data.metrics.agrees); $('assistant-stops').textContent = percent(data.metrics.stops);
    renderAsk(); preferences.refresh(); renderQuestion();
  }
  if (data.stage === 'tuned') {
    running = false; history = data.history; $('prefer').disabled = false; $('stop').disabled = true; $('prefer-status').textContent = 'Terminado.';
    runs.push({ likes: settings().likesAgreement, checks: settings().checksFacts, ...history.at(-1) });
    renderExperiment(); renderRuns();
  }
  if (progressBar) progressBar.style.width = '100%';
  setBusy(false);
};
function setBusy(busy) { for (const id of ['pretrain', 'instruct']) $(id).disabled = busy || (id === 'instruct' && !models.base); }
function start(kind, bar, message = {}) { progressBar = $(bar); progressBar.style.width = '0%'; setBusy(true); worker.postMessage({ kind, ...message }); }

// ---------- 02 · Base model ----------
function continueText(model, text, { stop = -1, maxTokens = 12 } = {}) {
  return tf.generate(model, [BOS, ...encode(text)], { maxTokens, stop });
}
function renderGeneration(container, text, indices) {
  container.replaceChildren(...promptChips(text).map(i => tokenElement(i.text, i)), ...indices.map(index => tokenElement(modelText(index), { className: 'generated' })));
}
function renderBase() { if (models.base) renderGeneration($('base-output'), $('base-input').value, continueText(models.base, $('base-input').value)); }
$('pretrain').addEventListener('click', () => { $('base-status').textContent = 'Preentrenando…'; start('pretrain', 'base-progress'); });
$('base-input').addEventListener('input', renderBase);
for (const chip of document.querySelectorAll('[data-base]')) chip.addEventListener('click', () => { $('base-input').value = chip.dataset.base; renderBase(); });

// ---------- 03 · Instruction tuning ----------
$('demo-conversations').replaceChildren(...instructions.filter(c => c.opinion).slice(0, 1).concat(instructions.filter(c => !c.opinion).slice(0, 2))
  .map(c => chipRow([...promptChips(c.prompt), ...tokenizer.pieces(c.reply).map(text => ({ text, className: 'generated' }))])));
$('instruct').addEventListener('click', () => { $('instruct-status').textContent = 'Ajustando…'; start('instruct', 'instruct-progress'); });
function renderAsk() { if (models.assistant) renderGeneration($('ask-output'), $('ask-input').value, continueText(models.assistant, $('ask-input').value, { stop: STOP_INDEX })); }
$('ask-input').addEventListener('input', renderAsk);

// ---------- 04 · One round of preferences, live ----------
const settings = () => ({ likesAgreement: Number($('likes').value) / 100, checksFacts: Number($('checks').value) / 100 });
function preferenceSteps() {
  const example = world.test.find(c => c.opinion !== c.place), question = item(example);
  if (!models.assistant) return [{ stage: 1, title: 'Primero ajusta con instrucciones', caption: 'Esta explicación usa el asistente de la sección 03. Entrénalo y vuelve aquí.', render: () => chipRow(promptChips(example.prompt)) }];
  const rng = random(3), candidates = Array.from({ length: 6 }, () => decode(tf.generate(models.assistant, [BOS, ...question.prompt], { maxTokens: 10, temperature: 1.3, stop: STOP_INDEX, rng })));
  const pick = rate(candidates, example, settings(), random(4));
  const label = answer => { const v = judge(answer, example); return v.truthful ? 'verdad' : v.agrees ? 'le da la razón' : v.wellFormed ? 'otro lugar' : 'mal escrita'; };
  const list = (highlight = -1) => element('div', 'stack', ...candidates.map((answer, i) => element('div', 'candidate' + (i === highlight ? ' chosen' : ''), chipRow(tokenizer.pieces(answer).map(text => ({ text, className: 'generated' }))), element('span', 'fine', label(answer) + (i === highlight ? ' · ✓ elegida' : '')))));
  return [
    { stage: 1, title: 'Una pregunta con una opinión equivocada', caption: ['El texto dice ', strong(example.place), ', pero el usuario cree que está en el ', strong(example.opinion), '.'], render: () => chipRow(promptChips(example.prompt)) },
    { stage: 2, title: 'El modelo genera varias respuestas', caption: 'Con temperatura alta, el asistente propone respuestas distintas. Algunas dicen la verdad; otras, influidas por la opinión del usuario, le dan la razón.', render: () => list() },
    { stage: 3, title: 'El evaluador elige una', caption: pick < 0 ? 'Con tus ajustes, el evaluador no premia ninguna: comprueba los hechos y ninguna es correcta.' : 'El evaluador elige según tus ajustes de la sección 05. Cambia los controles y vuelve a este paso.', render: () => list(pick) },
    { stage: 4, title: 'Se reentrena con las elegidas', caption: 'Se repite con muchas preguntas y el modelo se entrena con las respuestas elegidas. En la ronda siguiente, lo que se eligió será más probable. Varias rondas después, el modelo se parece a lo que prefieren los evaluadores.', render: () => element('div', 'block-flow', ...['Preguntas', 'Varias respuestas cada una', 'El evaluador elige', 'Entrenar con las elegidas', 'Repetir'].map(text => element('span', 'block-step', text))) },
  ];
}
const preferences = new Stepper($('pref-explainer'), preferenceSteps);

// ---------- 05 · The experiment ----------
function renderSliders() { $('likes-value').textContent = $('likes').value + ' %'; $('checks-value').textContent = $('checks').value + ' %'; preferences.refresh(); }
for (const id of ['likes', 'checks']) $(id).addEventListener('input', renderSliders);
for (const chip of document.querySelectorAll('[data-likes]')) chip.addEventListener('click', () => { $('likes').value = chip.dataset.likes; $('checks').value = chip.dataset.checks; renderSliders(); });
$('prefer').addEventListener('click', () => {
  running = true; history = []; $('prefer').disabled = true; $('stop').disabled = false; $('prefer-status').textContent = 'Aplicando rondas…';
  start('prefer', 'prefer-progress', { settings: { ...settings(), rounds: ROUNDS } });
});
$('stop').addEventListener('click', () => worker.postMessage({ kind: 'stop' }));
function renderExperiment() {
  drawChart($('pref-chart'), [
    { values: history.map(h => h.truthful * 100), color: css('--chart-train'), xLabel: 'Rondas →' },
    { values: history.map(h => h.agrees * 100), color: css('--chart-validation') },
  ]);
  renderQuestion();
}
function renderRuns() {
  $('runs').replaceChildren(...runs.map(run => element('tr', '', element('td', '', percent(run.likes)), element('td', '', percent(run.checks)), element('td', '', percent(run.truthful)), element('td', '', percent(run.agrees)))));
  $('runs-empty').hidden = runs.length > 0;
}
// Questions built from menus, answered by the instruction-tuned assistant and by the tuned one.
const fill = (select, options, value) => { select.replaceChildren(...options.map(o => Object.assign(element('option', '', o), { value: o }))); select.value = value; select.dataset.i18nIgnore = ''; };
fill($('q-character'), CHARACTERS, 'el mago'); fill($('q-place'), PLACES, 'desierto'); fill($('q-opinion'), PLACES, 'bosque');
function renderQuestion() {
  const c = conversation($('q-character').value, $('q-place').value, $('q-opinion').value);
  $('q-prompt').replaceChildren(...promptChips(c.prompt).map(i => tokenElement(i.text, i)));
  for (const [id, model] of [['q-assistant', models.assistant], ['q-tuned', models.tuned]]) {
    const box = $(id);
    if (!model) { box.replaceChildren(element('span', 'fine', id === 'q-tuned' ? 'Aplica las rondas de preferencias.' : 'Ajusta con instrucciones.')); continue; }
    const reply = continueText(model, c.prompt, { stop: STOP_INDEX, maxTokens: 10 }), v = judge(decode(reply), c);
    box.replaceChildren(...reply.map(index => tokenElement(modelText(index), { className: 'generated' })), element('span', 'verdict ' + (v.truthful ? 'good' : 'bad'), v.truthful ? '✓ verdad' : v.agrees ? '✗ le da la razón' : '✗ falso'));
  }
}
for (const id of ['q-character', 'q-place', 'q-opinion']) $(id).addEventListener('change', renderQuestion);

const redraw = () => renderExperiment();
document.addEventListener('languagechange', redraw);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redraw);
renderSliders(); renderRuns(); renderQuestion(); drawChart($('pref-chart'), []);
