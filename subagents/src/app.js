import { $, element, Stepper } from '../../tokens/src/ui.js';
import { getLanguage, getLocale } from '../../i18n/i18n.js';

// Every example and number on this page is an illustration: an invented agency, task, profiles and sizes.
const say = (es, en) => getLanguage() === 'en' ? en : es;
// Always group thousands (Spanish leaves «1000» ungrouped by default).
const fmt = (value, digits = 0) => value.toLocaleString(getLocale(), { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: 'always' });
// Files stay as written; the translator leaves them alone.
const raw = (tag, className, ...children) => { const node = element(tag, className, ...children); node.dataset.i18nIgnore = ''; return node; };
const tokens = n => say(`${fmt(n)} tokens`, `${fmt(n)} tokens`);
const millions = n => say(`${fmt(n / 1e6, 1)} millones de tokens`, `${fmt(n / 1e6, 1)} million tokens`);
const flow = items => element('div', 'block-flow', ...items.map(text => element('span', 'block-step', text)));
const bubble = text => element('div', 'chat-line ai wrong', element('span', 'chat-who', 'Agente'), element('p', '', text));
const tag = text => element('span', 'agent-tag', text);

// The desk: one window of a million tokens, as in chapter 16, with the half-way mark.
const WINDOW = 1_000_000;
const BASE = 20_000; // instructions, tools and the task itself
const PARTS = {
  alone: [
    { key: 'search', name: 'Buscar en el manual', tokens: 30_000 },
    { key: 'work', name: 'Hacer el trabajo', tokens: 5_000 },
    { key: 'review', name: 'Revisarlo', tokens: 5_000 },
    { key: 'test', name: 'Probarlo (capturas y registros)', tokens: 20_000 },
  ],
  helped: [
    { key: 'search', name: 'La hoja del buscador', tokens: 2_000 },
    { key: 'work', name: 'Hacer el trabajo', tokens: 5_000 },
    { key: 'review', name: 'El veredicto del revisor', tokens: 1_000 },
    { key: 'test', name: 'El informe del probador', tokens: 2_000 },
  ],
};
const perStep = mode => PARTS[mode].reduce((sum, part) => sum + part.tokens, 0);
function gauge(parts, { scale = true } = {}) {
  const total = parts.reduce((sum, part) => sum + part.tokens, 0);
  const segments = parts.map(part => { const s = element('span', 'gauge-part ' + part.key); s.style.width = Math.min(100, part.tokens / WINDOW * 100) + '%'; s.title = part.name; return s; });
  return element('div', 'run-gauge',
    element('div', 'gauge' + (total > WINDOW ? ' over' : ''), ...segments, element('span', 'gauge-half', element('small', '', 'la mitad'))),
    ...(scale ? [element('div', 'gauge-scale', element('span', '', '0'), element('span', '', say('1.000.000 tokens', '1,000,000 tokens')))] : []));
}
const legend = parts => element('div', 'gauge-legend', ...parts.map(part => element('span', 'legend-item', element('i', 'gauge-part ' + part.key), element('span', '', part.name), raw('small', '', tokens(part.tokens)))));
const deskAfter = (mode, steps) => [{ key: 'base', name: 'Instrucciones y encargo', tokens: BASE }, ...PARTS[mode].map(part => ({ ...part, tokens: part.tokens * steps }))];

