import { $, element, Stepper } from '../../tokens/src/ui.js';
import { getLanguage, getLocale, translateText } from '../../i18n/i18n.js';

// Every example on this page is an illustration: invented receipts, hand-written answers and hypothetical figures.
const say = (es, en) => getLanguage() === 'en' ? en : es;
// Always group thousands (Spanish leaves «1000» ungrouped by default).
const fmt = (value, digits = 0) => value.toLocaleString(getLocale(), { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: 'always' });
const euros = value => say(`${fmt(value, 2)} €`, `€${fmt(value, 2)}`);
// Receipts, file names and code stay as written; the translator leaves them alone.
const raw = (tag, className, ...children) => { const node = element(tag, className, ...children); node.dataset.i18nIgnore = ''; return node; };
const flow = items => element('div', 'block-flow', ...items.map(text => element('span', 'block-step', text)));
const bubble = (who, text, className = '') => element('div', 'chat-line ' + who + (className ? ' ' + className : ''), element('span', 'chat-who', who === 'you' ? 'Tú' : 'Asistente'), element('p', '', text));
const desk = (label, ...children) => element('div', 'mini-desk', element('span', 'eyebrow', label), ...children);

// ---------- The example: an invented trip, an invented folder of receipts ----------
const request = () => say('En la carpeta recibos están los tickets del viaje del equipo a la feria de Colonia. Clasifícalos en comida, transporte, alojamiento y ocio, y hazme una tabla con cada ticket, su categoría y su importe, y al final lo que gastamos en cada cosa y el total. Guárdala en gastos.md.',
  'The receipts from the team trip to the Cologne trade fair are in the recibos folder. Sort them into food, transport, accommodation and leisure, and make me a table with each receipt, its category and its amount, and at the end what we spent on each thing and the total. Save it in gastos.md.');
// One of the 40 receipts, in German as it came. It is an image of a paper receipt: it stays as written.
const SAMPLE = `Taxi Bonn
Recibo nº 1407
23.08.2026

Fahrpreis                              42,60
Trinkgeld                              4,40

SUMME EUR 47,00
  davon MwSt 19%   7,50
  Netto            39,50
Vielen Dank für Ihren Einkauf!`;
const TOTALS = [['Comida', 18, 745.70], ['Transporte', 13, 1156.98], ['Alojamiento', 1, 1243.20], ['Ocio', 8, 470.48]];
const TOTAL = TOTALS.reduce((sum, [, , value]) => sum + value, 0);
const RECEIPTS = TOTALS.reduce((sum, [, count]) => sum + count, 0);
const summary = () => element('div', 'table-scroll', element('table', 'agent-table',
  element('tr', '', element('th', '', 'Categoría'), element('th', '', 'Tickets'), element('th', '', 'Total')),
  ...TOTALS.map(([name, count, value]) => element('tr', '', element('td', '', name), raw('td', '', String(count)), raw('td', '', euros(value)))),
  element('tr', '', element('th', '', 'Total'), raw('th', '', String(RECEIPTS)), raw('th', '', euros(TOTAL)))));

// What a chat can answer: it cannot see the folder.
const chatAnswer = () => say('No puedo abrir tu carpeta: solo veo lo que me escribes aquí. Si me pegas el texto de los 40 tickets, te preparo la tabla para que la guardes tú.',
  'I cannot open your folder: I only see what you write here. If you paste the text of the 40 receipts, I will prepare the table for you to save.');
