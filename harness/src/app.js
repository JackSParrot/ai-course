import { $, element, reducedMotion, Stepper } from '../../tokens/src/ui.js';
import { getLanguage, translateText } from '../../i18n/i18n.js';
import { SESSION } from './session.js';

const { levels, experiment } = SESSION;
const strong = value => element('strong', '', String(value));
const flow = items => element('div', 'block-flow', ...items.map(text => element('span', 'block-step', text)));
// Phrases built around numbers or file names, in the language of the page.
const say = (es, en) => getLanguage() === 'en' ? en : es;
// Recorded text and code stay as they were written; the translator leaves them alone.
const raw = (tag, className, ...children) => { const node = element(tag, className, ...children); node.dataset.i18nIgnore = ''; return node; };
// The model writes Markdown: show its **bold**, `code`, lists and tables as plain elements.
const inline = text => text.split(/(\*\*[^*]+\*\*|`[^`]+`)/).filter(Boolean)
  .map(part => part.startsWith('**') ? element('strong', '', part.slice(2, -2)) : part.startsWith('`') ? element('code', '', part.slice(1, -1)) : part);
const cells = line => line.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());
const table = lines => element('table', 'agent-table', ...lines.map((line, i) => element('tr', '', ...cells(line).map(cell => element(i ? 'td' : 'th', '', ...inline(cell))))));
// The chat ends with a template table in a code block; the prose before it is the answer.
const prose = text => text.split('```')[0].trim().split('\n').filter((line, i, all) => !(i === all.length - 1 && line.trim().endsWith(':'))).join('\n');
const markdown = (className, text) => raw('div', className, ...text.split('\n').filter(line => line.trim()).map(line => element('p', '', ...inline(line.replace(/^\s*[-*] /, '• ')))));

// ---------- 01 · Only text ----------
function textSteps() {
  return [
    { stage: 1, title: 'Escribe la continuación', caption: 'Le das un texto y escribe lo que viene después, palabra a palabra. Si el texto es una pregunta, lo que viene después suele ser una respuesta. Es todo lo que hace.', render: () => flow(['Texto que entra', 'El modelo', 'Texto que sale']) },
    { stage: 2, title: 'No puede hacer nada más', caption: 'Si le pides «clasifica los tickets de esta carpeta», no puede abrirla. No sabe ni qué tickets hay. Solo puede escribir algo que suene a respuesta o decirte que no los ve.', render: () => element('div', 'can-list', element('span', 'cannot', '✗ Abrir una carpeta'), element('span', 'cannot', '✗ Escribir un documento'), element('span', 'can', '✓ Escribir texto')) },
    { stage: 3, title: 'Pero puede pedirlo', caption: 'En una de nuestras pruebas, como un chat y sin ninguna herramienta, el modelo escribió esto y se paró. Es una petición para usar una herramienta, con el formato que conoce. Pero es solo texto.', render: () => raw('pre', 'code-view void-call', SESSION.voidCall.trim()) },
    { stage: 4, title: 'Alguien tiene que hacerlo', caption: 'Nadie la ejecutó: al otro lado no había nadie. Hace falta un programa que lea esa petición, abra la carpeta de verdad, le pegue al modelo lo que hay y le deje seguir. Ese programa es el arnés.', render: () => flow(['Modelo: «quiero ver la carpeta recibos»', 'Arnés: abre la carpeta', 'Arnés: le pega lo que hay dentro', 'Modelo: sigue escribiendo']) },
  ];
}
new Stepper($('text-explainer'), textSteps);