// ---------- 01 · A long task fills the desk ----------
function loopSteps() {
  const task = say('Monta la tienda online de Horno Alto: un catálogo de 40 productos, pago con tarjeta y envíos a domicilio.', `Build Horno Alto's online shop: a catalogue of 40 products, card payments and home delivery.`);
  return [
    { stage: 1, title: 'Un encargo de muchos pasos', caption: 'Un encargo así son decenas de pasos: cada producto, cada página, el pago, los envíos. En cada uno, el agente da las mismas cuatro vueltas.', render: () => element('div', 'stack', element('div', 'mission-card', element('span', 'eyebrow', 'EL ENCARGO'), element('p', '', task)), flow(['Buscar en el manual de la tienda', 'Hacer el cambio', 'Revisar el resultado', 'Probarlo en el móvil', 'Siguiente paso ↺'])) },
    { stage: 2, title: 'Todo lo de un paso se queda en la mesa', caption: 'Lee unas 60 páginas del manual de la plataforma, escribe la página, la repasa y la prueba en el móvil con capturas y registros. Todo eso se queda encima: 60.000 tokens más en un solo paso.', render: () => element('div', 'stack', gauge(deskAfter('alone', 1)), legend(PARTS.alone)) },
    { stage: 3, title: 'Al octavo paso, la mesa está a la mitad', caption: 'Cada vuelta reenvía todo lo anterior (capítulo 13), y lo importante se pierde entre capturas y páginas del manual (capítulo 16). Y aún quedan decenas de pasos.', render: () => element('div', 'stack', gauge(deskAfter('alone', 8)), raw('p', 'gauge-note', say(`${tokens(BASE + 8 * perStep('alone'))} en la mesa después de 8 pasos`, `${tokens(BASE + 8 * perStep('alone'))} on the desk after 8 steps`))) },
    { stage: 4, title: 'Y entonces necesita a alguien', caption: 'Aquí entra una persona: para resumir y volver a empezar, para descubrir que el «hecho» no era verdad, o para coger el móvil y probarlo. Cada vez que pasa, el agente deja de trabajar solo.', render: () => element('div', 'help-calls', bubble('Me he perdido: ¿qué estábamos haciendo con los envíos?'), bubble('¡Hecho! La página de pago está lista. (No funciona con tarjetas extranjeras.)'), bubble('¿Puedes probarlo tú en el móvil antes de que siga?')) },
  ];
}
const loopStepper = new Stepper($('loop-explainer'), loopSteps);

// ---------- 02 · What a subagent is ----------
const mission = () => say('Busca en el manual de la plataforma cómo se configuran los gastos de envío por código postal. Devuélveme los pasos en menos de una página, con el apartado del manual de cada uno.', 'Search the platform manual for how to set delivery charges by postcode. Give me the steps in under a page, with the manual section for each one.');
const result = () => say('1. Ajustes → Envíos → Zonas (apartado 4.2)\n2. Una zona por grupo de códigos postales (4.3)\n3. Precio por zona y pedido mínimo (4.5)', '1. Settings → Shipping → Zones (section 4.2)\n2. One zone per group of postcodes (4.3)\n3. Price per zone and minimum order (4.5)');
function desk(title, { parts = [], notes = [], gone = false, tags = [] } = {}) {
  return element('div', 'desk-col' + (gone ? ' gone' : ''), element('span', 'eyebrow', title), ...(tags.length ? [element('div', 'agent-tags', ...tags.map(tag))] : []), gauge(parts, { scale: false }), ...notes);
}
const bossParts = extra => [{ key: 'base', name: 'Instrucciones y encargo', tokens: 120_000 }, ...extra];
const missionNote = () => element('div', 'mission-card small', element('span', 'eyebrow', 'MISIÓN'), element('p', '', mission()));
function ideaSteps() {
  return [
    { stage: 1, title: 'El jefe escribe una misión', caption: 'Una misión tiene que entenderse sola: qué buscar, dónde, y qué quiere de vuelta. El ayudante no va a ver nada más.', render: () => element('div', 'two-desks', desk('MESA DEL JEFE', { parts: bossParts([]), notes: [missionNote()] }), desk('MESA DEL AYUDANTE', { gone: true, notes: [element('p', 'fine', 'Todavía no existe.')] })) },
    { stage: 2, title: 'Un ayudante con la mesa vacía', caption: 'El ayudante empieza solo con la misión encima. Para esta tarea basta un modelo pequeño: es sencilla, aunque hay mucho que leer. Y solo puede leer: no cambia nada.', render: () => element('div', 'two-desks', desk('MESA DEL JEFE', { parts: bossParts([]) }), desk('MESA DEL AYUDANTE', { tags: ['modelo pequeño y barato', 'razona poco', 'solo puede leer'], parts: [{ key: 'search', name: 'La misión', tokens: 3_000 }], notes: [missionNote()] })) },
    { stage: 3, title: 'Trabaja en su mesa', caption: 'Lee las 60 páginas del manual en su mesa. La del jefe no cambia: ni una página del manual llega hasta ella.', render: () => element('div', 'two-desks', desk('MESA DEL JEFE', { parts: bossParts([]) }), desk('MESA DEL AYUDANTE', { tags: ['modelo pequeño y barato'], parts: [{ key: 'search', name: 'La misión y 60 páginas del manual', tokens: 33_000 }], notes: [raw('p', 'gauge-note', say(`Lee ${tokens(30_000)} del manual`, `Reads ${tokens(30_000)} of the manual`))] })) },
    { stage: 4, title: 'Devuelve una hoja y su mesa se tira', caption: 'Vuelven los pasos y el apartado de cada uno, por si el jefe quiere comprobarlo. Todo lo demás se tira. El jefe sigue con la mesa casi igual de despejada.', render: () => element('div', 'two-desks', desk('MESA DEL JEFE', { parts: bossParts([{ key: 'result', name: 'El resultado', tokens: 2_000 }]), notes: [element('div', 'note-file', element('span', 'eyebrow', 'RESULTADO'), raw('pre', '', result()))] }), desk('MESA DEL AYUDANTE', { gone: true, notes: [element('p', 'fine', 'Se tira: ya no hace falta.')] })) },
  ];
}
const ideaStepper = new Stepper($('idea-explainer'), ideaSteps);

