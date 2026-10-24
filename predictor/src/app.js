import { translateText } from '../../i18n/i18n.js';
import { buildCorpus, joinText, CATEGORIES } from '../../tokens/src/corpus.js';
import { BpeTrainer } from '../../tokens/src/bpe.js';
import { $, element, fmt, css, percent, reducedMotion, tokenElement, renderStrip, bars, cells, drawChart, Stepper } from '../../tokens/src/ui.js';
import { buildVocabulary, toIndices, contextWindow, restore, forward, predict, sample, parameterCount, BOS, UNK } from './model.js';
import { project } from './embedding-map.js';

const VOCABULARY_SIZE = 600, EPOCHS = 8;

// Same tokenizer and corpus as chapter 07; the model only predicts tokens seen in training.
const corpus = buildCorpus();
const trainText = joinText(corpus.train), validationText = joinText(corpus.validation);
const tokenizer = new BpeTrainer(trainText).train(VOCABULARY_SIZE).tokenizer();
const trainIds = tokenizer.encode(trainText), validationIds = tokenizer.encode(validationText);
const vocabulary = buildVocabulary(trainIds);
const trainIndices = toIndices(vocabulary, trainIds), validationIndices = toIndices(vocabulary, validationIds);
const modelText = index => index === BOS ? '∅' : index === UNK ? '?' : tokenizer.vocab[vocabulary.tokens[index]];
const topRows = (probabilities, count = 10, correct = -1) => [...probabilities.keys()].filter(i => i !== BOS && i !== UNK)
  .sort((a, b) => probabilities[b] - probabilities[a]).slice(0, count)
  .map(index => ({ index, text: modelText(index), value: probabilities[index], className: index === correct ? 'correct' : '' }));
const strong = value => element('strong', '', String(value));
const chipRow = (items, className = 'token-strip') => element('div', className, ...items.map(item => tokenElement(item.text, item)));

let model = null, history = [], epoch = 0, running = false;
const results = new Map();

