import { $, element, reducedMotion, Stepper } from '../../tokens/src/ui.js';
import { getLanguage, translateText } from '../../i18n/i18n.js';

// Every example on this page is an illustration: the agency, its skills, the receipts, the server,
// the steps and the answers are invented and written by hand to show the idea. Nothing here is measured.
const say = (es, en) => getLanguage() === 'en' ? en : es;
// File names, skill names and code stay as written; the translator leaves them alone.
const raw = (tag, className, ...children) => { const node = element(tag, className, ...children); node.dataset.i18nIgnore = ''; return node; };
const flow = items => element('div', 'block-flow', ...items.map(text => element('span', 'block-step', text)));
// Answers are written like the model writes them: **bold** and `code` become plain elements.
const inline = text => text.split(/(\*\*[^*]+\*\*|`[^`]+`)/).filter(Boolean)
  .map(part => part.startsWith('**') ? element('strong', '', part.slice(2, -2)) : part.startsWith('`') ? element('code', '', part.slice(1, -1)) : part);
const answer = (className, text) => raw('div', className, ...text.split('\n').filter(line => line.trim()).map(line => element('p', '', ...inline(line))));
const menuEntry = ({ name, description }, className = '') => element('div', 'menu-item ' + className, raw('code', '', name), element('span', '', description));

// ---------- The invented agency, Brújula, and its skills ----------
const STUDIO = [
  { name: 'politica-de-gastos', description: 'Reglas de Brújula para clasificar y reembolsar gastos de viaje. Úsala al revisar tickets, preparar notas de gasto o calcular reembolsos.' },
  { name: 'actas-de-reunion', description: 'Cómo redactar el acta de una reunión del equipo. Úsala al resumir una reunión o preparar el acta.' },
  { name: 'responder-clientes', description: 'Tono y plantillas para contestar correos de clientes. Úsala al redactar una respuesta a un cliente.' },
  { name: 'pedir-vacaciones', description: 'Cómo se piden y se aprueban las vacaciones y los permisos en Brújula. Úsala con dudas sobre vacaciones o días libres.' },
  { name: 'redes-sociales', description: 'Guía de estilo para publicar en las redes sociales de la agencia. Úsala al escribir o revisar una publicación.' },
  { name: 'traducir-textos', description: 'Glosario y tono para traducir los textos de la agencia al inglés y al alemán. Úsala al traducir propuestas, correos o publicaciones.' },
];
const policy = STUDIO[0];
// The skill file: its label (what the menu shows) and its contents (what it reads when it opens it).
const label = skill => ['---', `name: ${skill.name}`, `description: ${translateText(skill.description)}`, '---'].join('\n');
const policyBody = () => say(`# Política de gastos de viaje de Brújula

Contabilidad solo acepta notas de gasto que sigan estas reglas.

## Categorías

Usa estas seis: comida, transporte, coche, alojamiento, ocio y tasas.

- coche: gasolina, alquiler de coches y parking. No van en transporte.
- tasas: tasas turísticas, aunque vengan dentro de otra factura.
  Sepáralas en su propia fila.
- alojamiento: hoteles, sin la tasa turística.

## Lo que no se reembolsa

- Propinas. Se reembolsa el importe sin ellas.
- Ocio por encima del tope: como máximo 25 € por persona y actividad.
  En este viaje eran 4 personas: el tope es 100 € por ticket de ocio.

## Formato de la nota

Una fila por ticket, el total de cada categoría y una última línea:

**Total a reembolsar: N €**`, `# Brújula travel expense policy

Accounting only accepts expense notes that follow these rules.

## Categories

Use these six: food, transport, car, lodging, leisure and taxes.

- car: petrol, car hire and parking. They do not go in transport.
- taxes: city taxes, even when they come inside another invoice.
  Put them on their own row.
- lodging: hotels, without the city tax.

## Not reimbursed

- Tips. The amount without them is reimbursed.
- Leisure above the cap: at most €25 per person and activity.
  On this trip there were 4 people: the cap is €100 per leisure receipt.

## Note format

One row per receipt, the total of each category and a last line:

**Total to reimburse: N €**`);

// ---------- 01 · The desk and the filing cabinet ----------
function inventorySteps() {
  const desk = (filled, name) => element('div', 'inventory', ...Array.from({ length: 12 }, (_, i) => element('span', 'slot' + (i < filled ? ' full' : ''), i < filled ? name(i) : '')));
  const manuals = ['Gastos', 'Clientes', 'Vacaciones', 'Actas', 'Redes', 'Traducción', 'Contratos', 'Facturas', 'Proyectos', 'Viajes', 'Nóminas', 'Marca'];
  return [
    { stage: 1, title: 'Lo que tiene delante en cada vuelta', caption: 'Las instrucciones del arnés, la lista de herramientas y toda la conversación. Es su mesa de trabajo: lo único que tiene delante. Lo que no esté en la mesa, para el modelo no existe.', render: () => flow(['Instrucciones', '+ herramientas', '+ la conversación', '= lo que lee el modelo']) },
    { stage: 2, title: 'Una empresa tiene muchos manuales', caption: 'Cómo se reembolsan los gastos, cómo se contesta a un cliente, cómo se piden las vacaciones… Si se los pones todos en la mesa, se llena antes de empezar, y los pagas en cada vuelta aunque la tarea solo necesite uno.', render: () => desk(12, i => manuals[i]) },
    { stage: 3, title: 'Mejor un archivador con etiquetas', caption: 'El arnés guarda los manuales en un archivador y solo pone en la mesa la etiqueta de cada cajón: su nombre y una línea que dice para qué sirve. Estas son las 6 etiquetas de la agencia Brújula.', render: () => element('div', 'menu-list', ...STUDIO.map(skill => menuEntry(skill, skill === policy ? 'picked' : ''))) },
    { stage: 4, title: 'Abre solo el cajón que necesita', caption: 'Al leer «prepara la nota de gastos», el modelo pide la política. El arnés le pone el manual entero en la mesa y el modelo sigue trabajando con él. Los otros cinco se quedan en el archivador.', render: () => element('div', 'open-skill', menuEntry(policy, 'picked'), element('span', 'open-arrow', '↓ el arnés le pone el manual en la mesa'), raw('pre', 'code-view skill-body', policyBody().split('\n').slice(0, 9).join('\n') + '\n…')) },
  ];
}
new Stepper($('inventory-explainer'), inventorySteps);

// ---------- Steps of a session, as a person would see them ----------
const STEP = {
  skill: () => ({ icon: '📘', what: ['Abre la skill ', raw('code', '', policy.name)], result: 'El arnés le pone el manual entero en la mesa.', state: 'good' }),
  list: () => ({ icon: '📁', what: 'Mira qué hay en la carpeta' }),
  read: () => ({ icon: '📄', what: 'Lee todos los tickets' }),
  compute: () => ({ icon: '🧮', what: 'Hace las cuentas con un pequeño programa' }),
  write: () => ({ icon: '✏️', what: ['Escribe el archivo ', raw('code', '', 'gastos.md')] }),
};
function timelineItem(item) {
  return element('div', 'timeline-item' + (item.state ? ' ' + item.state : ''), element('span', 'timeline-icon', item.icon),
    element('div', 'timeline-body', element('div', 'timeline-what', ...[].concat(item.what)), ...(item.result ? [element('div', 'timeline-result', ...[].concat(item.result))] : []), ...(item.final ? [answer('chat-answer small', item.final)] : [])));
}

// ---------- 02 · The house rules ----------
const request = () => say('«En la carpeta recibos están los tickets del viaje del equipo a la feria de Colonia. Prepara la nota de gastos para contabilidad y guárdala en gastos.md.»',
  '«The receipts folder has the receipts from the team’s trip to the trade fair in Cologne. Prepare the expense note for accounting and save it in gastos.md.»');
const RUNS = {
  without: { steps: ['list', 'read', 'compute', 'write'], final: () => say(
    'He guardado la nota en `gastos.md`, agrupada en transporte, alojamiento, comidas y ocio. El total es de **3.616,36 €**.\nHe dejado el ocio aparte, como pendiente de confirmar: no sé si lo paga la empresa. Antes de enviarla, conviene que alguien lo revise.',
    'I saved the note in `gastos.md`, grouped into transport, lodging, meals and leisure. The total is **€3,616.36**.\nI left leisure apart, pending confirmation: I do not know if the company pays for it. Someone should check it before it is sent.') },
  skill: { steps: ['skill', 'list', 'read', 'write'], final: () => say(
    'He guardado la nota en `gastos.md` según la política de gastos de Brújula. He quitado 9,10 € de propinas y 4 € de exceso en el kart, y he separado la tasa turística del hotel.\nTotal a reembolsar: **3.603,26 €**.',
    'I saved the note in `gastos.md` following the Brújula expense policy. I took out €9.10 of tips and €4 over the cap on the karting, and put the hotel’s city tax on its own row.\nTotal to reimburse: **€3,603.26**.') },
};
// What each version would write for each rule: ✓ when it follows the policy.
const RULES = [
  { name: 'Las propinas no se reembolsan', without: 'Taxi: 35,00 €, propina incluida', skill: 'Taxi: 31,80 €, sin los 3,20 € de propina' },
  { name: 'La tasa turística, en su propia fila', without: 'Hotel: 1.243,20 €, todo junto', skill: 'Hotel: 1.184,00 € y, aparte, tasas: 59,20 €' },
  { name: 'Gasolina, alquiler y parking van en «coche»', without: 'El coche de alquiler, en «transporte»', skill: 'Alquiler, gasolina y parking, en «coche»' },
  { name: 'Ocio: como mucho 100 € por ticket', without: 'Karting: 104,00 €', skill: 'Karting: 100,00 €, sin los 4 € de exceso' },
  { name: 'El total a reembolsar', without: '3.616,36 €: todo lo de los tickets', skill: '3.603,26 €: sin propinas ni exceso de ocio' },
];
function renderRules() {
  $('request-text').replaceChildren(raw('span', '', request()));
  $('policy-head').replaceChildren(raw('span', '', label(policy)));
  $('policy-text').replaceChildren(raw('span', '', policyBody()));
  for (const key of ['without', 'skill']) {
    $(key + '-timeline').replaceChildren(...RUNS[key].steps.map(step => timelineItem(STEP[step]())));
    $(key + '-final').replaceChildren(element('p', 'fine', 'Su respuesta:'), answer('', RUNS[key].final()));
  }
  const mark = ok => element('span', 'rule-mark ' + (ok ? 'yes' : 'no'), ok ? '✓' : '✗');
  $('rule-table').replaceChildren(
    element('div', 'rule-row rule-head', element('span', '', 'Regla de la política'), element('span', '', 'Sin la skill'), element('span', '', 'Con la skill')),
    ...RULES.map(rule => element('div', 'rule-row', element('div', 'rule-name', element('strong', '', rule.name)),
      element('div', 'rule-cell no', mark(false), element('span', '', rule.without)),
      element('div', 'rule-cell yes', mark(true), element('span', '', rule.skill)))));
}

// ---------- 03 · The menu decides (a scripted illustration) ----------
const ENTRIES = [
  { key: 'clear', button: 'Nombre y descripción claros', entry: policy, level: 4, odds: 'Siempre, y lo primero',
    thought: '«Prepara la nota de gastos»… y en el menú hay una política de gastos que dice «úsala al preparar notas de gasto». Es justo esto: la abro antes de nada.',
    steps: ['skill', 'list', 'read', 'write'] },
  { key: 'vagueText', button: 'Descripción vaga', entry: { name: 'politica-de-gastos', description: 'Notas varias de administración.' }, level: 3, odds: 'Casi siempre, pero tarde',
    thought: 'La descripción no dice nada, pero el nombre suena a gastos. Primero miro los tickets y luego le echo un vistazo.',
    steps: ['list', 'read', 'skill', 'write'] },
  { key: 'vagueName', button: 'Nombre y descripción vagos', entry: { name: 'notas-admin', description: 'Notas varias de administración.' }, level: 2, odds: 'A veces',
    thought: '¿«notas-admin»? Puede que tenga algo de gastos, o puede que no. Depende de si se me ocurre mirar.',
    steps: ['list', 'read', 'maybe', 'write'] },
  { key: 'none', button: 'Sin ninguna pista', entry: { name: 'varios', description: 'Cosas de la agencia.' }, level: 1, odds: 'Es lotería',
    thought: 'Nada en el menú habla de gastos. Hago la nota como me parece; si abro «varios», será por casualidad.',
    steps: ['list', 'read', 'maybe', 'write'] },
];
let entry = 'clear';
function renderMenu() {
  $('entry-picker').replaceChildren(...ENTRIES.map(e => {
    const button = element('button', 'chip', e.button); button.type = 'button';
    button.setAttribute('aria-pressed', String(e.key === entry));
    button.addEventListener('click', () => { entry = e.key; renderMenu(); });
    return button;
  }));
  const e = ENTRIES.find(x => x.key === entry);
  $('entry-menu').replaceChildren(...STUDIO.slice(1, 4).map(skill => menuEntry(skill)), menuEntry(e.entry, 'picked'),
    element('small', 'fine', '… y el resto de skills del menú.'));
  $('entry-odds').replaceChildren(element('strong', 'odds-verdict level-' + e.level, e.odds),
    element('div', 'odds-scale', element('small', '', 'lotería'), element('div', 'odds-track', ...[1, 2, 3, 4].map(i => element('span', i <= e.level ? 'on' : ''))), element('small', '', 'siempre')));
  $('entry-thought').replaceChildren(element('span', 'eyebrow', 'LO QUE «PIENSA» AL LEER EL MENÚ'), element('p', '', e.thought));
  $('entry-steps').replaceChildren(...e.steps.map(step => step === 'maybe'
    ? timelineItem({ icon: '🎲', what: ['¿Abre ', raw('code', '', e.entry.name), '? Unas veces sí y otras no.'], result: 'Si no la abre, la nota sale sin las reglas de la casa.', state: 'bad' })
    : timelineItem(STEP[step]())));
}

// ---------- 04 · Knowing and doing: MCP (a scripted illustration) ----------
const mcpRequest = () => request().slice(0, -1) + ' ' + say('Después, envíasela a contabilidad.»', 'Then send it to accounting.»');
const quote = text => raw('q', '', text);
function mcpItems() {
  const ask = $('mcp-ask').checked;
  const budget = { icon: '🔌', what: ['Usa ', raw('code', '', 'presupuesto_restante')], state: 'good',
    result: quote(say('Feria de Colonia 2026: presupuesto aprobado 3.200,00 €, gastado 0,00 €, quedan 3.200,00 €.', 'Feria de Colonia 2026: approved budget €3,200.00, spent €0.00, €3,200.00 left.')) };
  const send = { icon: '🔌', what: ['Usa ', raw('code', '', 'enviar_nota'), ' con un total de ', raw('strong', '', say('3.603,26 €', '€3,603.26'))], state: 'good',
    result: quote(say('Nota NG-0042 recibida: 3.603,26 € con cargo a «Feria de Colonia 2026». Contabilidad la revisará en 5 días hábiles.', 'Note NG-0042 received: €3,603.26 charged to «Feria de Colonia 2026». Accounting will review it within 5 working days.')) };
  const pause = { icon: '⏸', what: 'El arnés para y te pregunta antes de enviar', state: 'bad',
    result: say('¿Enviar a contabilidad una nota de 3.603,26 €? Se pasa en 403,26 € del presupuesto aprobado.', 'Send accounting a note of €3,603.26? It is €403.26 over the approved budget.') };
  const final = ask
    ? say('La nota está lista en `gastos.md`, con un total de **3.603,26 €**. No la he enviado todavía: se pasa en 403,26 € del presupuesto aprobado, 3.200 €. ¿La envío igualmente?', 'The note is ready in `gastos.md`, with a total of **€3,603.26**. I have not sent it yet: it is €403.26 over the approved budget of €3,200. Shall I send it anyway?')
    : say('He enviado la nota a contabilidad, que la ha registrado como NG-0042, con un total a reembolsar de **3.603,26 €**.\nOjo: el total se pasa en 403,26 € del presupuesto aprobado, 3.200 €.', 'I sent the note to accounting, which registered it as NG-0042, with a total to reimburse of **€3,603.26**.\nNote: the total is €403.26 over the approved budget of €3,200.');
  return [
    STEP.skill(), STEP.list(),
    { icon: '🧰', what: 'Pide las instrucciones de uso de las herramientas', result: raw('span', '', 'enviar_nota · presupuesto_restante'), state: 'good' },
    STEP.read(), budget, STEP.write(), ask ? pause : send,
    { icon: '💬', what: 'Te responde', final },
  ];
}
let shown = 1, timer = 0;
function renderMcp() {
  $('mcp-request').replaceChildren(raw('span', '', mcpRequest()));
  const list = mcpItems();
  $('mcp-timeline').replaceChildren(...list.slice(0, shown).map(timelineItem));
  $('mcp-next').disabled = shown >= list.length;
}
function stopPlay() { clearInterval(timer); timer = 0; $('mcp-play').textContent = translateText('▶ Reproducir'); }
$('mcp-next').addEventListener('click', () => { stopPlay(); shown = Math.min(mcpItems().length, shown + 1); renderMcp(); });
$('mcp-reset').addEventListener('click', () => { stopPlay(); shown = 1; renderMcp(); });
$('mcp-ask').addEventListener('change', () => { stopPlay(); shown = 1; renderMcp(); });
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
  $('skill-header').replaceChildren(raw('span', '', [label(policy), policyBody().split('\n')[0], '…'].join('\n')));
  // An illustration: the policy of this chapter is only its SKILL.md.
  $('skill-tree').replaceChildren(element('span', '', ...[
    ['politica-de-gastos/', ''], ['├─ SKILL.md', 'la etiqueta y las instrucciones'], ['├─ consulta/', ''], ['│  └─ dietas-por-pais.md', 'solo si el viaje es a otro país'],
    ['├─ plantillas/', ''], ['│  └─ nota-de-gastos.md', 'el formato que pide contabilidad'], ['└─ programas/', ''], ['   └─ sumar-tickets.py', 'un programa que el modelo ejecuta'],
  ].map(([path, note]) => element('span', 'tree-line', raw('span', '', path), ...(note ? [element('small', '', note)] : [])))));
}

function renderAll() { renderRules(); renderMenu(); renderMcp(); renderReal(); }
document.addEventListener('languagechange', () => { stopPlay(); renderAll(); });
renderAll();