// ---------- 03 · Three helpers ----------
const HELPERS = [
  { key: 'search', button: 'El buscador', why: 'Mucho volumen, poca dificultad', profile: ['Modelo barato', 'Razona poco', 'Leer y buscar'],
    mission: () => say('Busca en el manual cómo se configuran los envíos por código postal y devuélveme los pasos, con el apartado de cada uno.', 'Search the manual for how to set delivery by postcode and give me the steps, with the section for each one.'),
    returns: 'Una hoja con los pasos y las referencias.',
    gain: 'La mesa del jefe no se llena con el manual, y lo leído se paga a precio de modelo barato.',
    catch: 'Puede pasar algo por alto, y un resumen siempre pierde detalles. Pídele las referencias: así el jefe puede ir a mirar.' },
  { key: 'review', button: 'El revisor', why: 'Unos ojos que no han visto cómo se hizo', profile: ['Un modelo bueno, mejor si es otro', 'Razona mucho', 'Leer y ejecutar las pruebas'],
    mission: () => say('Revisa la página de pago de la carpeta tienda/. Comprueba la lista de requisitos y ejecuta las pruebas. Devuelve «aprobado» o la lista de fallos.', 'Review the payment page in the shop/ folder. Check the list of requirements and run the tests. Return «approved» or the list of faults.'),
    returns: 'Un veredicto: aprobado, o la lista de fallos.',
    gain: 'No arrastra las prisas ni las excusas de quien hizo el trabajo: mira el resultado tal cual, como un compañero que llega de nuevas.',
    catch: 'La mesa limpia quita el sesgo de la conversación, no el del modelo: si es el mismo modelo, puede tener los mismos puntos ciegos. Mejor otro modelo, y mejor aún si su veredicto se apoya en una prueba que se pueda ejecutar.' },
  { key: 'test', button: 'El probador', why: 'Reaccionar rápido importa más que pensar mucho', profile: ['Modelo muy rápido', 'Razona poco', 'Un móvil: mirar, tocar y escribir'],
    mission: () => say('Abre la tienda en el móvil y compra un pan de centeno con envío al 50001. Si algo falla, devuelve una captura y lo que hiciste justo antes.', 'Open the shop on the phone and buy a rye loaf for delivery to 50001. If anything fails, return a screenshot and what you did just before.'),
    returns: '«Compra hecha», o el fallo con su captura.',
    gain: 'Probar es tocar, mirar y volver a tocar decenas de veces. Con un modelo lento cada toque se hace esperar; con uno rápido, la prueba va al ritmo de una persona. Lo mismo sirve para jugar a un juego y probarlo.',
    catch: 'Es menos fino: encuentra lo que se rompe, pero no juzga si la tienda es bonita o fácil de usar. Eso se lo devuelve al jefe.' },
];
let helper = 'search';
function renderHelpers() {
  $('helper-picker').replaceChildren(...HELPERS.map(h => {
    const button = element('button', 'chip', h.button); button.type = 'button';
    button.setAttribute('aria-pressed', String(h.key === helper));
    button.addEventListener('click', () => { helper = h.key; renderHelpers(); });
    return button;
  }));
  const h = HELPERS.find(x => x.key === helper);
  const field = (label, ...children) => element('div', 'helper-field', element('span', 'eyebrow', label), ...children);
  $('helper-card').replaceChildren(
    element('div', 'helper-head', element('h3', '', h.button), element('p', '', h.why), element('div', 'agent-tags', ...h.profile.map(tag))),
    field('LA MISIÓN', element('div', 'mission-card small', element('p', '', h.mission()))),
    field('LO QUE DEVUELVE', element('p', '', h.returns)),
    field('POR QUÉ AYUDA', element('p', '', h.gain)),
    field('LA PEGA', element('p', 'catch', h.catch)));
}