// What an agent does, one round of the loop at a time.
const AGENT = () => [
  { icon: '📁', what: 'Mira qué hay en la carpeta', result: say(`${RECEIPTS} tickets, de recibo-01.txt a recibo-40.txt`, `${RECEIPTS} receipts, from recibo-01.txt to recibo-40.txt`) },
  { icon: '📄', what: say(`Abre los ${RECEIPTS} tickets, uno a uno`, `Opens the ${RECEIPTS} receipts, one by one`), result: 'Restaurantes, taxis, el hotel, un museo… y los clasifica.' },
  { icon: '🧮', what: 'Suma cada categoría con un pequeño programa', result: TOTALS.map(([name, , value]) => `${translateText(name)} ${euros(value)}`).join(' · '), state: 'good' },
  { icon: '✋', what: say('Pide permiso para escribir gastos.md', 'Asks permission to write gastos.md'), result: 'El arnés te pregunta antes de crear el archivo. Dices que sí.' },
  { icon: '✏️', what: say('Escribe el archivo gastos.md', 'Writes the file gastos.md') },
];
const agentFinal = () => say(`He clasificado los ${RECEIPTS} tickets y he guardado la tabla en gastos.md. El total es ${euros(TOTAL)}. Dos tickets eran dudosos, la gasolinera donde también se compró un bocadillo y el minibar del hotel; lo he anotado al final del archivo.`,
  `I sorted the ${RECEIPTS} receipts and saved the table in gastos.md. The total is ${euros(TOTAL)}. Two receipts were doubtful, the petrol station where a sandwich was also bought and the hotel minibar; I noted it at the end of the file.`);
function timelineItem(item) {
  return element('div', 'timeline-item' + (item.state ? ' ' + item.state : ''), element('span', 'timeline-icon', item.icon),
    element('div', 'timeline-body', element('div', 'timeline-what', item.what), ...(item.result ? [element('div', 'timeline-result', item.result)] : [])));
}

// ---------- 01 · Only text ----------
function textSteps() {
  return [
    { stage: 1, title: 'Escribe la continuación', caption: 'Le das un texto y escribe lo que viene después, palabra a palabra. Si el texto es una pregunta, lo que viene después suele ser una respuesta. Es todo lo que hace.', render: () => flow(['Texto que entra', 'El modelo', 'Texto que sale']) },
    { stage: 2, title: 'No puede hacer nada más', caption: 'Si le pides «clasifica los tickets de esta carpeta», no puede abrirla. No sabe ni qué tickets hay. Solo puede escribir algo que suene a respuesta o decirte que no los ve.', render: () => element('div', 'can-list', element('span', 'cannot', '✗ Abrir una carpeta'), element('span', 'cannot', '✗ Escribir un documento'), element('span', 'can', '✓ Escribir texto')) },
    { stage: 3, title: 'Pero puede pedirlo', caption: 'Si le cuentas qué herramientas existen, el modelo puede escribir una petición como esta y pararse. Pide que alguien mire la carpeta. Pero sigue siendo solo texto.',
      render: () => raw('pre', 'code-view void-call', say('Voy a ver qué hay en la carpeta recibos.\n\n<herramienta nombre="listar_archivos">\n  <carpeta>recibos</carpeta>\n</herramienta>', 'Let me see what is in the receipts folder.\n\n<tool name="list_files">\n  <folder>recibos</folder>\n</tool>')) },
    { stage: 4, title: 'Alguien tiene que hacerlo', caption: 'Hace falta un programa que lea esa petición, abra la carpeta de verdad, le pegue al modelo lo que hay y le deje seguir. Ese programa es el arnés.', render: () => flow(['Modelo: «quiero ver la carpeta recibos»', 'Arnés: abre la carpeta', 'Arnés: le pega lo que hay dentro', 'Modelo: sigue escribiendo']) },
  ];
}
const textStepper = new Stepper($('text-explainer'), textSteps);