// ---------- 01 · What an embedding is ----------
const indexOf = word => vocabulary.index.get(tokenizer.ids.get(word));
const embedding = index => model.params.E.subarray(index * model.D, index * model.D + model.D);
const unit = row => { const norm = Math.hypot(...row) || 1; return Array.from(row, v => v / norm); };
// Cosine similarity: 1 means the two rows point the same way, 0 means unrelated.
function neighbours(index, count = 6) {
  const a = unit(embedding(index));
  return words.filter(i => i !== index).map(i => ({ index: i, text: modelText(i), value: unit(embedding(i)).reduce((s, x, k) => s + x * a[k], 0) }))
    .sort((x, y) => y.value - x.value).slice(0, count).map(row => ({ ...row, label: fmt(row.value, 2) }));
}
// A hand-made illustration: three named traits per word. Real embeddings have unnamed, learned numbers.
const TRAITS = ['¿Es un ser vivo?', '¿Es un lugar?', '¿Es un color?'];
const CARDS = [[' princesa', [.95, 0, 0]], [' dragón', [.8, .2, .1]], [' castillo', [0, .95, 0]], [' bosque', [.45, .72, .2]], [' rojo', [0, 0, 1]], [' verde', [.1, .1, .9]]];
const EXAMPLE_WORDS = [' rojo', ' verde', ' dragón', ' princesa', ' castillo'];
// Two real training sentences with the same gap: the word changes, what follows does not.
const SAME_GAP = ['El dragón encuentra al mago en el desierto.', 'El mago encuentra al caballero en el desierto.'];
const PAIRS = [[' dragón', ' mago'], [' dragón', ' rojo']];
const similarity = (a, b) => { const x = unit(embedding(indexOf(a))), y = unit(embedding(indexOf(b))); return x.reduce((s, v, k) => s + v * y[k], 0); };
// Similarity of each pair after every epoch, so the explainer can show the cards moving closer.
let similarityHistory = [];
function recordSimilarity() {
  if (epoch === 0) similarityHistory = [];
  if (similarityHistory.at(-1)?.epoch !== epoch) similarityHistory.push({ epoch, values: PAIRS.map(([a, b]) => similarity(a, b)) });
}
const invented = () => element('p', 'invented-note', '✎ Ejemplo inventado: estos rasgos y sus valores los hemos puesto a mano para explicar la idea. La red real no tiene rasgos con nombre.');
function embedSteps() {
  const castle = tokenizer.ids.get(' castillo'), trained = epoch > 0;
  const card = ([word, values]) => element('div', 'trait-card', tokenElement(word), ...TRAITS.map((trait, k) => {
    const fill = element('span'); fill.style.width = values[k] * 100 + '%';
    return element('div', 'trait', element('span', '', trait), element('span', 'fill', fill));
  }));
  const plane = () => {
    const box = element('div', 'trait-plane', element('span', 'axis x', '¿Es un ser vivo? →'), element('span', 'axis y', '¿Es un lugar? →'));
    for (const [word, [alive, place]] of CARDS) { const chip = tokenElement(word); chip.style.left = 3 + alive * 64 + '%'; chip.style.bottom = 4 + place * 74 + '%'; box.append(chip); }
    return box;
  };
  const rows = () => element('div', 'embedding-rows', ...EXAMPLE_WORDS.map(word => element('div', 'embedding-row', tokenElement(word), element('span', 'arrow', '→'), cells(embedding(indexOf(word)), { scale: embeddingScale() }))));
  const table = () => {
    const shown = [2, 3, 4, indexOf(' dragón'), vocabulary.tokens.length - 1];
    return element('table', 'embed-table', ...shown.flatMap((index, k) => [
      ...(k === 3 || k === 4 ? [element('tr', '', element('td', '', '⋮'), element('td', '', ''))] : []),
      element('tr', index === indexOf(' dragón') ? 'focus' : '', element('td', '', tokenElement(modelText(index))), element('td', '', cells(embedding(index), { scale: embeddingScale() }))),
    ]));
  };
  const adjusting = () => {
    const sentences = element('div', 'stack', ...SAME_GAP.map(sentence => {
      const pieces = tokenizer.pieces(sentence);
      return chipRow(pieces.map((text, i) => ({ text, className: i === 1 ? 'seen' : i === 2 ? 'target' : i > 2 ? 'faded' : '' })));
    }), element('span', 'fine', 'Naranja: el hueco · verde: el token que viene después, igual en las dos frases.'));
    const history = PAIRS.map(([a, b], k) => element('div', 'similarity-row', element('span', 'pair', tokenElement(a), '↔', tokenElement(b)),
      element('span', 'similarity-history', ...similarityHistory.map(point => {
        const bar = element('span', 'similarity-bar'), inner = element('span');
        inner.style.height = Math.max(4, point.values[k] * 100) + '%'; bar.append(inner); bar.title = `${point.epoch}: ${fmt(point.values[k], 2)}`;
        return bar;
      })), strong(fmt(similarityHistory.at(-1)?.values[k] ?? 0, 2))));
    const action = running ? element('span', 'fine', 'Entrenando… época ', strong(fmt(epoch)))
      : epoch === 0 ? Object.assign(element('button', 'button primary small', 'Entrenar 8 épocas y mirar'), { type: 'button', onclick: () => worker.postMessage({ kind: 'train', epochs: EPOCHS }) })
      : element('span', 'fine', 'Cada barra es una época, de izquierda a derecha. Pulsa «Reiniciar pesos» en la sección 04 para verlo otra vez desde cero.');
    return element('div', 'stack', sentences, element('div', 'similarity-box', element('span', 'vocab-label', 'Parecido entre fichas, época a época'), ...history, action));
  };
  const nearby = () => element('div', 'neighbour-columns', ...[' dragón'].map(word => {
    const box = element('div', 'bars'); bars(box, neighbours(indexOf(word), 5));
    return element('div', '', element('h4', '', 'Vecinos de ', tokenElement(word)), box);
  }));
  return [
    {
      stage: 1, title: 'Un número de token es solo una etiqueta', caption: 'Los números salen del orden en que el tokenizador aprendió sus piezas. Que dos números estén seguidos no significa que sus tokens se parezcan, igual que dos páginas seguidas de un diccionario no hablan de lo mismo.',
      render: () => element('div', 'stack', ...[castle - 1, castle, castle + 1].map(id => element('div', 'id-line' + (id === castle ? ' focus' : ''), element('span', '', String(id)), tokenElement(tokenizer.vocab[id])))),
    },
    { stage: 2, title: 'Mejor: una ficha con varios rasgos', caption: 'Imagina la ficha de un personaje de un juego, con barras de fuerza o magia. Si describimos cada token con varios rasgos, ya podemos compararlos. Ojo: aquí los rasgos los hemos escrito nosotros. En el paso 5 verás de dónde salen los de verdad.', render: () => element('div', 'stack', invented(), element('div', 'trait-cards', ...CARDS.map(card))) },
    { stage: 3, title: 'Fichas parecidas, significados parecidos', caption: 'Si colocamos cada ficha según dos de sus rasgos, los tokens que se parecen quedan cerca: los personajes por un lado, los lugares por otro y los colores en otro rincón.', render: () => element('div', 'stack', invented(), plane()) },
    {
      stage: 4, title: 'La red aprende sus propias fichas', caption: ['En la red real, cada token tiene ', strong(model.D), ' números en lugar de 3, y nadie les pone nombre: empiezan al azar y se ajustan al entrenar, como cualquier otro peso. ', trained ? 'Estas fichas ya están entrenadas.' : 'Ahora mismo son aleatorias: la red aún no ha entrenado.', ' En el paso siguiente verás cómo se ajustan.'],
      render: rows,
    },
    {
      stage: 5, title: 'Cómo se ajustan: mismo hueco, misma respuesta', caption: ['Nadie le dice a la red qué es un personaje. La red solo intenta acertar el siguiente token. En estas dos frases del texto de entrenamiento, el mismo hueco lo ocupan ', tokenElement(' dragón'), ' (arriba) ', tokenElement(' mago'), ' (abajo), y detrás viene lo mismo. Para acertar en los dos casos, cada corrección empuja sus fichas en la misma dirección y acaban pareciéndose. ', tokenElement(' rojo'), ' nunca aparece en ese hueco, así que su ficha no se acerca.'],
      render: adjusting,
    },
    { stage: 6, title: 'Por dentro: una tabla con una fila por token', caption: ['Todas las fichas forman una tabla de ', strong(fmt(model.V)), ' filas (una por token) y ', strong(model.D), ' columnas. Usar un embedding es buscar la fila de su número de token: es la primera capa de la red.'], render: table },
    {
      stage: 7, title: 'Los vecinos: qué tokens tienen fichas parecidas', caption: ['Para comparar dos fichas se mira si sus números apuntan en la misma dirección (similitud: 1 = igual, 0 = sin relación). ', trained ? 'Tras entrenar, los vecinos suelen ser tokens que se usan igual: otros personajes, a veces la traducción. Prueba otras palabras en la sección 05: con una red tan pequeña no todas salen tan claras.' : 'Sin entrenar, los vecinos son casuales. Entrena la red en la sección 04 y vuelve a este paso.'],
      render: nearby,
    },
  ];
}
// Colours saturate at about twice the typical size, so most cells stay readable.
const embeddingScale = () => 2.5 * model.params.E.reduce((sum, v) => sum + Math.abs(v), 0) / model.params.E.length;