// ---------- 04 · Who does what ----------
const PROFILES = [{ key: 'smart', name: 'El listo' }, { key: 'cheap', name: 'El barato' }, { key: 'fast', name: 'El rápido' }];
const TASKS = [
  { text: 'Leer 200 páginas de documentación para encontrar un dato', ok: ['cheap'], why: 'Mucho volumen y poca dificultad: lo que importa es leer mucho sin gastar mucho.' },
  { text: 'Decidir cómo se organiza la tienda: categorías, páginas y pagos', ok: ['smart'], why: 'Es una decisión que condiciona todo lo demás. Aquí sí compensa el mejor modelo.' },
  { text: 'Probar 50 pantallas de la tienda en el móvil', ok: ['fast'], why: 'Son cientos de toques y miradas: manda la velocidad.' },
  { text: 'Revisar la página de pago antes de publicarla', ok: ['smart'], why: 'Un fallo en el pago cuesta dinero. Merece un buen revisor, a ser posible distinto de quien la hizo.' },
  { text: 'Cambiar el nombre a las fotos de los 40 productos', ok: ['cheap', 'fast'], why: 'Mecánico y repetitivo: cualquiera de los dos pequeños lo hace bien.' },
  { text: 'Escribir al cliente para explicarle un retraso', ok: ['smart'], why: 'Pocas palabras, pero importan el tono y el criterio. No hay volumen que abaratar.' },
];
const answers = new Map();
function renderAssign() {
  $('assign-list').replaceChildren(...TASKS.map((task, i) => {
    const picked = answers.get(i), right = picked && task.ok.includes(picked);
    const buttons = PROFILES.map(p => {
      const button = element('button', 'chip', p.name); button.type = 'button';
      button.setAttribute('aria-pressed', String(picked === p.key));
      button.addEventListener('click', () => { answers.set(i, p.key); renderAssign(); });
      return button;
    });
    const best = task.ok.map(key => PROFILES.find(p => p.key === key).name).join(say(' o ', ' or '));
    const feedback = !picked ? [] : [element('p', 'assign-feedback', element('strong', '', right ? 'Bien elegido.' : say(`Mejor ${best.toLowerCase()}.`, `Better: ${best.toLowerCase()}.`)), ' ', task.why)];
    return element('div', 'assign-row' + (picked ? right ? ' right' : ' wrong' : ''), element('p', 'assign-task', task.text), element('div', 'assign-buttons', ...buttons), ...feedback);
  }));
  const done = answers.size, right = [...answers].filter(([i, key]) => TASKS[i].ok.includes(key)).length;
  $('assign-score').replaceChildren(done < TASKS.length
    ? element('span', '', say(`Llevas ${done} de ${TASKS.length}.`, `${done} of ${TASKS.length} done.`))
    : element('span', '', element('strong', '', say(`${right} de ${TASKS.length}.`, `${right} out of ${TASKS.length}.`)), ' ', 'El listo decide y revisa lo importante; el volumen y la velocidad, a los pequeños.'));
}

