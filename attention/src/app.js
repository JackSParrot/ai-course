import { buildCorpus, buildStories } from '../../tokens/src/corpus.js';
import { BpeTrainer } from '../../tokens/src/bpe.js';
import { $, element, fmt, css, percent, tokenElement, bars, cells, drawChart, Stepper } from '../../tokens/src/ui.js';
import * as mlp from '../../predictor/src/model.js';
import * as tf from './transformer.js';

const VOCABULARY_SIZE = 600, EPOCHS = 6, { BOS, UNK } = mlp;

// The chapter 07–08 sentences plus two-sentence stories whose ending needs a distant clue.
const base = buildCorpus(), stories = buildStories();
const trainLines = [...base.train, ...stories.train].map(item => item.text);
const validationLines = [...base.validation, ...stories.validation].map(item => item.text);
const tokenizer = new BpeTrainer(trainLines.join('\n')).train(VOCABULARY_SIZE).tokenizer();
const vocabulary = mlp.buildVocabulary(trainLines.flatMap(line => tokenizer.encode(line)));
const encode = text => mlp.toIndices(vocabulary, tokenizer.encode(text));
const modelText = index => index === BOS ? '∅' : index === UNK ? '?' : tokenizer.vocab[vocabulary.tokens[index]];
const placeIndex = place => vocabulary.index.get(tokenizer.ids.get(tokenizer.pieces(place)[0]));
const storyItems = stories.validation.map(item => { const line = encode(item.text); return { line, at: line.lastIndexOf(placeIndex(item.answer)) }; });
const strong = value => element('strong', '', String(value));
const chipRow = items => element('div', 'token-strip', ...items.map(item => tokenElement(item.text, item)));
const topRows = (probabilities, count = 6) => [...probabilities.keys()].filter(i => i !== BOS && i !== UNK)
  .sort((a, b) => probabilities[b] - probabilities[a]).slice(0, count).map(index => ({ index, text: modelText(index), value: probabilities[index] }));

let models = null, history = [], epoch = 0, running = false;

// ---------- 01 · The problem ----------
const STORY = 'El mago persigue al robot en el desierto. Después, el mago vuelve al desierto.';
const storyLine = encode(STORY), storyAt = storyLine.lastIndexOf(placeIndex(' desierto')), clueAt = storyLine.indexOf(placeIndex(' desierto'));
function storyChips(classFor) {
  return chipRow(storyLine.slice(0, storyAt + 1).map((index, i) => i === storyAt ? { text: ' ?', className: 'target' } : { text: modelText(index), className: classFor(i) }));
}
function problemSteps() {
  const seenFrom = storyAt - 4;
  return [
    { stage: 1, title: 'Una historia de dos frases', caption: 'El final repite el lugar de la primera frase. Para nosotros es evidente: el mago vuelve al desierto. ¿Puede adivinarlo una red?', render: () => storyChips(() => '') },
    {
      stage: 2, title: 'Lo que ve la red del capítulo 08', caption: ['Solo ve los últimos 4 tokens (naranja). Con ', element('em', '', '«el mago vuelve al»'), ' vale cualquier lugar: castillo, bosque, puerto… Con 5 lugares posibles acertaría 1 de cada 5 veces, por casualidad.'],
      render: () => storyChips(i => i >= seenFrom ? 'seen' : 'faded'),
    },
    {
      stage: 3, title: 'La pista está lejos', caption: ['La respuesta estaba en la primera frase, a ', strong(storyAt - clueAt), ' tokens de distancia. Fuera de la ventana de 4, para la red del 08 no existe.'],
      render: () => storyChips(i => i === clueAt ? 'clue' : i >= seenFrom ? 'seen' : 'faded'),
    },
    {
      stage: 4, title: '¿Y si le damos más huecos?', caption: 'Se podría ampliar la ventana, pero cada hueco tiene sus propios pesos. La red tendría que aprender por separado «mago en el hueco 2» y «mago en el hueco 12», y los pesos crecerían con cada hueco nuevo. La atención usa otra idea: los mismos pesos para cualquier posición.',
      render: () => element('div', 'slot-row', ...storyLine.slice(0, storyAt).map((index, i) => element('span', 'slot', tokenElement(modelText(index)), element('small', '', `W${i + 1}`)))),
    },
  ];
}
new Stepper($('problem-explainer'), problemSteps);

