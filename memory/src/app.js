import { $, element, Stepper } from '../../tokens/src/ui.js';
import { getLanguage, getLocale } from '../../i18n/i18n.js';

// Every example and number on this page is an illustration: invented people and notes, and rough, hypothetical sizes.
const say = (es, en) => getLanguage() === 'en' ? en : es;
// Always group thousands (Spanish leaves «1000» ungrouped by default).
const fmt = (value, digits = 0) => value.toLocaleString(getLocale(), { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: 'always' });
// File names and note contents stay as written; the translator leaves them alone.
const raw = (tag, className, ...children) => { const node = element(tag, className, ...children); node.dataset.i18nIgnore = ''; return node; };
const flow = items => element('div', 'block-flow', ...items.map(text => element('span', 'block-step', text)));
const bubble = (who, text, className = '') => element('div', 'chat-line ' + who + (className ? ' ' + className : ''), element('span', 'chat-who', who === 'you' ? 'Tú' : 'Asistente'), element('p', '', text));
const desk = (label, ...children) => element('div', 'mini-desk', element('span', 'eyebrow', label), ...children);
const file = (name, text) => element('div', 'note-file', raw('code', '', name), raw('pre', '', text));
const code = text => raw('code', '', text);
const tokens = n => say(`${fmt(n)} tokens`, `${fmt(n)} tokens`);
const PRICE = 3; // hypothetical: dollars per million tokens read
const money = value => say(`${fmt(value, 2)} $`, `$${fmt(value, 2)}`);

// ---------- 01 · What is not on the desk does not exist ----------
function deskSteps() {
  return [
    { stage: 1, title: 'Todo lo que sabe ahora mismo', caption: 'En cada vuelta, el arnés monta la mesa: sus instrucciones, la lista de herramientas, la conversación hasta ahora y lo que hayas adjuntado. El modelo lee eso y escribe. No tiene ningún otro sitio de donde sacar nada.', render: () => flow(['Instrucciones del arnés', '+ herramientas', '+ la conversación', '+ lo que adjuntas', '= todo lo que sabe ahora']) },
    { stage: 2, title: 'El lunes se lo cuentas', caption: 'Mientras dure esta conversación, la frase está en la mesa y la tiene en cuenta.', render: () => desk('CONVERSACIÓN DEL LUNES', bubble('you', 'Una cosa: los viernes no trabajo, son para mi familia.'), bubble('ai', 'Entendido, nada de viernes.')) },
    { stage: 3, title: 'El martes, conversación nueva', caption: 'Una conversación nueva empieza con la mesa limpia. Lo del lunes no está, así que para el modelo no existe.', render: () => desk('CONVERSACIÓN DEL MARTES', bubble('you', 'Propón tres huecos para una reunión con un cliente la semana que viene.'), bubble('ai', 'Martes a las 10, jueves a las 16 o viernes a las 12.', 'wrong')) },
    { stage: 4, title: 'Lo que no tiene, lo adivina o no lo sabe', caption: 'Sin el dato, puede rellenar el hueco con algo que suena bien (el viernes) o decirte que no lo sabe. Ninguna de las dos es culpa del modelo: le falta el papel en la mesa.', render: () => element('div', 'two-cases', desk('SI LO ADIVINA', bubble('ai', 'El viernes a las 12 suele ir bien para todos.', 'wrong')), desk('SI NO LO SABE', bubble('ai', 'No sé qué días trabajas. ¿Me lo dices?'))) },
  ];
}
new Stepper($('desk-explainer'), deskSteps);