// ---------- A recorded session, as things a person would see ----------
function describe(action) {
  switch (action.kind) {
    case 'list': return { icon: '📁', what: 'Mira qué hay en la carpeta', result: say(`${action.files} tickets`, `${action.files} receipts`) };
    case 'read': return action.count > 1
      ? { icon: '📄', what: say(`Abre los ${action.count} tickets, uno a uno`, `Opens the ${action.count} receipts, one by one`) }
      : { icon: '📄', what: ['Abre el ticket ', raw('code', '', action.file)] };
    case 'readAll': return { icon: '📄', what: 'Lee todos los tickets de una vez' };
    case 'find': return { icon: '📄', what: 'Lee los tickets por partes', result: say(`${action.files} tickets`, `${action.files} receipts`) };
    case 'blocked': return { icon: '⛔', what: 'Intenta leerlos todos de golpe con una orden', result: 'El arnés no la deja pasar: no puede comprobar qué hará. El modelo busca otra forma.', state: 'bad' };
    case 'compute': return { icon: '🧮', what: 'Repasa las sumas con un pequeño programa', result: raw('code', 'compute-output', action.output.split('\n').join(' · ')), state: 'good' };
    case 'write': return { icon: '✏️', what: ['Escribe el archivo ', raw('code', '', action.file)] };
    default: return { icon: '▶', what: 'Usa el ordenador' };
  }
}
function items(level) {
  const list = level.steps.flatMap(step => [...(step.say ? [{ icon: '💬', what: raw('q', '', ...inline(step.say)) }] : []), ...step.actions.map(describe)]);
  list.push({ icon: '💬', what: 'Te responde', final: level.final });
  return list;
}
function timelineItem(item) {
  return element('div', 'timeline-item' + (item.state ? ' ' + item.state : ''), element('span', 'timeline-icon', item.icon),
    element('div', 'timeline-body', element('div', 'timeline-what', ...[].concat(item.what)), ...(item.result ? [element('div', 'timeline-result', item.result)] : []), ...(item.final ? [markdown('chat-answer small', item.final)] : [])));
}
const checked = level => [element('p', 'lesson-note', 'Comprobado desde fuera: ', strong(say(`están los ${level.check.listed} tickets, cada uno una vez`, `all ${level.check.listed} receipts are there, once each`)), ', con su importe exacto y una categoría razonable. El total, ', strong(say('3.616,36 €', '€3,616.36')), ', es exacto.'),
  element('p', 'fine', say(`El resumen de su tabla, tal como lo escribió:`, `The summary of its table, as it wrote it:`)), raw('div', 'table-scroll', table(level.summary))];

// ---------- 02 · Two programs ----------
const agentItems = () => items(levels.agent);
let shown = 1, timer = 0;
function renderTwo() {
  $('request-text').replaceChildren(raw('span', '', '«' + SESSION.prompt + '»'));
  $('receipt-sample').replaceChildren(raw('span', '', SESSION.sample.text.trim()));
  $('chat-answer').replaceChildren(markdown('', prose(levels.chat.final)));
  const list = agentItems();
  $('agent-timeline').replaceChildren(...list.slice(0, shown).map(timelineItem), ...(shown === list.length ? checked(levels.agent) : []));
  $('agent-next').disabled = shown >= list.length;
}
function stopPlay() { clearInterval(timer); timer = 0; $('agent-play').textContent = translateText('▶ Reproducir'); }
$('agent-next').addEventListener('click', () => { stopPlay(); shown = Math.min(agentItems().length, shown + 1); renderTwo(); });
$('agent-reset').addEventListener('click', () => { stopPlay(); shown = 1; renderTwo(); });
$('agent-play').addEventListener('click', () => {
  if (timer) return stopPlay();
  if (shown >= agentItems().length) shown = 0;
  if (reducedMotion) { shown = agentItems().length; renderTwo(); return; }
  $('agent-play').textContent = translateText('❚❚ Pausa');
  const tick = () => { shown++; renderTwo(); if (shown >= agentItems().length) stopPlay(); };
  tick(); timer = setInterval(tick, 1100);
});