// ---------- 02 · How it decides (live, with the current weights) ----------
function decideSteps() {
  const ids = tokenizer.encode($('explain-input').value), indices = toIndices(vocabulary, ids), N = model.N;
  const window = contextWindow(indices, N), { x, h } = forward(model, window), probabilities = predict(model, window);
  const choice = topRows(probabilities, 1)[0], from = ids.length - N;
  const textChips = (extra = []) => chipRow([...ids.map((id, i) => ({ text: tokenizer.vocab[id], className: i >= from ? 'seen' : 'faded' })), ...extra]);
  return [
    { stage: 1, title: 'El texto se convierte en tokens', caption: 'Es lo que hacía el tokenizador del capítulo 07: cada pieza del texto se cambia por su número.', render: () => chipRow(ids.map(id => ({ text: tokenizer.vocab[id], small: id }))) },
    { stage: 2, title: 'La red solo mira los últimos tokens', caption: ['Esta red mira los últimos ', strong(N), ' tokens (su contexto). Todo lo anterior no existe para ella.'], render: () => element('div', 'stack', textChips(), element('span', 'fine', ids.length < N ? 'Si hay menos tokens que contexto, los huecos se rellenan con «∅» (inicio del texto).' : '')) },
    {
      stage: 3, title: 'Cada token se cambia por su fila de números', caption: ['Cada token del contexto se cambia por su embedding, la ficha de ', strong(model.D), ' números de la sección 01. Las fichas se ponen una detrás de otra: ', strong(`${N} × ${model.D} = ${N * model.D}`), ' números de entrada.'],
      render: () => element('div', 'embedding-rows', ...window.map(index => element('div', 'embedding-row', tokenElement(modelText(index)), element('span', 'arrow', '→'), cells(embedding(index), { scale: embeddingScale() })))),
    },
    {
      stage: 4, title: 'Una capa oculta combina esos números', caption: ['Como en los dígitos: cada una de sus ', strong(model.H), ' neuronas multiplica todas las entradas por sus pesos, suma y aplica una activación. Verde: positivo · coral: negativo.'],
      render: () => element('div', 'layer-flow', element('span', 'vocab-label', 'Entrada'), cells(x, { scale: embeddingScale() }), element('span', 'arrow', '↓'), element('span', 'vocab-label', 'Capa oculta'), cells(h)),
    },
    {
      stage: 5, title: 'Una probabilidad para cada token', caption: ['La capa de salida tiene una neurona por cada token del vocabulario: ', strong(fmt(model.V)), '. Sus puntuaciones se convierten en probabilidades que suman 100 %, igual que las barras del 0 al 9 en los dígitos. Aquí ves las 8 más altas.'],
      render: () => { const box = element('div', 'bars'); bars(box, topRows(probabilities, 8)); return box; },
    },
    {
      stage: 6, title: 'Se elige uno, se añade y se repite', caption: 'Aquí elegimos el más probable. El token se añade al texto, la ventana avanza un paso y todo vuelve a empezar. Así escribe un modelo de lenguaje: token a token.',
      render: () => {
        // The window slides: it now ends with the token just chosen.
        const all = [...ids.map(id => tokenizer.vocab[id]), choice.text], start = all.length - N;
        return element('div', 'stack',
          chipRow(all.map((text, i) => ({ text, className: (i === all.length - 1 ? 'generated fresh ' : '') + (i >= start ? 'seen' : 'faded') }))),
          element('div', 'example-line', element('span', 'vocab-label', 'Elegido'), tokenElement(choice.text, { className: 'generated' }), strong(percent(choice.value))),
          element('span', 'loop-note', '↻ La ventana avanza y se vuelve al paso 3'));
      },
    },
  ];
}