// ---------- 02 · How attention works (live numbers) ----------
function howSteps() {
  const model = models.transformer, sequence = [BOS, ...storyLine.slice(0, storyAt)], cache = tf.forward(model, sequence), n = cache.n, last = n - 1, D = model.D;
  const row = cache.attention.subarray(last * n, last * n + n), text = i => modelText(sequence[i]);
  const vector = (source, i) => source.subarray(i * D, i * D + D);
  const scale = source => 2.5 * source.reduce((s, v) => s + Math.abs(v), 0) / source.length;
  const scores = sequence.map((_, s) => vector(cache.q, last).reduce((sum, v, d) => sum + v * cache.k[s * D + d], 0) / Math.sqrt(D));
  const order = [...row.keys()].sort((a, b) => row[b] - row[a]);
  const trained = epoch > 0;
  const lookBack = () => chipRow(sequence.map((index, i) => ({ text: modelText(index), className: i === last ? 'seen' : 'lookable' })));
  return [
    { stage: 1, title: 'Cada token mira hacia atrás', caption: ['Con atención, cada token puede consultar a todos los anteriores, y a sí mismo, pero nunca a los siguientes. Seguimos al último, ', tokenElement(text(last)), ': tiene que decidir qué lugar viene. «∅» marca el inicio del texto.'], render: lookBack },
    {
      stage: 2, title: 'Una pregunta y una clave para cada token', caption: 'Como en un buscador. Cada token lanza una pregunta («¿qué busco?») y publica una clave («esto es lo que soy»). Ambas se calculan a partir de su ficha con pesos aprendidos. Si la pregunta de «al» se parece a la clave de otro token, su puntuación sube: es el número de la derecha. Igual que las fichas, nadie les pone nombre: se aprenden.',
      render: () => element('div', 'stack', element('div', 'embedding-row', element('span', 'vocab-label', 'Pregunta de'), tokenElement(text(last)), cells(vector(cache.q, last), { scale: scale(cache.q) })),
        element('div', 'key-table', ...order.slice(0, 6).map(s => element('div', 'embedding-row', element('span', 'vocab-label', 'Clave de'), tokenElement(text(s)), cells(vector(cache.k, s), { scale: scale(cache.k) }), element('span', 'score', fmt(scores[s], 2)))))),
    },
    {
      stage: 3, title: 'Las puntuaciones se convierten en porcentajes', caption: ['Las puntuaciones pasan por la misma función que daba las probabilidades (softmax) y se convierten en porcentajes que suman 100 %. ', trained ? 'Ya entrenada, casi toda la atención va al lugar de la primera frase.' : 'Sin entrenar, se reparte casi por igual.'],
      render: () => { const box = element('div', 'bars'); bars(box, sequence.map((index, s) => ({ text: modelText(index), value: row[s], className: s === clueAt + 1 ? 'correct' : '' }))); return box; },
    },
    {
      stage: 4, title: 'Se mezcla la información', caption: 'Cada token anterior aporta su valor (otra ficha que dice «esta es mi información»), multiplicado por su porcentaje. La suma es una ficha nueva para «al» que ya lleva dentro el lugar, aunque estuviera lejos.',
      render: () => element('div', 'stack', ...order.slice(0, 3).map(s => element('div', 'embedding-row', tokenElement(text(s)), element('span', 'score', percent(row[s]), ' ×'), cells(vector(cache.v, s), { scale: scale(cache.v) }))),
        element('span', 'arrow', '= ↓'), element('div', 'embedding-row', element('span', 'vocab-label', 'Ficha nueva'), cells(vector(cache.z, last), { scale: scale(cache.z) }))),
    },
    {
      stage: 5, title: 'La posición se suma a la ficha', caption: 'La atención, por sí sola, no sabe el orden: compara fichas, no posiciones. Por eso a la ficha de cada token se le suma la ficha de su posición (1.ª, 2.ª, 3.ª…), también aprendida. Así distingue antes y después usando los mismos pesos en cualquier posición.',
      render: () => element('div', 'stack', element('div', 'embedding-row', element('span', 'vocab-label', 'Ficha de'), tokenElement(text(last)), cells(model.params.E.subarray(sequence[last] * D, sequence[last] * D + D), { scale: scale(model.params.E) })),
        element('div', 'embedding-row', element('span', 'vocab-label', '+ posición'), strong(`${last + 1}.ª`), cells(model.params.P.subarray(last * D, last * D + D), { scale: scale(model.params.E) })),
        element('div', 'embedding-row', element('span', 'vocab-label', '= entrada'), cells(vector(cache.x0, last), { scale: scale(cache.x0) }))),
    },
    {
      stage: 6, title: 'El bloque completo', caption: ['Esto es un bloque de transformer. «+ lo que había» significa que cada paso suma su resultado a la ficha en lugar de sustituirla. Este tiene ', strong(fmt(tf.parameterCount(model))), ' pesos; los LLM apilan decenas de bloques como este.'],
      render: () => {
        const box = element('div', 'bars'); bars(box, topRows(tf.probabilitiesAt(model, cache, last), 3));
        return element('div', 'block-flow', ...['Tokens', 'Ficha + posición', 'Atención + lo que había', 'Capa oculta + lo que había', 'Probabilidades del siguiente token'].map(label => element('span', 'block-step', label)), box);
      },
    },
  ];
}