// ---------- 02 · Two programs ----------
function twoSteps() {
  const you = () => bubble('you', 'Clasifica los tickets de la carpeta recibos y hazme la tabla de gastos.');
  const chat = stage => desk('COMO UN CHAT', you(), ...(stage >= 2 ? [bubble('ai', chatAnswer())] : []),
    ...(stage >= 3 && stage < 6 ? [element('p', 'fine', '⏳ Espera a que le pegues los tickets.')] : []),
    ...(stage === 6 ? [bubble('ai', 'Sin tabla. Abrir, copiar y pegar los 40 tickets te toca a ti.', 'wrong')] : []));
  const shown = [0, 0, 1, 2, 3, 5, 5];
  const agent = stage => desk('COMO CLAUDE CODE', you(), element('div', 'timeline', ...AGENT().slice(0, shown[stage]).map(timelineItem)),
    ...(stage === 6 ? [bubble('ai', agentFinal(), 'right'), summary()] : []));
  const step = (stage, title, caption) => ({ stage, title, caption, render: () => element('div', 'two-cases', chat(stage), agent(stage)) });
  return [
    step(1, 'El mismo encargo, a los dos', 'Los dos reciben el mismo texto y usan el mismo modelo. Lo único distinto es el programa que lo rodea.'),
    step(2, 'Mirar la carpeta', 'El chat no tiene forma de ver tus archivos, así que te lo dice. El agente pide la herramienta de listar archivos: el arnés mira la carpeta y le pega la lista.'),
    step(3, 'Leer los tickets', 'El chat sigue esperando. El agente pide abrir cada ticket y el arnés se los va pegando. Ahora sí sabe qué hay: comercios, fechas e importes, en tres idiomas.'),
    step(4, 'Sumar', 'Con los tickets clasificados, el agente no suma de cabeza: pide ejecutar un pequeño programa que hace las cuentas. El resultado vuelve como texto.'),
    step(5, 'Guardar, con permiso', 'Escribir un archivo cambia tu ordenador, así que el arnés te pregunta antes. Dices que sí, y el agente escribe gastos.md.'),
    step(6, 'Responder', 'El agente ya no pide más herramientas, así que el bucle termina y te cuenta qué ha hecho. El chat te ha dado un buen consejo; el agente, el trabajo hecho.'),
  ];
}
const twoStepper = new Stepper($('two-explainer'), twoSteps);
function renderRequest() {
  $('request-text').replaceChildren(raw('span', '', '«' + request() + '»'));
  $('receipt-sample').replaceChildren(raw('span', '', SAMPLE));
}