// ---------- 03 · How it learns: a sliding window over one sentence ----------
const LESSON_SENTENCE = 'El coche azul frena antes de la curva.';
function learnSteps() {
  const ids = tokenizer.encode(LESSON_SENTENCE), indices = toIndices(vocabulary, ids), N = model.N, steps = [];
  const sentence = (k = -1) => chipRow(ids.map((id, i) => ({ text: tokenizer.vocab[id], className: k < 0 ? '' : i === k ? 'target' : i >= k - N && i < k ? 'seen' : 'faded' })));
  steps.push({ stage: 1, title: 'Una frase del texto de entrenamiento', caption: 'Las frases de entrenamiento no llevan etiquetas: la respuesta correcta ya está en el propio texto, porque sabemos qué token venía después.', render: () => sentence() });
  for (let k = 0; k < ids.length; k++) {
    const window = contextWindow(indices.slice(0, k), N), p = predict(model, window)[indices[k]];
    steps.push({
      stage: 2, title: `Ejemplo ${k + 1} de ${ids.length}`,
      caption: ['Pregunta: los últimos ', strong(N), ' tokens (naranja). Respuesta correcta: el siguiente (verde). La ventana avanza un token en cada ejemplo.'],
      render: () => element('div', 'stack', sentence(k), element('div', 'example-line', chipRow(window.map(index => ({ text: modelText(index), className: 'seen' }))), element('span', 'arrow', '→'), tokenElement(modelText(indices[k]), { className: 'target' })), element('div', 'answer-bar', element('span', '', 'La red da a la respuesta correcta'), element('span', 'fill', Object.assign(element('span'), { style: `width:${p * 100}%` })), strong(percent(p)))),
    });
  }
  // Show the position where the network fails most: that is where training has work to do.
  const chance = k => predict(model, contextWindow(indices.slice(0, k), N))[indices[k]];
  const k = [...ids.keys()].slice(1).reduce((worst, i) => chance(i) < chance(worst) ? i : worst, 1);
  const window = contextWindow(indices.slice(0, k), N), probabilities = predict(model, window);
  const rows = topRows(probabilities, 6, indices[k]);
  if (!rows.some(r => r.index === indices[k])) rows.push({ index: indices[k], text: modelText(indices[k]), value: probabilities[indices[k]], className: 'correct' });
  steps.push({
    stage: 3, title: 'El error: cuánto apostó por la respuesta correcta', caption: 'La barra verde es la respuesta correcta. Cuanto más baja, más error. Entrenar es ajustar todos los pesos un poquito para que suba: es la misma retropropagación del capítulo 02.',
    render: () => { const box = element('div', 'bars'); bars(box, rows); return element('div', 'stack', sentence(k), box); },
  });
  steps.push({
    stage: 4, title: 'Y eso, miles de veces', caption: 'Cada token del texto de entrenamiento es un ejemplo. Una época los recorre todos una vez; el botón de la sección siguiente entrena 8 épocas.',
    render: () => element('div', 'fact-grid', ...[[fmt(corpus.train.length), 'frases de entrenamiento'], [fmt(trainIds.length), 'tokens = ejemplos por época'], [fmt(trainIds.length * EPOCHS), 'ejemplos en 8 épocas']].map(([value, label]) => element('div', '', strong(value), element('span', '', label)))),
  });
  return steps;
}