// ---------- 03 · Train and compare ----------
const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
let how;
function resetModels() {
  worker.postMessage({ kind: 'reset', vocabularySize: vocabulary.tokens.length, train: trainLines.map(encode), validation: validationLines.map(encode), stories: storyItems });
}
worker.onmessage = ({ data }) => {
  if (data.kind === 'tick') { $('epoch-progress').style.width = data.done * 100 + '%'; return; }
  models = { mlp: mlp.restore(data.mlp), transformer: tf.restore(data.transformer) };
  history = data.history; epoch = data.epoch; running = data.running;
  $('epoch-progress').style.width = running ? '0%' : '100%';
  if (!how) how = new Stepper($('how-explainer'), howSteps); else how.refresh();
  renderState(); renderComparison(); renderCompareBars(); renderMap();
};
function renderState() {
  const pill = $('attention-state'), last = history.at(-1);
  pill.classList.toggle('untrained', epoch === 0);
  if (epoch === 0) pill.textContent = 'Ahora está sin entrenar: la atención se reparte casi por igual. Entrénalo en la sección 03 y vuelve aquí.';
  else pill.replaceChildren('Entrenado: ', strong(fmt(epoch)), ' épocas, ', strong(percent(last.transformer.story)), ' de acierto en el lugar repetido.');
}
function renderComparison() {
  const last = history.at(-1);
  $('epoch').textContent = fmt(epoch);
  $('mlp-params').textContent = fmt(mlp.parameterCount(models.mlp)); $('tf-params').textContent = fmt(tf.parameterCount(models.transformer));
  $('mlp-accuracy').textContent = percent(last.mlp.accuracy); $('tf-accuracy').textContent = percent(last.transformer.accuracy);
  $('mlp-story').textContent = percent(last.mlp.story); $('tf-story').textContent = percent(last.transformer.story);
  $('train').disabled = running; $('pause').disabled = !running; $('reset-model').disabled = running;
  drawChart($('story-chart'), [
    { values: history.map(h => h.mlp.story * 100), color: css('--chart-validation'), xLabel: 'Épocas →' },
    { values: history.map(h => h.transformer.story * 100), color: css('--chart-train') },
  ]);
}
$('train').addEventListener('click', () => worker.postMessage({ kind: 'train', epochs: EPOCHS }));
$('pause').addEventListener('click', () => worker.postMessage({ kind: 'pause' }));
$('reset-model').addEventListener('click', resetModels);

// Long texts keep their latest tokens: the transformer was built for up to T positions.
const fit = (indices, room) => indices.slice(Math.max(0, indices.length - room));
function renderCompareBars() {
  const before = encode($('compare-input').value), T = models.transformer.T;
  bars($('mlp-bars'), topRows(mlp.predict(models.mlp, mlp.contextWindow(before, models.mlp.N)), 5));
  const sequence = [BOS, ...fit(before, T - 1)], cache = tf.forward(models.transformer, sequence);
  bars($('tf-bars'), topRows(tf.probabilitiesAt(models.transformer, cache, sequence.length - 1), 5));
}
$('compare-input').addEventListener('input', () => models && renderCompareBars());

// ---------- 04 · Attention map ----------
let focusRow = -1;
function renderMap() {
  const T = models.transformer.T, sequence = [BOS, ...fit(encode($('map-input').value), T - 1)], cache = tf.forward(models.transformer, sequence), n = cache.n;
  if (focusRow < 0 || focusRow >= n) {
    // Start on the token just before the repeated place, if there is one.
    const places = sequence.map((index, i) => [index, i]).filter(([index]) => stories.validation.some(s => placeIndex(s.answer) === index));
    focusRow = places.length > 1 ? places.at(-1)[1] - 1 : n - 1;
  }
  const grid = $('attention-matrix');
  grid.style.gridTemplateColumns = `auto repeat(${n}, minmax(18px, 1fr))`;
  const header = [element('span', 'corner'), ...sequence.map(index => element('span', 'column-label', tokenElement(modelText(index))))];
  const rows = sequence.flatMap((index, t) => {
    const label = element('button', 'row-label' + (t === focusRow ? ' active' : ''), tokenElement(modelText(index)));
    label.type = 'button'; label.addEventListener('click', () => { focusRow = t; renderMap(); });
    return [label, ...sequence.map((_, s) => {
      const value = s <= t ? cache.attention[t * n + s] : 0, cell = element('span', 'cell' + (s > t ? ' future' : '') + (t === focusRow ? ' active' : ''));
      cell.style.setProperty('--weight', value); cell.title = s <= t ? percent(value) : '';
      return cell;
    })];
  });
  grid.replaceChildren(...header, ...rows);
  $('focus-token').replaceChildren(tokenElement(modelText(sequence[focusRow])));
  bars($('focus-bars'), sequence.slice(0, focusRow + 1).map((index, s) => ({ text: modelText(index), value: cache.attention[focusRow * n + s] })).sort((a, b) => b.value - a.value).slice(0, 6));
}
$('map-input').addEventListener('input', () => { focusRow = -1; if (models) renderMap(); });

const redraw = () => { if (models) renderComparison(); };
document.addEventListener('languagechange', redraw);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redraw);
resetModels();