// ---------- 02 · A full desk ----------
const WINDOW = 1_000_000;
const LOADS = [
  { key: 'base', name: 'Instrucciones y herramientas', how: 'siempre van', tokens: 15_000, fixed: true },
  { key: 'chat', name: 'Esta conversación', how: 'unas 40 páginas de charla', tokens: 20_000 },
  { key: 'contract', name: 'El contrato de un cliente', how: '20 páginas', tokens: 10_000 },
  { key: 'mail', name: 'Los correos de una semana', how: '300 correos de media página', tokens: 60_000 },
  { key: 'receipts', name: 'Los recibos de un año de la empresa', how: '5.000 recibos de 150 tokens', tokens: 750_000 },
  { key: 'contracts', name: 'Los contratos de 2.000 empleados', how: '2.000 × 10 páginas', tokens: 10_000_000 },
  { key: 'news', name: 'Las noticias de los últimos 5 años', how: '100 noticias al día de 800 tokens', tokens: 146_000_000 },
];
const loaded = new Set(['base', 'chat']);
function renderLoads() {
  $('load-picker').replaceChildren(...LOADS.map(load => {
    const button = element('button', 'load-item', element('strong', '', load.name), element('small', '', load.how), raw('span', 'load-size', tokens(load.tokens)));
    button.type = 'button'; button.disabled = !!load.fixed;
    button.setAttribute('aria-pressed', String(loaded.has(load.key)));
    button.addEventListener('click', () => { loaded.has(load.key) ? loaded.delete(load.key) : loaded.add(load.key); renderLoads(); });
    return button;
  }));
  const total = LOADS.filter(l => loaded.has(l.key)).reduce((sum, l) => sum + l.tokens, 0), share = total / WINDOW;
  const segments = LOADS.filter(l => loaded.has(l.key)).map(l => { const s = element('span', 'gauge-part ' + l.key); s.style.width = Math.min(100, l.tokens / WINDOW * 100) + '%'; s.title = l.name; return s; });
  $('desk-gauge').replaceChildren(element('div', 'gauge' + (share > 1 ? ' over' : ''), ...segments, element('span', 'gauge-half', element('small', '', 'la mitad'))),
    element('div', 'gauge-scale', element('span', '', '0'), element('span', '', say('1.000.000 tokens', '1,000,000 tokens'))));
  const pages = Math.round(total / 500), turn = total / 1e6 * PRICE;
  const stat = (label, value, note) => element('div', 'desk-stat', element('small', '', label), raw('strong', '', value), ...(note ? [element('small', '', note)] : []));
  $('desk-stats').replaceChildren(
    stat('Ocupa', share > 1 ? say(`${fmt(share, 1)} veces la mesa`, `${fmt(share, 1)} times the desk`) : `${fmt(share * 100, share < .1 ? 1 : 0)} %`, tokens(total)),
    stat('Cada vuelta cuesta', share > 1 ? '—' : money(turn), share > 1 ? 'no llega a enviarse' : say(`${money(turn * 10)} en una charla de 10 vueltas`, `${money(turn * 10)} in a 10-round chat`)),
    stat('Tu pregunta es', say(`1 página de ${fmt(pages)}`, `1 page out of ${fmt(pages)}`), 'lo que compite por su atención'));
  const verdict = share > 1 ? ['No cabe.', ' El arnés no puede ni enviar la petición. Claude Code contesta: «Prompt is too long».']
    : share > .5 ? ['Cabe, pero la mesa está llena.', ' Cada pregunta sale cara y lo importante queda perdido entre mucho texto.']
    : ['Cabe, y queda sitio para trabajar.', ' Así es como debería estar la mesa.'];
  $('desk-verdict').className = 'lesson-note' + (share > .5 ? ' alert' : '');
  $('desk-verdict').replaceChildren(element('strong', '', verdict[0]), verdict[1]);
}

// ---------- 03 · From prompt to context ----------
const ERAS = [
  { when: '2020', who: 'GPT-3', title: 'Dar ejemplos', text: 'El modelo solo continuaba texto, así que se fingía el principio de un documento con unos cuantos ejemplos para que siguiera el patrón.', chapter: 'Capítulo 10' },
  { when: '2022–2023', who: 'ChatGPT', title: 'Frases mágicas', text: '«Eres un experto en…», «piensa paso a paso». Funcionaban; hoy los modelos razonan por su cuenta y esos trucos importan mucho menos.', chapter: 'Capítulo 11' },
  { when: '2025 →', who: 'Agentes', title: 'Ordenar el contexto', text: 'Lo que decide es qué hay en la mesa: las instrucciones de la casa, los archivos, las skills, la memoria y cómo se encuentra cada cosa.', chapter: 'Capítulos 13 a 16' },
];
function renderEras() {
  $('eras').replaceChildren(...ERAS.map(era => element('article', 'era', element('span', 'era-when', era.when), element('small', '', era.who), element('h3', '', era.title), element('p', '', era.text), element('span', 'era-chapter', era.chapter))));
}