// ---------- 04 · Training ----------
const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
const context = () => Number($('context-size').value);
let embed, decide, learn;
function resetModel() {
  worker.postMessage({ kind: 'reset', vocabularySize: vocabulary.tokens.length, settings: { context: context() }, train: trainIndices, validation: validationIndices });
}
worker.onmessage = ({ data }) => {
  if (data.kind === 'tick') { $('epoch-progress').style.width = data.cursor / data.total * 100 + '%'; return; }
  model = restore(data.model); history = data.history; epoch = data.epoch; running = data.running;
  recordSimilarity();
  if (epoch > 0) results.set(model.N, { epochs: epoch, accuracy: history.at(-1).accuracy });
  $('epoch-progress').style.width = running ? '0%' : '100%';
  if (!decide) { embed = new Stepper($('embed-explainer'), embedSteps); decide = new Stepper($('decide-explainer'), decideSteps); learn = new Stepper($('learn-explainer'), learnSteps); }
  else { embed.refresh(); decide.refresh(); learn.refresh(); }
  renderState(); renderModel(); renderPrediction(); renderNeighbours(); renderMap(); renderGeneration();
};
function renderState() {
  const pill = $('explain-state'), last = history.at(-1);
  pill.classList.toggle('untrained', epoch === 0);
  if (epoch === 0) pill.textContent = 'Ahora está sin entrenar: sus probabilidades son casi al azar. Entrénala en la sección 04 y vuelve aquí.';
  else pill.replaceChildren('Entrenada: ', strong(fmt(epoch)), ' épocas, ', strong(percent(last.accuracy)), ' de acierto. Las barras ya reflejan lo aprendido.');
}
function renderModel() {
  const last = history.at(-1);
  $('epoch').textContent = fmt(epoch);
  $('accuracy').textContent = last ? percent(last.accuracy) : '—';
  $('validation-loss').textContent = last ? fmt(last.validationLoss, 2) : '—';
  $('parameters').textContent = fmt(parameterCount(model));
  $('train').disabled = running; $('pause').disabled = !running; $('context-size').disabled = running; $('reset-model').disabled = running;
  $('untrained-note').hidden = epoch > 0;
  drawChart($('loss-chart'), [
    { values: history.map(h => h.trainLoss), color: css('--chart-train'), xLabel: 'Épocas →' },
    { values: history.map(h => h.validationLoss), color: css('--chart-validation') },
  ]);
  const rows = [...results].sort((a, b) => a[0] - b[0]), best = Math.max(...rows.map(([, r]) => r.accuracy));
  $('context-results').replaceChildren(...rows.map(([n, r]) => element('tr', r.accuracy === best && rows.length > 1 ? 'best' : '',
    element('td', '', `${n} ${n === 1 ? 'token' : 'tokens'}`), element('td', '', fmt(r.epochs)), element('td', '', percent(r.accuracy)))));
  $('context-results-empty').hidden = rows.length > 0;
}
$('train').addEventListener('click', () => worker.postMessage({ kind: 'train', epochs: EPOCHS }));
$('pause').addEventListener('click', () => worker.postMessage({ kind: 'pause' }));
$('reset-model').addEventListener('click', resetModel);
$('context-size').addEventListener('change', resetModel);
$('explain-input').addEventListener('input', () => decide?.refresh());

