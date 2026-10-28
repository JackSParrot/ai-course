import { $, element, reducedMotion, Stepper } from '../../tokens/src/ui.js';
import { getLanguage, translateText } from '../../i18n/i18n.js';
import { SESSION } from './session.js';

const { runs, experiment, studio, entries } = SESSION;
const strong = value => element('strong', '', String(value));
const flow = items => element('div', 'block-flow', ...items.map(text => element('span', 'block-step', text)));
// Phrases built around numbers or names, in the language of the page.
const say = (es, en) => getLanguage() === 'en' ? en : es;
// Recorded text, file names and code stay as they were written; the translator leaves them alone.
const raw = (tag, className, ...children) => { const node = element(tag, className, ...children); node.dataset.i18nIgnore = ''; return node; };
// The model writes Markdown: show its **bold** and `code` as plain elements.
const inline = text => text.split(/(\*\*[^*]+\*\*|`[^`]+`)/).filter(Boolean)
  .map(part => part.startsWith('**') ? element('strong', '', part.slice(2, -2)) : part.startsWith('`') ? element('code', '', part.slice(1, -1)) : part);
const markdown = (className, text) => raw('div', className, ...text.split('\n').filter(line => line.trim()).map(line => element('p', '', ...inline(line.replace(/^\s*[-*] /, '• ')))));
const menuEntry = ({ name, description }, className = '') => raw('div', 'menu-item ' + className, element('code', '', name), element('span', '', description));

// ---------- 01 · The desk and the filing cabinet ----------
const policy = { ...studio[0], body: SESSION.policy };
// The label of a skill, as it starts its SKILL.md file.
const label = skill => ['---', `name: ${skill.name}`, `description: ${skill.description}`, '---'].join('\n');
function inventorySteps() {
  const desk = (filled, name) => element('div', 'inventory', ...Array.from({ length: 12 }, (_, i) => element('span', 'slot' + (i < filled ? ' full' : ''), i < filled ? name(i) : '')));
  const manuals = ['Gastos', 'Clientes', 'Vacaciones', 'Actas', 'Redes', 'Traducción', 'Contratos', 'Facturas', 'Proyectos', 'Viajes', 'Nóminas', 'Marca'];
  return [
    { stage: 1, title: 'Lo que tiene delante en cada vuelta', caption: 'Las instrucciones del arnés, la lista de herramientas y toda la conversación. Es su mesa de trabajo: lo único que tiene delante. Lo que no esté en la mesa, para el modelo no existe.', render: () => flow(['Instrucciones', '+ herramientas', '+ la conversación', '= lo que lee el modelo']) },
    { stage: 2, title: 'Una empresa tiene muchos manuales', caption: 'Cómo se reembolsan los gastos, cómo se contesta a un cliente, cómo se piden las vacaciones… Si se los pones todos en la mesa, se llena antes de empezar, y los pagas en cada vuelta aunque la tarea solo necesite uno. Ilustración: la empresa y sus manuales son inventados.', render: () => desk(12, i => manuals[i]) },
    { stage: 3, title: 'Mejor un archivador con etiquetas', caption: 'El arnés guarda los manuales en un archivador y solo pone en la mesa la etiqueta de cada cajón: su nombre y una línea que dice para qué sirve. Estas son las etiquetas reales de nuestras grabaciones, las 6 skills de la agencia.', render: () => element('div', 'menu-list', ...studio.map(skill => menuEntry(skill, skill.name === policy.name ? 'picked' : ''))) },
    { stage: 4, title: 'Abre solo el cajón que necesita', caption: 'Al leer «prepara la nota de gastos», el modelo pide la política. El arnés le pone el manual entero en la mesa y el modelo sigue trabajando con él. Los otros cinco se quedan en el archivador.', render: () => element('div', 'open-skill', menuEntry(policy, 'picked'), element('span', 'open-arrow', '↓ el arnés le pone el manual en la mesa'), raw('pre', 'code-view skill-body', policy.body.split('\n').slice(0, 9).join('\n') + '\n…')) },
  ];
}
new Stepper($('inventory-explainer'), inventorySteps);

// ---------- A recorded session, as things a person would see ----------
function describe(step) {
  switch (step.kind) {
    case 'skill': return { icon: '📘', what: ['Abre la skill ', raw('code', '', step.name)], result: 'El arnés le pone el manual entero en la mesa.', state: 'good' };
    case 'list': return { icon: '📁', what: 'Mira qué hay en la carpeta' };
    case 'readAll': return { icon: '📄', what: 'Lee todos los tickets de una vez' };
    case 'search': return { icon: '🔎', what: 'Repasa los tickets buscando datos' };
    case 'compute': return { icon: '🧮', what: 'Hace las cuentas con un pequeño programa' };
    case 'fix': return { icon: '✏️', what: 'Corrige un detalle de la nota' };
    case 'reread': return { icon: '👀', what: 'Relee la nota antes de enviarla' };
    case 'write': return { icon: '✏️', what: ['Escribe el archivo ', raw('code', '', step.file)] };
    case 'toolsearch': return { icon: '🧰', what: 'Pide las instrucciones de uso de las herramientas', result: raw('span', '', step.names.join(' · ')), state: 'good' };
    case 'mcp': return { icon: '🔌', what: ['Usa ', raw('code', '', step.tool), ...(step.tool === 'enviar_nota' ? [' con un total de ', raw('strong', '', step.input.total.toLocaleString('es-ES', { minimumFractionDigits: 2, useGrouping: 'always' }) + ' €')] : [])], result: raw('q', '', step.result), state: 'good' };
    case 'say': return { icon: '💬', what: raw('q', '', ...inline(step.text)) };
    default: return { icon: '▶', what: 'Usa el ordenador' };
  }
}
const items = run => [...run.steps.map(describe), { icon: '💬', what: 'Te responde', final: run.final }];
function timelineItem(item) {
  return element('div', 'timeline-item' + (item.state ? ' ' + item.state : ''), element('span', 'timeline-icon', item.icon),
    element('div', 'timeline-body', element('div', 'timeline-what', ...[].concat(item.what)), ...(item.result ? [element('div', 'timeline-result', item.result)] : []), ...(item.final ? [markdown('chat-answer small', item.final)] : [])));
}

// ---------- 02 · The house rules ----------
const RULES = [
  { key: 'propinas', name: 'Las propinas no se reembolsan', detail: 'Taxi Köln: 35,00 € con 3,20 € de propina' },
  { key: 'tasas', name: 'La tasa turística, en su propia fila', detail: 'Hotel: 1.184,00 € de habitaciones y 59,20 € de tasa' },
  { key: 'coche', name: 'Gasolina, alquiler y parking van en «coche»', detail: 'Sixt, la gasolinera y el parking' },
  { key: 'topeOcio', name: 'Ocio: como mucho 100 € por ticket', detail: 'Karting: 104,00 € para 4 personas' },
  { key: 'total', name: 'Total a reembolsar: 3.603,26 €', detail: 'los 3.616,36 € de los tickets, menos 9,10 € de propinas y 4 € de exceso' },
];
// The rows as the agent wrote them, without the date or the receipt number; the total line without its Markdown.
const plain = cell => cell.replace(/\*\*/g, '').trim();
const rowFor = (run, key) => key === 'total' ? (run.total ? run.total.split('|').map(plain).filter(Boolean).join(' · ') : '—')
  : run.rows.filter(r => r.rule === key).map(r => r.cells.map(plain).filter(c => c && !/^\d{2}\/\d{2}$|^\d{4}$|^recibo-\d{2}$/.test(c)).join(' · ')).join('\n') || '—';
function renderRules() {
  $('request-text').replaceChildren(raw('span', '', '«' + SESSION.prompt + '»'));
  $('policy-head').replaceChildren(raw('span', '', label(policy)));
  $('policy-text').replaceChildren(raw('span', '', SESSION.policy));
  for (const [key, id] of [['without', 'without'], ['skill', 'skill']]) {
    const run = runs[key];
    $(id + '-timeline').replaceChildren(...items(run).slice(0, -1).map(timelineItem));
    $(id + '-final').replaceChildren(element('p', 'fine', 'Su respuesta:'), markdown('', run.final));
  }
  const mark = ok => element('span', 'build-mark ' + (ok ? 'yes' : 'no'), ok ? '✓' : '✗');
  $('rule-table').replaceChildren(
    element('div', 'rule-row rule-head', element('span', '', 'Regla de la política'), element('span', '', 'Sin la skill'), element('span', '', 'Con la skill')),
    ...RULES.map(rule => element('div', 'rule-row',
      element('div', 'rule-name', element('strong', '', rule.name), element('small', '', rule.detail)),
      ...['without', 'skill'].map(key => element('div', 'rule-cell ' + (runs[key].rules[rule.key] ? 'yes' : 'no'), mark(runs[key].rules[rule.key]), raw('code', '', rowFor(runs[key], rule.key)))))));
}

// ---------- 03 · The menu decides ----------
const ENTRIES = [
  { key: 'C', button: 'Nombre y descripción claros', verdict: 'Siempre la abre, y siempre lo primero: antes incluso de mirar los tickets.' },
  { key: 'D', button: 'Descripción vaga', verdict: 'La descripción no dice nada, pero el nombre sí. La abre siempre, aunque nunca lo primero: antes mira los tickets.' },
  { key: 'E', button: 'Nombre y descripción vagos', verdict: 'Ya no hay nada claro. La mitad de las veces, después de mirar los tickets, prueba a abrirla por si acaso. La otra mitad, ni la mira.' },
  { key: 'F', button: 'Sin ninguna pista', verdict: 'Nada en el menú la relaciona con la tarea. Aun así, la mitad de las veces la abrió para ver qué había dentro. Es lanzar una moneda.' },
];
let entry = 'C';
const cell = (good, mark) => element('span', 'score-cell ' + (good ? 'good' : 'bad'), mark);
function renderMenu() {
  $('entry-picker').replaceChildren(...ENTRIES.map(e => {
    const button = element('button', 'chip', e.button); button.type = 'button';
    button.setAttribute('aria-pressed', String(e.key === entry));
    button.addEventListener('click', () => { entry = e.key; renderMenu(); });
    return button;
  }));
  const e = ENTRIES.find(x => x.key === entry), runsOf = experiment[entry];
  $('entry-card').replaceChildren(menuEntry(entries[entry], 'picked'), element('small', 'fine', say('… y las otras 5 skills de la agencia y las 22 de Claude Code.', '… and the other 5 agency skills and the 22 that come with Claude Code.')));
  $('entry-verdict').textContent = e.verdict;
  $('entry-cells').replaceChildren(element('div', 'score-row', ...runsOf.map(r => cell(r.opened, r.opened ? '📘' : '·'))));
  const opened = runsOf.filter(r => r.opened).length, first = runsOf.filter(r => r.first).length, rules = runsOf.filter(r => r.passed === 5).length;
  const stat = (ok, text) => element('div', 'build-check ' + (ok ? 'yes' : 'no'), element('span', 'build-mark', ok ? '✓' : '✗'), element('span', '', text));
  $('entry-stats').replaceChildren(
    stat(opened > 0, say(`La abrió en ${opened} de 10`, `Opened it in ${opened} of 10`)),
    stat(first > 0, say(`Como primera acción, en ${first} de 10`, `As its first action, in ${first} of 10`)),
    stat(rules > 0, say(`Cumplió las cinco reglas en ${rules} de 10`, `Followed all five rules in ${rules} of 10`)),
    ...(opened > rules ? [element('p', 'fine', 'Uno de los intentos que la abrieron aplicó las reglas pero se equivocó al sumar el total.')] : []));
  const reference = [
    ['Sin las skills de la agencia', experiment.A],
    ['Con la política pegada siempre en las instrucciones', experiment.B],
  ];
  $('reference-rows').replaceChildren(element('span', 'eyebrow', 'PARA COMPARAR: CUMPLE LAS CINCO REGLAS'), ...reference.map(([label, v]) => element('div', 'repeat-row',
    element('div', 'repeat-label', element('strong', '', label), element('small', '', say(`${v.filter(r => r.passed === 5).length} de 10`, `${v.filter(r => r.passed === 5).length} of 10`))),
    element('div', 'score-row', ...v.map(r => cell(r.passed === 5, r.passed === 5 ? '✓' : '✗'))))));
}

// ---------- 04 · Knowing and doing: MCP ----------
const mcpItems = () => items(runs.mcp);
let shown = 1, timer = 0;
function renderMcp() {
  $('mcp-request').replaceChildren(raw('span', '', '«' + SESSION.prompt + ' ' + SESSION.send + '»'));
  const list = mcpItems();
  $('mcp-timeline').replaceChildren(...list.slice(0, shown).map(timelineItem));
  $('mcp-next').disabled = shown >= list.length;
  const rows = [
    ['Con las skills y el servidor', experiment.G],
    ['Solo con el servidor', experiment.H],
  ];
  const line = (label, v, test, mark) => element('div', 'mcp-line', element('small', '', label), element('div', 'score-row', ...v.map(r => cell(test(r), test(r) ? mark : '·'))));
  $('mcp-rows').replaceChildren(...rows.map(([label, v]) => element('div', 'repeat-row',
    element('div', 'repeat-label', element('strong', '', label)),
    element('div', 'mcp-lines',
      line(say(`Cumple la política: ${v.filter(r => r.passed === 5).length} de 10`, `Follows the policy: ${v.filter(r => r.passed === 5).length} of 10`), v, r => r.passed === 5, '✓'),
      line(say(`Consulta el presupuesto: ${v.filter(r => r.budget).length} de 10`, `Checks the budget: ${v.filter(r => r.budget).length} of 10`), v, r => r.budget, '🔌'),
      line(say(`Envía la nota: ${v.filter(r => r.sent).length} de 10`, `Sends the note: ${v.filter(r => r.sent).length} of 10`), v, r => r.sent, '📨')))));
}
function stopPlay() { clearInterval(timer); timer = 0; $('mcp-play').textContent = translateText('▶ Reproducir'); }
$('mcp-next').addEventListener('click', () => { stopPlay(); shown = Math.min(mcpItems().length, shown + 1); renderMcp(); });
$('mcp-reset').addEventListener('click', () => { stopPlay(); shown = 1; renderMcp(); });
$('mcp-play').addEventListener('click', () => {
  if (timer) return stopPlay();
  if (shown >= mcpItems().length) shown = 0;
  if (reducedMotion) { shown = mcpItems().length; renderMcp(); return; }
  $('mcp-play').textContent = translateText('❚❚ Pausa');
  const tick = () => { shown++; renderMcp(); if (shown >= mcpItems().length) stopPlay(); };
  tick(); timer = setInterval(tick, 1100);
});

// ---------- 05 · In real life ----------
function renderReal() {
  $('skill-header').replaceChildren(raw('span', '', [label(policy), policy.body.split('\n')[0], '…'].join('\n')));
  // An illustration: our policy only had its SKILL.md.
  $('skill-tree').replaceChildren(element('span', '', ...[
    ['politica-de-gastos/', ''], ['├─ SKILL.md', 'la etiqueta y las instrucciones'], ['├─ consulta/', ''], ['│  └─ dietas-por-pais.md', 'solo si el viaje es a otro país'],
    ['├─ plantillas/', ''], ['│  └─ nota-de-gastos.md', 'el formato que pide contabilidad'], ['└─ programas/', ''], ['   └─ sumar-tickets.py', 'un programa que el modelo ejecuta'],
  ].map(([path, note]) => element('span', 'tree-line', raw('span', '', path), ...(note ? [element('small', '', note)] : [])))));
}

function renderAll() { renderRules(); renderMenu(); renderMcp(); renderReal(); }
document.addEventListener('languagechange', renderAll);
renderAll();