// ---------- 03 · Inside the harness ----------
const PARTS = [
  { key: 'instructions', name: 'Las instrucciones', short: 'lo que lee antes que tu mensaje',
    text: 'Antes de tu encargo, el arnés pone un texto que el modelo lee cada vez: quién es, cómo trabajar, qué no tocar. Claude Code trae las suyas, y les suma las tuyas, por ejemplo las de un archivo CLAUDE.md. Unas instrucciones podrían ser estas:',
    example: () => raw('blockquote', 'part-quote', say('Trabajas con los archivos de la carpeta actual. Cuando termines, explica en dos o tres frases qué has hecho.', 'You work with the files in the current folder. When you finish, explain in two or three sentences what you did.')) },
  { key: 'tools', name: 'Las herramientas', short: 'los botones que puede pedir',
    text: 'Una lista de acciones, cada una con su nombre y para qué sirve. El modelo no las ejecuta: escribe cuál quiere y con qué datos, y el arnés la hace. Claude Code trae herramientas como estas:',
    example: () => element('div', 'tool-list', ...[['Read', 'abre un documento'], ['Write', 'escribe un documento'], ['Glob', 'busca archivos por su nombre'], ['Grep', 'busca un texto dentro de los documentos'], ['Bash', 'usa el ordenador: ejecuta programas, por ejemplo para sumar']].map(([name, what]) => element('div', 'tool-row', raw('code', '', name), element('span', '', what)))) },
  { key: 'loop', name: 'El bucle', short: 'pedir, hacer, mirar, repetir',
    text: 'El arnés le pregunta al modelo qué hacer, hace lo que pide, le enseña el resultado y vuelve a preguntar. Repite hasta que el modelo contesta sin pedir nada más. En la sección 02, el agente dio una vuelta para mirar la carpeta, otra para leer, otra para sumar, otra para guardar y una última para responder.',
    example: () => flow(['El modelo pide una herramienta', 'El arnés la ejecuta', 'El arnés le enseña el resultado', '↺ Otra vez, hasta que termina']) },
  { key: 'permissions', name: 'Los permisos', short: 'qué hace sin preguntarte',
    text: 'El arnés decide qué deja hacer al modelo sin pedirte permiso. En la sección 02 lo viste: antes de escribir gastos.md, te preguntó. Es también la defensa del capítulo 12, cuando un texto de fuera intenta colar una orden. Un ejemplo de reglas:',
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
  $('part-detail').replaceChildren(element('h3', '', p.name), element('p', '', p.text), p.example());
}

// ---------- 04 · Build your assistant ----------
const LEVELS = [
  { key: 'chat', button: 'Solo el modelo', title: 'Solo el modelo, como en un chat', steps: () => [], final: chatAnswer, table: false,
    checks: [false, false, false, false], verdict: 'Te dice qué necesita: que le des acceso a la carpeta o que le pegues los 40 tickets. El trabajo lo haces tú.' },
  { key: 'tools', button: '+ Leer y escribir archivos', title: 'Con herramientas para leer y escribir archivos', table: true,
    steps: () => [AGENT()[0], AGENT()[1], AGENT()[3], AGENT()[4]],
    final: () => say(`He clasificado los ${RECEIPTS} tickets y he guardado la tabla en gastos.md. He sumado de cabeza: el total es ${euros(TOTAL)}.`, `I sorted the ${RECEIPTS} receipts and saved the table in gastos.md. I added up in my head: the total is ${euros(TOTAL)}.`),
    checks: [true, true, true, false], verdict: 'Abre los 40 tickets, los clasifica y escribe la tabla. Las sumas las hace de cabeza: suele acertar, pero nadie las ha comprobado.' },
  { key: 'agent', button: '+ Usar el ordenador', title: 'Con todo eso y el ordenador, como Claude Code', table: true, steps: AGENT, final: agentFinal,
    checks: [true, true, true, true], verdict: 'Hace lo mismo y, además, usa el ordenador para repasar las sumas con un pequeño programa antes de escribir la tabla.' },
];
const CHECKS = ['Ve los tickets', 'Escribe la tabla en gastos.md', 'Están los 40, una vez cada uno', 'Repasa las sumas con un programa'];
let level = 'chat';
function renderBuild() {
  const index = LEVELS.findIndex(x => x.key === level);
  $('build-levels').replaceChildren(...LEVELS.map((l, i) => {
    const button = element('button', 'chip', l.button); button.type = 'button';
    button.setAttribute('aria-pressed', String(i <= index));
    button.addEventListener('click', () => { level = l.key; renderBuild(); });
    return button;
  }));
  const l = LEVELS[index], steps = l.steps();
  $('build-level-title').textContent = l.title;
  $('build-timeline').replaceChildren(...(steps.length ? steps.map(timelineItem) : [element('p', 'fine', 'No hace nada: no tiene con qué. Solo contesta.')]));
  $('build-final').replaceChildren(element('p', 'fine', 'Su respuesta:'), bubble('ai', l.final(), l.table ? 'right' : ''), ...(l.table ? [summary()] : []));
  const check = (ok, text) => element('div', 'build-check ' + (ok ? 'yes' : 'no'), element('span', 'build-mark', ok ? '✓' : '✗'), element('span', '', text));
  $('build-checks').replaceChildren(...CHECKS.map((text, i) => check(l.checks[i], text)));
  $('build-verdict').textContent = l.verdict;
}

// ---------- 06 · For the curious ----------
// A minimal harness written for this chapter, with its comments in Spanish.
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
const loopStepper = new Stepper($('loop-explainer'), loopSteps);

function renderAll() { renderRequest(); renderParts(); renderBuild(); }
// Steppers built from say() redraw in the new language; their plain Spanish texts are translated by the page.
document.addEventListener('languagechange', () => { renderAll(); textStepper.refresh(); twoStepper.refresh(); loopStepper.refresh(); });
renderAll();