function renderPrediction() {
  const ids = tokenizer.encode($('predict-input').value), indices = toIndices(vocabulary, ids), from = ids.length - model.N;
  renderStrip($('predict-tokens'), ids.map((id, i) => ({ text: tokenizer.vocab[id], className: i >= from ? 'seen' : '' })));
  bars($('predict-bars'), topRows(predict(model, contextWindow(indices, model.N))));
}
$('predict-input').addEventListener('input', renderPrediction);

// ---------- 05 · Embedding neighbours and map ----------
const categoryOf = new Map(Object.entries(CATEGORIES).flatMap(([name, words]) => words.map(word => [word, name])));
const frequency = new Map();
for (const index of trainIndices) frequency.set(index, (frequency.get(index) || 0) + 1);
const words = [...frequency].filter(([index]) => /^ \p{L}{2,}$/u.test(modelText(index))).sort((a, b) => b[1] - a[1]).map(([index]) => index);
// Grouped words show the clusters; a few frequent others give a neutral background.
const mapTokens = [...words.filter(i => categoryOf.has(modelText(i).trim())), ...words.filter(i => !categoryOf.has(modelText(i).trim())).slice(0, 14)];
const quantile = (values, q) => { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.floor(q * (sorted.length - 1))]; };
function renderMap() {
  const canvas = $('embedding-map'), ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height, { E } = model.params, D = model.D;
  // Direction matters more than length here; outliers are clamped so they cannot squash the rest.
  const points = project(mapTokens.map(i => unit(E.subarray(i * D, i * D + D))));
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const [x0, x1, y0, y1] = [quantile(xs, .04), quantile(xs, .96), quantile(ys, .04), quantile(ys, .96)];
  const clamp = v => Math.min(1, Math.max(0, v));
  const sx = x => 40 + clamp((x - x0) / (x1 - x0 || 1)) * (w - 140), sy = y => 50 + clamp((y - y0) / (y1 - y0 || 1)) * (h - 75);
  const colors = { colors: css('--chart-validation'), characters: '#5b7fb5', places: '#a1588a' };
  ctx.clearRect(0, 0, w, h); ctx.font = '13px Consolas, monospace';
  mapTokens.forEach((index, k) => {
    const word = modelText(index).trim(), color = colors[categoryOf.get(word)] || css('--muted');
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(sx(points[k][0]), sy(points[k][1]), 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillText(word, sx(points[k][0]) + 6, sy(points[k][1]) + 4);
  });
  ctx.font = '12px Segoe UI, Arial, sans-serif';
  [['colors', 'Colores'], ['characters', 'Personajes'], ['places', 'Lugares']].forEach(([key, label], i) => {
    ctx.fillStyle = colors[key]; ctx.fillText('● ' + translateText(label), 12 + i * 120, 20);
  });
}
$('refresh-map').addEventListener('click', renderMap);
const neighbourWords = [' dragón', ' princesa', ' red', ' rojo', ' castillo', ' bosque', ' coche', ' gira'].filter(word => indexOf(word));
$('neighbour-word').replaceChildren(...neighbourWords.map(word => Object.assign(element('option', '', word.trim()), { value: word })));
$('neighbour-word').dataset.i18nIgnore = '';
function renderNeighbours() { bars($('neighbour-bars'), neighbours(indexOf($('neighbour-word').value))); }
$('neighbour-word').addEventListener('change', renderNeighbours);

// ---------- 06 · Generation ----------
let generated = [], generating = false;
const temperature = () => Number($('temperature').value);
const promptIndices = () => toIndices(vocabulary, tokenizer.encode($('generate-input').value));
function renderGeneration(fresh = false) {
  const prompt = tokenizer.encode($('generate-input').value);
  renderStrip($('generation'), [
    ...prompt.map(id => ({ text: tokenizer.vocab[id], className: 'prompt' })),
    ...generated.map((index, k) => ({ text: modelText(index), className: 'generated' + (fresh && k === generated.length - 1 ? ' fresh' : '') })),
  ]);
  bars($('generate-bars'), topRows(predict(model, contextWindow([...promptIndices(), ...generated], model.N))), { onPick: row => { generated.push(row.index); renderGeneration(true); } });
}
function generateStep() {
  generated.push(sample(predict(model, contextWindow([...promptIndices(), ...generated], model.N)), temperature()));
  renderGeneration(true);
}
$('generate-step').addEventListener('click', generateStep);
$('generate-clear').addEventListener('click', () => { generated = []; renderGeneration(); });
$('generate-input').addEventListener('input', () => { generated = []; renderGeneration(); });
$('temperature').addEventListener('input', () => { $('temperature-value').textContent = fmt(temperature(), 1); });
$('generate').addEventListener('click', () => {
  if (generating) return;
  generating = true; $('generate').disabled = true;
  let left = 25;
  const tick = () => { generateStep(); if (--left > 0) setTimeout(tick, reducedMotion ? 0 : 90); else { generating = false; $('generate').disabled = false; } };
  tick();
});

// Canvas labels are drawn text, so redraw them when the language or theme changes.
const redraw = () => { if (model) { renderModel(); renderMap(); } };
document.addEventListener('languagechange', redraw);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redraw);

$('temperature-value').textContent = fmt(temperature(), 1);
resetModel();