// ---------- 04 · Remembering between conversations ----------
// The note and the index line are files: each language gets its own version.
const allergyNote = () => say(`# Lucía · alergia\n\nLucía, la hija de 7 años, es alérgica a los frutos secos.\nNada de almendras, nueces, avellanas ni cacahuetes en\nrecetas, menús o regalos de comida para ella.\n\nMe lo contó el lunes 26 de octubre.`,
  `# Lucía · allergy\n\nLucía, the 7-year-old daughter, is allergic to nuts.\nNo almonds, walnuts, hazelnuts or peanuts in recipes,\nmenus or food gifts for her.\n\nTold me on Monday 26 October.`);
const indexLine = () => say('- [Lucía · alergia](lucia-alergia.md): alérgica a los frutos secos', '- [Lucía · allergy](lucia-alergia.md): allergic to nuts');
const memoryTitle = () => say('# Mi memoria', '# My memory');
function memorySteps() {
  return [
    { stage: 1, title: 'El lunes se lo cuentas', caption: 'Lo dices de pasada, en medio de otra cosa. El asistente se da cuenta de que es algo que conviene recordar.', render: () => desk('CONVERSACIÓN DEL LUNES', bubble('you', 'Por cierto, mi hija Lucía es alérgica a los frutos secos. Ahora, ¿me ayudas con la lista de la compra?'), bubble('ai', 'Lo apunto para tenerlo en cuenta. Vamos con la lista…')) },
    { stage: 2, title: 'Lo apunta en una nota', caption: 'El arnés le deja escribir en una carpeta de memoria. Escribe una nota corta y añade una línea al índice, que dice de qué trata.', render: () => element('div', 'two-cases', file('memoria/lucia-alergia.md', allergyNote()), file('memoria/MEMORIA.md', memoryTitle() + '\n\n…\n' + indexLine())) },
    { stage: 3, title: 'Otro día, conversación nueva', caption: 'La mesa empieza limpia, pero el arnés pone en ella el índice de la memoria. Ahí está la línea de Lucía.', render: () => desk('CONVERSACIÓN DEL VIERNES', raw('pre', 'desk-index', memoryTitle() + '\n…\n' + indexLine()), bubble('you', 'Dame una receta de galletas para el cumpleaños de Lucía.')) },
    { stage: 4, title: 'Abre la nota y la usa', caption: 'La línea del índice tiene que ver con lo que pides, así que abre la nota y la tiene en cuenta. Solo abre esa: el resto de su memoria se queda en el archivo.', render: () => desk('CONVERSACIÓN DEL VIERNES', element('span', 'open-arrow', '📄 abre lucia-alergia.md'), bubble('ai', 'Galletas de mantequilla con pepitas de chocolate, sin frutos secos, por la alergia de Lucía. Mira bien que el chocolate no lleve trazas.', 'right')) },
    { stage: 5, title: 'La misma pregunta, sin memoria', caption: 'Sin la nota, la receta típica de galletas de cumpleaños lleva almendra. No es un error del modelo: no tenía forma de saberlo.', render: () => desk('SIN MEMORIA', bubble('you', 'Dame una receta de galletas para el cumpleaños de Lucía.'), bubble('ai', 'Galletas de almendra y nueces, crujientes y fáciles…', 'wrong')) },
  ];
}
new Stepper($('memory-explainer'), memorySteps);