// ---------- 05 · From the short loop to the long one ----------
let runStep = 1, runTimer = 0;
function runPanel(mode) {
  const per = perStep(mode), onDesk = BASE + runStep * per;
  let resent = 0; for (let i = 1; i <= runStep; i++) resent += BASE + i * per;
  const halfAt = Math.ceil((WINDOW / 2 - BASE) / per), fullAt = Math.ceil((WINDOW - BASE) / per);
  const state = onDesk > WINDOW ? ['No cabe.', ' Hay que resumir o empezar de nuevo, y alguien tiene que decidir qué se guarda.', ' alert']
    : onDesk >= WINDOW / 2 ? ['Ha llegado a la mitad.', ' Cada vuelta sale cara y lo importante se pierde entre tanto papel.', ' alert']
    : ['Mesa despejada.', ' Puede seguir trabajando solo.', ''];
  const stat = (label, value, note) => element('div', 'desk-stat', element('small', '', label), raw('strong', '', value), ...(note ? [element('small', '', note)] : []));
  return [gauge(deskAfter(mode, runStep)),
    element('div', 'desk-stats', stat('En la mesa ahora', onDesk > WINDOW ? say(`${fmt(onDesk / WINDOW, 1)} veces la mesa`, `${fmt(onDesk / WINDOW, 1)} times the desk`) : tokens(onDesk), say(`${fmt(per)} más por paso`, `${fmt(per)} more per step`)),
      stat('Reenviado hasta ahora', resent < 1e6 ? tokens(resent) : millions(resent), 'todo lo que se ha vuelto a enviar en cada vuelta'),
      stat('Llega a la mitad', say(`en el paso ${halfAt}`, `at step ${halfAt}`), say(`y se llena en el ${fullAt}`, `and is full at step ${fullAt}`))),
    element('div', 'lesson-note' + state[2], element('strong', '', state[0]), state[1])];
}
function renderRun() {
  $('run-steps').value = String(runStep);
  $('run-count').textContent = say(`Paso ${runStep} de 50`, `Step ${runStep} of 50`);
  $('run-alone').replaceChildren(...runPanel('alone'));
  $('run-helped').replaceChildren(...runPanel('helped'));
  $('run-play').textContent = runTimer ? '❚❚ Pausa' : '▶ Reproducir';
  const row = part => element('div', 'breakdown-row', element('span', '', part.name), raw('strong', '', tokens(part.tokens)));
  $('run-breakdown').replaceChildren(
    element('div', 'breakdown-col', element('span', 'eyebrow', 'CADA PASO, SOLO'), ...PARTS.alone.map(p => row(p)), element('div', 'breakdown-row total', element('span', '', 'Por paso'), raw('strong', '', tokens(perStep('alone'))))),
    element('div', 'breakdown-col', element('span', 'eyebrow', 'CADA PASO, CON AYUDANTES'), ...PARTS.helped.map(p => row(p)), element('div', 'breakdown-row total', element('span', '', 'Por paso'), raw('strong', '', tokens(perStep('helped'))))));
}
function stopRun() { clearInterval(runTimer); runTimer = 0; renderRun(); }
$('run-steps').addEventListener('input', event => { runStep = Number(event.target.value); stopRun(); });
$('run-play').addEventListener('click', () => {
  if (runTimer) return stopRun();
  if (runStep >= 50) runStep = 0;
  runTimer = setInterval(() => { runStep += 1; if (runStep >= 50) { runStep = 50; stopRun(); } else renderRun(); }, 180);
  renderRun();
});

// ---------- 07 · A Claude Code subagent ----------
const agentFile = () => say(`---
name: buscador-docs
description: Busca en la documentación y devuelve un resumen corto con referencias. Úsalo cuando haya mucho que leer para encontrar un dato.
tools: Read, Grep, Glob
model: haiku
---

Busca lo que te pidan en la carpeta docs/.
Devuelve como mucho una página: la respuesta y,
para cada dato, el archivo y el apartado de donde sale.
No cambies ningún archivo.`, `---
name: docs-searcher
description: Searches the documentation and returns a short summary with references. Use it when there is a lot to read to find one fact.
tools: Read, Grep, Glob
model: haiku
---

Search the docs/ folder for what you are asked.
Return one page at most: the answer and, for each
fact, the file and section it comes from.
Do not change any file.`);
function renderAgentFile() {
  $('agent-file').replaceChildren(element('div', 'note-file', raw('code', '', say('.claude/agents/buscador-docs.md', '.claude/agents/docs-searcher.md')), raw('pre', '', agentFile())));
}

function renderAll() { renderHelpers(); renderAssign(); renderRun(); renderAgentFile(); }
// The steppers' missions and numbers carry their own English, so they are rebuilt too.
document.addEventListener('languagechange', () => { loopStepper.refresh(); ideaStepper.refresh(); renderAll(); });
renderAll();