// ---------- 03 · Inside the harness ----------
const rounds = levels.agent.steps.length + 1;
const PARTS = [
  { key: 'instructions', name: 'Las instrucciones', short: 'lo que lee antes que tu mensaje',
    text: 'Antes de tu encargo, el arnés pone un texto que el modelo lee cada vez: quién es, cómo trabajar, qué no tocar. Claude Code trae las suyas, y les suma las tuyas, por ejemplo las de un archivo CLAUDE.md. En nuestra grabación le añadimos estas:',
    example: () => raw('blockquote', 'part-quote', 'Trabajas con los archivos de la carpeta actual. Cuando termines, explica en dos o tres frases qué has hecho.') },
  { key: 'tools', name: 'Las herramientas', short: 'los botones que puede pedir',
    text: 'Una lista de acciones, cada una con su nombre y para qué sirve. El modelo no las ejecuta: escribe cuál quiere y con qué datos, y el arnés la hace. En la grabación tenía estas:',
    example: () => element('div', 'tool-list', ...[['Read', 'abre un documento'], ['Write', 'escribe un documento'], ['Glob', 'busca archivos por su nombre'], ['Grep', 'busca un texto dentro de los documentos'], ['Bash', 'usa el ordenador: ejecuta programas, por ejemplo para sumar']].map(([name, what]) => element('div', 'tool-row', raw('code', '', name), element('span', '', what)))) },
  { key: 'loop', name: 'El bucle', short: 'pedir, hacer, mirar, repetir',
    text: ['El arnés le pregunta al modelo qué hacer, hace lo que pide, le enseña el resultado y vuelve a preguntar. Repite hasta que el modelo contesta sin pedir nada más. En la sección 02 fueron ', strong(say(`${rounds} vueltas`, `${rounds} rounds`)), '.'],
    example: () => flow(['El modelo pide una herramienta', 'El arnés la ejecuta', 'El arnés le enseña el resultado', '↺ Otra vez, hasta que termina']) },
  { key: 'permissions', name: 'Los permisos', short: 'qué hace sin preguntarte',
    text: 'El arnés decide qué deja hacer al modelo sin pedirte permiso. En la sección 02 lo viste: no dejó pasar una orden que no podía comprobar, y el modelo tuvo que buscar otra forma. Es también la defensa del capítulo 12, cuando un texto de fuera intenta colar una orden. Un ejemplo de reglas:',
    example: () => element('div', 'tool-list', ...[['Leer archivos', 'sin preguntar'], ['Escribir archivos', 'te pregunta'], ['Ejecutar programas', 'te pregunta'], ['Borrar archivos', 'no lo permite']].map(([what, rule]) => element('div', 'tool-row', element('strong', '', what), element('span', '', rule)))) },
  { key: 'memory', name: 'La conversación', short: 'lo que recuerda',
    text: 'El modelo no recuerda nada de una petición a otra. El arnés le vuelve a mandar toda la conversación cada vez: tu encargo, lo que ha leído y lo que ha hecho. Si se hace demasiado larga, la resume. Por eso la caché del capítulo 13 importa tanto.',
    example: () => flow(['Tu encargo', '+ lo que ha leído', '+ lo que ha hecho', '= lo que lee en la siguiente vuelta']) },
];
let part = PARTS[0].key;
function renderParts() {
  $('harness-parts').replaceChildren(...PARTS.map(p => {
    const button = element('button', 'harness-part', element('strong', '', p.name), element('small', '', p.short));
    button.type = 'button'; button.setAttribute('aria-pressed', String(p.key === part));
    button.addEventListener('click', () => { part = p.key; renderParts(); });
    return button;
  }));
  const p = PARTS.find(x => x.key === part);
  $('part-detail').replaceChildren(element('h3', '', p.name), element('p', '', ...[].concat(p.text)), p.example());
}

// ---------- 04 · Build your assistant ----------
const LEVELS = [
  { key: 'chat', button: 'Solo el modelo', title: 'Solo el modelo, como en un chat', verdict: 'Te dice qué necesita: que le des acceso a la carpeta o que le pegues los 40 tickets. El trabajo lo haces tú.' },
  { key: 'tools', button: '+ Leer y escribir archivos', title: 'Con herramientas para leer y escribir archivos', verdict: 'Abre los 40 tickets uno a uno, los clasifica y escribe la tabla. Suma de cabeza, y acierta.' },
  { key: 'agent', button: '+ Usar el ordenador', title: 'Con todo eso y el ordenador, como Claude Code', verdict: 'Hace lo mismo y, además, puede usar el ordenador: esta vez repasó las sumas con un pequeño programa antes de escribir la tabla.' },
];
let level = 'chat';
function renderBuild() {
  const index = LEVELS.findIndex(x => x.key === level);
  $('build-levels').replaceChildren(...LEVELS.map((l, i) => {
    const button = element('button', 'chip', l.button); button.type = 'button';
    button.setAttribute('aria-pressed', String(i <= index));
    button.addEventListener('click', () => { level = l.key; renderBuild(); });
    return button;
  }));
  const l = LEVELS[index], data = levels[level], c = data.check;
  $('build-level-title').textContent = l.title;
  const list = items(data).slice(0, -1);
  $('build-timeline').replaceChildren(...(list.length ? list.map(timelineItem) : [element('p', 'fine', 'No hace nada: no tiene con qué. Solo contesta.')]));
  $('build-final').replaceChildren(element('p', 'fine', 'Su respuesta:'), markdown('', prose(data.final)), ...(data.summary.length ? [raw('div', 'table-scroll', table(data.summary))] : []));
  const kinds = data.steps.flatMap(s => s.actions.map(a => a.kind));
  const check = (ok, text) => element('div', 'build-check ' + (ok ? 'yes' : 'no'), element('span', 'build-mark', ok ? '✓' : '✗'), element('span', '', text));
  $('build-checks').replaceChildren(
    check(c.listed > 0, 'Ha visto los tickets'),
    check(c.table, 'Ha escrito la tabla'),
    check(c.listed === c.receipts && !c.duplicates, say(`Están los ${c.receipts}, una vez cada uno`, `All ${c.receipts} are there, once each`)),
    check(c.grandOk && c.totalsOk === c.usedCategories, 'Las cuentas son exactas'),
    check(kinds.includes('compute'), 'Ha repasado las sumas con un programa'));
  $('build-verdict').textContent = l.verdict;
}