// ---------- 05 · Where the memory is ----------
const NOTES = [
  { file: 'familia.md', line: 'Familia: pareja, Javier; hija, Lucía, de 7 años', text: 'Vivo con Javier y nuestra hija Lucía, de 7 años. Mis padres viven en Teruel.' },
  { file: 'lucia-alergia.md', line: 'Lucía: alérgica a los frutos secos', text: 'Nada de frutos secos en recetas, menús o regalos de comida para Lucía.' },
  { file: 'trabajo.md', line: 'Trabajo: horario, jefe y proyectos (los viernes no trabajo)', text: 'Trabajo de lunes a jueves en una gestoría. Los viernes son para la familia.' },
  { file: 'hipoteca.md', line: 'Casa: hipoteca, cuota y fecha de revisión', text: 'Cuota de 640 € al mes. El tipo se revisa en marzo.' },
  { file: 'presupuesto.md', line: 'Dinero: presupuesto del mes y ahorro', text: 'Entran 3.900 € al mes. Ahorramos unos 400 €.' },
  { file: 'coche.md', line: 'Coche: modelo, seguro e ITV', text: 'Un coche de 2014. La ITV caduca en marzo; el seguro, en junio.' },
  { file: 'vacaciones.md', line: 'Vacaciones: Asturias en agosto, casa rural reservada', text: 'Del 3 al 17 de agosto en una casa rural cerca de Llanes.' },
  { file: 'estilo.md', line: 'Cómo quiero las respuestas: cortas y con ejemplos', text: 'Prefiero respuestas cortas, con un ejemplo, y sin tecnicismos.' },
];
const QUESTIONS = [
  { label: '¿Me llega para cambiar de coche este año?', open: ['presupuesto.md', 'hipoteca.md', 'coche.md'] },
  { label: 'Una receta para el cumpleaños de Lucía', open: ['lucia-alergia.md'] },
  { label: 'Propón huecos para una reunión', open: ['trabajo.md'] },
  { label: '¿Qué hacemos en las vacaciones?', open: ['vacaciones.md', 'familia.md'] },
];
const MEMORY_SIZE = { notes: 200, index: 4_000, note: 500 };
let question = 0;
function renderMemory() {
  $('question-picker').replaceChildren(...QUESTIONS.map((q, i) => {
    const button = element('button', 'chip', q.label); button.type = 'button';
    button.setAttribute('aria-pressed', String(i === question));
    button.addEventListener('click', () => { question = i; renderMemory(); });
    return button;
  }));
  const open = QUESTIONS[question].open;
  $('memory-index').replaceChildren(code('MEMORIA.md'),
    ...NOTES.map(n => element('div', 'index-line' + (open.includes(n.file) ? ' picked' : ''), code(n.file), element('span', '', n.line))),
    element('small', 'fine', say(`… y ${MEMORY_SIZE.notes - NOTES.length} notas más.`, `… and ${MEMORY_SIZE.notes - NOTES.length} more notes.`)));
  $('memory-notes').replaceChildren(...NOTES.filter(n => open.includes(n.file)).map(n => element('div', 'note-card', code(n.file), element('p', '', n.text))));
  const used = MEMORY_SIZE.index + open.length * MEMORY_SIZE.note, all = MEMORY_SIZE.notes * MEMORY_SIZE.note;
  const bar = (label, value, className) => { const fill = element('span', className); fill.style.width = Math.max(1, value / all * 100) + '%'; return element('div', 'compare-row', element('small', '', label), element('div', 'compare-track', fill), raw('strong', '', tokens(value))); };
  $('memory-compare').replaceChildren(element('span', 'eyebrow', 'LO QUE OCUPA EN LA MESA'),
    bar(say(`El índice y ${open.length === 1 ? 'una nota' : `${open.length} notas`}`, `The index and ${open.length === 1 ? 'one note' : `${open.length} notes`}`), used, 'good'),
    bar(say(`Las ${MEMORY_SIZE.notes} notas, siempre`, `All ${MEMORY_SIZE.notes} notes, always`), all, 'bad'));
}

// ---------- 06 · The map of knowledge ----------
const QUESTION = '«¿Qué le prometimos a Horno Alto por el retraso de la imprenta?»';
const ANSWER = 'Un descuento de 350 € en la próxima factura y usar otra imprenta, Gráficas Moncayo, para todo lo de Navidad.';
const SHELVES = ['Academia Babel', 'Bodegas Cierzo', 'Clínica Sonrisas', 'Ferretería Lacasa', 'Gimnasio Forja', 'Horno Alto', 'Hotel Puerta del Ebro', 'La agencia', 'Óptica Miravista'];
const HORNO = ['horno-alto-ficha.md', 'horno-alto-presupuesto.md', 'acta-09-09-color.md', 'horno-alto-incidencia-imprenta.md', 'correo-disculpa-imprenta.md', 'acta-15-10-seguimiento.md', 'horno-alto-calendario.md', 'horno-alto-web-textos.md'];
const PICKED = ['horno-alto-incidencia-imprenta.md', 'correo-disculpa-imprenta.md', 'acta-15-10-seguimiento.md'];
const STRATEGIES = [
  { key: 'all', button: 'Todo en la mesa', desk: 500_000, rounds: 1, read: 500_000, notes: 1000, verdict: 'Encuentra la respuesta, pero ha leído mil notas para usar tres. Y ha llenado la mitad de la mesa antes de empezar.' },
  { key: 'flat', button: 'Un índice de mil líneas', desk: 40_000, rounds: 5, read: 200_000, notes: 3, verdict: 'Abre solo tres notas, pero el índice es otra mesa llena: mil líneas que se vuelven a enviar en cada vuelta.' },
  { key: 'map', button: 'Un mapa por niveles', desk: 1_000, rounds: 4, read: 10_000, notes: 3, verdict: 'Mira el catálogo, abre el índice de Horno Alto y, de ahí, las tres notas. La mesa casi no se nota.' },
];
let strategy = 'map';
const column = (title, ...rows) => element('div', 'map-column', element('span', 'eyebrow', title), ...rows);
// File names stay as written; folder names are translated.
const mapRow = (text, picked) => (/\.md$|^…$/.test(text) ? raw : element)('div', 'map-row' + (picked ? ' picked' : ''), text);
function renderMap() {
  $('map-question').replaceChildren(element('span', '', QUESTION));
  $('strategy-picker').replaceChildren(...STRATEGIES.map(s => {
    const button = element('button', 'chip', s.button); button.type = 'button';
    button.setAttribute('aria-pressed', String(s.key === strategy));
    button.addEventListener('click', () => { strategy = s.key; renderMap(); });
    return button;
  }));
  const s = STRATEGIES.find(x => x.key === strategy);
  const answer = element('div', 'map-answer', element('span', 'eyebrow', 'RESPONDE'), element('p', '', ANSWER));
  if (s.key === 'all') {
    const pile = element('div', 'note-pile', ...Array.from({ length: 200 }, (_, i) => element('span', i === 61 || i === 62 || i === 64 ? 'picked' : '')));
    $('map-view').replaceChildren(element('div', 'map-columns single', column('EN LA MESA: LAS 1.000 NOTAS', pile, element('small', 'fine', 'Cada cuadrito son cinco notas. Las tres que importan están en medio.'))), answer);
  } else if (s.key === 'flat') {
    const lines = ['academia-babel-acta-2024-03.md', 'academia-babel-ficha.md', '…', 'hotel-ebro-correo-12.md', ...HORNO.slice(2, 6), 'horno-alto-redes.md', '…', 'optica-miravista-presupuesto.md'];
    $('map-view').replaceChildren(element('div', 'map-columns two', column('EN LA MESA: EL ÍNDICE (1.000 LÍNEAS)', ...lines.map(l => mapRow(l, PICKED.includes(l)))), column('ABRE', ...PICKED.map(l => mapRow(l, true)))), answer);
  } else {
    $('map-view').replaceChildren(element('div', 'map-columns', column('EN LA MESA: EL CATÁLOGO', ...SHELVES.map(l => mapRow(l, l === 'Horno Alto')), element('small', 'fine', '… 30 carpetas')),
      column('ABRE: EL ÍNDICE DE HORNO ALTO', ...HORNO.map(l => mapRow(l, PICKED.includes(l))), element('small', 'fine', '… 30 notas')),
      column('ABRE: LAS NOTAS', ...PICKED.map(l => mapRow(l, true)))), answer);
  }
  const stat = (label, value, note) => element('div', 'desk-stat', element('small', '', label), raw('strong', '', value), ...(note ? [element('small', '', note)] : []));
  $('map-stats').replaceChildren(
    stat('En la mesa desde el principio', tokens(s.desk), say(`${fmt(s.desk / WINDOW * 100, s.desk < 10_000 ? 1 : 0)} % de la mesa`, `${fmt(s.desk / WINDOW * 100, s.desk < 10_000 ? 1 : 0)} % of the desk`)),
    stat('Notas que lee', fmt(s.notes)),
    stat('Coste de la pregunta', money(s.read / 1e6 * PRICE), say(`${tokens(s.read)} leídos en ${s.rounds} ${s.rounds === 1 ? 'vuelta' : 'vueltas'}`, `${tokens(s.read)} read in ${s.rounds} ${s.rounds === 1 ? 'round' : 'rounds'}`)));
  $('map-verdict').textContent = s.verdict;
}

function renderAll() { renderLoads(); renderEras(); renderMemory(); renderMap(); }
document.addEventListener('languagechange', renderAll);
renderAll();