// ---------- 05 · 23 tries ----------
function renderRepeat() {
  const rows = [
    ['Solo el modelo, como en un chat', experiment.chat, null],
    ['Con herramientas para leer y escribir archivos', experiment.withoutComputer, null],
    ['Con todo eso y el ordenador', experiment.withComputer, say(`${experiment.withComputer.computed} de ${experiment.withComputer.runs} repasaron las sumas con un programa`, `${experiment.withComputer.computed} of ${experiment.withComputer.runs} checked the sums with a program`)],
  ];
  $('repeat-rows').replaceChildren(...rows.map(([label, v, note]) => element('div', 'repeat-row',
    element('div', 'repeat-label', element('strong', '', label), element('small', '', say(`${v.done} de ${v.runs} bien`, `${v.done} of ${v.runs} right`)), ...(note ? [element('small', '', note)] : [])),
    element('div', 'score-row', ...Array.from({ length: v.runs }, (_, i) => element('span', 'score-cell ' + (i < v.done ? 'good' : 'bad'), i < v.done ? '✓' : '✗'))))));
}

// ---------- 07 · For the curious ----------
// The harness written for this chapter (harness.mjs), shortened and with its comments in Spanish.
const CODE = `const client = new Anthropic();

async function runAgent({ tools, prompt, run, maxTurns = 25 }) {
  const messages = [{ role: 'user', content: prompt }];
  for (let turn = 1; turn <= maxTurns; turn++) {
    // 1. Prepara la petición: instrucciones, herramientas y toda la conversación.
    const response = await client.messages.create({
      model: 'claude-sonnet-5-5', max_tokens: 16000,
      system: SYSTEM, tools: tools.map(tool => tool.definition), messages,
    });
    // 2. El modelo solo escribe: texto o una petición de herramienta.
    messages.push({ role: 'assistant', content: response.content });
    // 3. Si no pide ninguna herramienta, ha terminado.
    if (response.stop_reason !== 'tool_use') return messages;
    // 4. El arnés hace lo que pide y le pega los resultados como texto.
    const results = [];
    for (const call of response.content.filter(block => block.type === 'tool_use'))
      results.push(await run(call));
    messages.push({ role: 'user', content: results });
  }
  // 5. El arnés, no el modelo, decide cuándo parar.
  return messages;
}`.split('\n');
// Lines of each step, from its comment to the next one.
const PHASES = [[5, 9], [10, 11], [12, 13], [14, 18], [20, 21]];
function codeView(from, to) {
  return element('pre', 'code-view', ...CODE.map((line, i) => {
    const comment = line.trim().startsWith('//');
    const text = comment ? line.replace(/\/\/ (.*)/, (_, c) => '// ' + translateText(c)) : line;
    return element('span', 'code-line' + (i >= from && i <= to ? ' lit' : '') + (comment ? ' comment' : ''), text + '\n');
  }));
}
function loopSteps() {
  const steps = [
    ['Preparar la petición', 'Cada vez se manda todo: las instrucciones, la lista de herramientas y la conversación entera. El modelo no recuerda nada por su cuenta.'],
    ['Preguntar al modelo', 'La respuesta es texto, y a veces una o varias peticiones de herramienta. El arnés la guarda en la conversación.'],
    ['¿Ha terminado?', 'Si el modelo no ha pedido ninguna herramienta, ha acabado. Lo decide el modelo; el arnés solo lo mira.'],
    ['Hacer lo que pide', 'Aquí está el trabajo de verdad: abrir, escribir, ejecutar. El resultado vuelve como texto y el bucle empieza otra vez.'],
    ['Saber parar', 'Un modelo puede dar vueltas sin acabar. Cuántas vueltas como mucho lo decide el arnés.'],
  ];
  return PHASES.map(([from, to], i) => ({ stage: i + 1, title: steps[i][0], caption: steps[i][1], render: () => codeView(from, to) }));
}
new Stepper($('loop-explainer'), loopSteps);

function renderAll() { renderTwo(); renderParts(); renderBuild(); renderRepeat(); }
document.addEventListener('languagechange', renderAll);
renderAll();
