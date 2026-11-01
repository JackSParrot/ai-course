import { $, element } from '../../tokens/src/ui.js';
import { getLanguage, getLocale } from '../../i18n/i18n.js';
import { LEVELS, RUNS } from './data.js';

// The numbers on this page are real measurements (data.js); the bakery and its invoices are invented.
const say = (es, en) => getLanguage() === 'en' ? en : es;
// Always group thousands (Spanish leaves «1000» ungrouped by default).
const fmt = (value, digits = 0) => value.toLocaleString(getLocale(), { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: 'always' });
// Prompts, invoices and file names stay as written; the translator leaves them alone.
const raw = (tag, className, ...children) => { const node = element(tag, className, ...children); node.dataset.i18nIgnore = ''; return node; };
const chip = (label, pressed, onClick, keep = false) => { const button = element('button', 'chip', label); button.type = 'button'; if (keep) button.dataset.i18nIgnore = ''; button.setAttribute('aria-pressed', String(pressed)); button.addEventListener('click', onClick); return button; };

const runsOf = (task, effort) => RUNS.filter(r => r.task === task && r.effort === effort);
const median = values => { const v = [...values].sort((a, b) => a - b), m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
const mid = (task, effort, key) => median(runsOf(task, effort).map(r => r[key]));
const time = s => s < 60 ? say(`${fmt(s)} s`, `${fmt(s)} s`) : s < 600 ? say(`${Math.floor(s / 60)} min ${fmt(Math.round(s % 60))} s`, `${Math.floor(s / 60)} min ${fmt(Math.round(s % 60))} s`) : say(`${fmt(s / 60)} min`, `${fmt(s / 60)} min`);
const money = usd => say(`${fmt(usd, usd < 0.1 ? 3 : 2)} $`, `$${fmt(usd, usd < 0.1 ? 3 : 2)}`);
const tokens = n => say(`${fmt(n)} tokens`, `${fmt(n)} tokens`);
const times = x => say(`${fmt(x, x < 10 ? 1 : 0)} veces`, `${fmt(x, x < 10 ? 1 : 0)} times`);

// ---------- 01 · The dial ----------
const LEVEL_INFO = {
  low: { what: () => say('Lo mínimo: responde rápido, piensa poco y usa pocas herramientas, con llamadas escuetas.', 'The minimum: answers fast, thinks little and uses few tools, with terse calls.'), when: () => say('Preguntas rápidas y tareas sencillas que vas a revisar tú.', 'Quick questions and simple tasks you will review yourself.') },
  medium: { what: () => say('El nivel de serie de Opus 5.5 en Claude Code: equilibra calidad, tiempo y coste.', 'Opus 5.5\'s default in Claude Code: balances quality, time and cost.'), when: () => say('El trabajo de cada día, con un encargo claro.', 'Everyday work, with a clear request.') },
  high: { what: () => say('Piensa más, lee más y comprueba más antes de dar algo por hecho.', 'Thinks more, reads more and checks more before calling something done.'), when: () => say('Cuando comprobar importa o puede haber casos raros.', 'When checking matters or there may be odd cases.') },
  xhigh: { what: () => say('Todavía más comprobaciones. La documentación de la API lo recomienda para empezar en programación y agentes.', 'Even more checking. The API documentation recommends it as the starting point for coding and agents.'), when: () => say('Encargos largos de agente que trabajan solos un buen rato.', 'Long agent tasks that work alone for a good while.') },
  max: { what: () => say('Sin freno: piensa todo lo que haga falta. Puede darle vueltas de más a lo sencillo.', 'No brakes: thinks as much as it takes. It can overthink simple things.'), when: () => say('Problemas difíciles de verdad, que trabaja solo y sin prisa.', 'Truly hard problems it works on alone, with no hurry.') },
};
let level = 'medium';
function renderLevels() {
  $('level-picker').replaceChildren(...LEVELS.map(key => chip(key, key === level, () => { level = key; renderLevels(); }, true)));
  const info = LEVEL_INFO[level];
  const field = (label, text) => element('div', 'helper-field', element('span', 'eyebrow', label), element('p', '', text));
  $('level-card').replaceChildren(
    element('div', 'level-dial', ...LEVELS.map(key => element('span', 'dial-step' + (LEVELS.indexOf(key) <= LEVELS.indexOf(level) ? ' on' : '')))),
    raw('h3', '', level + (level === 'medium' ? say(' · el de serie', ' · the default') : '')),
    field(say('QUÉ HACE', 'WHAT IT DOES'), info.what()), field(say('PARA QUÉ', 'WHAT FOR'), info.when()),
    field(say('EXPLICAR UNA FACTURA, MEDIDO', 'EXPLAINING AN INVOICE, MEASURED'), say(`${time(mid('explicar', level, 'seconds'))} y ${money(mid('explicar', level, 'usd'))}, con ${tokens(mid('explicar', level, 'output'))} escritos.`, `${time(mid('explicar', level, 'seconds'))} and ${money(mid('explicar', level, 'usd'))}, writing ${tokens(mid('explicar', level, 'output'))}.`)));
}

// ---------- 02 · The experiment ----------
const POWER_BILL = `ELÉCTRICA SIERRA, S.L.U. — Factura de electricidad
Nº de factura: ES-202602-791    Fecha: 2026-02-08
Periodo: 01/01/2026 a 31/01/2026 (31 días)

LECTURAS DEL CONTADOR
  Lectura anterior (real): 56.530 kWh
  Lectura actual (real):   58.480 kWh

DETALLE
  Término de potencia   6,9 kW x 31 días     24,28 €
  Término de energía    2.950 kWh x 0,168   495,60 €
  Impuesto eléctrico    5,11 %               26,58 €
  Alquiler equipo medida                      0,82 €
  Base imponible                            547,28 €
  IVA 21 %                                  114,93 €
  TOTAL                                     662,21 €`;
// The prompts are quoted in Spanish, as they were sent.
const PERIOD = `En la carpeta facturas/ están las facturas de proveedores de Horno Alto, mi panadería, de julio de 2025 a junio de 2026.`;
const TASKS = [
  { key: 'explicar', button: () => say('Explicar una factura', 'Explain an invoice'), size: () => say('Sencillo · 1 archivo', 'Simple · 1 file'),
    prompt: `En facturas/factura_luz_2026_02.txt tienes la última factura de la luz de mi panadería. Explícame en lenguaje sencillo qué estoy pagando y por qué.`,
    check: () => say('Si ve que las lecturas no cuadran con los kWh cobrados y calcula lo cobrado de más.', 'Whether it sees that the readings don\'t match the kWh charged, and works out the overcharge.') },
  { key: 'tabla', button: () => say('Pasar a una tabla', 'Turn into a table'), size: () => say('Medio · 62 archivos', 'Medium · 62 files'),
    prompt: `${PERIOD} Léelas todas, entiende cómo está hecha cada una y crea gastos.csv con una fila por factura y estas columnas: archivo, proveedor, numero, fecha (AAAA-MM-DD), categoria, base, iva, retencion, total (en euros, con punto decimal). Después dime cuánto he gastado en total en esos doce meses.`,
    check: () => say('Las 61 facturas, fila a fila, contra la solución: importes, fechas, la repetida fuera y el abono en negativo. Y si, sin que nadie se lo pida, avisa del error de la luz.', 'The 61 invoices, row by row, against the answer key: amounts, dates, the duplicate left out and the credit note negative. And whether, unasked, it warns about the power bill error.') },
  { key: 'informe', button: () => say('Hacer un informe', 'Make a report'), size: () => say('Complejo · 62 archivos y una web', 'Complex · 62 files and a web page'),
    prompt: `${PERIOD} Crea informe.html, una página que se abra con doble clic y sin internet, para entender mis gastos: gasto por mes y por categoría, tendencias, qué aprendes de ellas y una previsión de lo que gastaré de julio a diciembre de 2026. Explica en la página cómo has hecho las cuentas.`,
    check: () => say('Abrimos cada página y la leímos: qué avisa, qué previsión da y qué añade.', 'We opened each page and read it: what it warns about, what forecast it gives and what it adds.') },
];
let task = 'explicar';
function renderTasks() {
  $('power-bill').replaceChildren(raw('pre', 'invoice-text', POWER_BILL));
  $('task-picker').replaceChildren(...TASKS.map(t => chip(t.button(), t.key === task, () => { task = t.key; renderTasks(); })));
  const t = TASKS.find(x => x.key === task);
  const field = (label, ...children) => element('div', 'helper-field', element('span', 'eyebrow', label), ...children);
  $('task-card').replaceChildren(
    element('div', 'helper-head', element('h3', '', t.button()), element('p', '', t.size())),
    field(say('EL ENCARGO, TAL CUAL', 'THE REQUEST, AS WRITTEN'), raw('div', 'mission-card small', raw('p', '', t.prompt))),
    field(say('LO QUE COMPROBAMOS', 'WHAT WE CHECKED'), element('p', '', t.check())));
}

// ---------- 03 · What we measured ----------
const METRICS = [
  { key: 'seconds', label: () => say('Tiempo', 'Time'), show: time },
  { key: 'usd', label: () => say('Coste', 'Cost'), show: money },
  { key: 'output', label: () => say('Tokens escritos', 'Tokens written'), show: tokens },
];
// What each report did, read by hand: the grader only gives a first pass, the page has to be opened.
const REPORT_NOTES = {
  low: () => say('No vio el error: tomó los 2.950 kWh por el pico del invierno. Sí avisó de la factura repetida y del abono. Previsión: 25.585 €.', 'Missed the error: it took the 2,950 kWh as the winter peak. It did warn about the duplicate and the credit note. Forecast: €25,585.'),
  medium: () => say('Empieza con «tres cosas que revisar», la luz la primera. Previsión: 25.585 €, con una horquilla. Añade todas las facturas al final.', 'Opens with «three things to check», the power bill first. Forecast: €25,585, with a range. Lists every invoice at the end.'),
  high: () => say('Avisa de la luz y usa el consumo real en las tendencias. Estima las facturas que aún no han llegado. Previsión: 25.691 €.', 'Warns about the power bill and uses real consumption in the trends. Estimates the invoices that have not arrived yet. Forecast: €25,691.'),
  xhigh: () => say('Lo mismo que high y, además, recuerda que de julio a octubre ya han pasado: propone comparar la previsión con las facturas reales. Previsión: 25.691 €.', 'The same as high, and it also notes that July to October have already passed: it suggests comparing the forecast with the real invoices. Forecast: €25,691.'),
  max: () => say('Un botón para ver con o sin IVA y un gráfico del consumo real frente al cobrado. Previsión: 25.585 €, la misma que medium.', 'A button to show amounts with or without VAT and a chart of real against billed consumption. Forecast: €25,585, the same as medium.'),
};
let measureTask = 'explicar', metric = 'seconds';
function checkText(effort) {
  const runs = runsOf(measureTask, effort), caught = runs.filter(r => r.caught).length;
  const power = say(`Vio el error de la luz: ${caught} de ${runs.length}`, `Spotted the power bill error: ${caught} of ${runs.length}`);
  if (measureTask === 'explicar') return [power];
  if (measureTask === 'tabla') return [say(`Filas correctas: ${runs.map(r => r.rows).join(' y ')} de 61`, `Correct rows: ${runs.map(r => r.rows).join(' and ')} of 61`), power];
  return [power, REPORT_NOTES[effort]()];
}
function renderMeasure() {
  $('measure-task').replaceChildren(...TASKS.map(t => chip(t.button(), t.key === measureTask, () => { measureTask = t.key; renderMeasure(); })));
  $('measure-metric').replaceChildren(...METRICS.map(m => chip(m.label(), m.key === metric, () => { metric = m.key; renderMeasure(); })));
  const m = METRICS.find(x => x.key === metric);
  const top = Math.max(...RUNS.filter(r => r.task === measureTask).map(r => r[metric]));
  const pct = v => Math.max(0.6, v / top * 100) + '%';
  $('measure-bars').replaceChildren(...LEVELS.map(effort => {
    const runs = runsOf(measureTask, effort), value = mid(measureTask, effort, metric);
    const bar = element('span', 'effort-bar'); bar.style.width = pct(value);
    // Written tokens split into thinking and the rest: in max, almost all of it is thinking.
    if (metric === 'output') { const think = element('span', 'effort-think'); think.style.width = mid(measureTask, effort, 'thinking') / value * 100 + '%'; bar.append(think); }
    const dots = runs.map(r => { const dot = element('span', 'effort-dot'); dot.style.left = pct(r[metric]); dot.title = m.show(r[metric]); return dot; });
    return element('div', 'effort-row', raw('strong', 'effort-level', effort), element('div', 'effort-track', bar, ...dots), raw('span', 'effort-value', m.show(value)));
  }));
  const legend = metric === 'output' ? [element('p', 'fine', element('span', 'effort-key think'), ' ', say('La parte de color teja es lo que pensó antes de contestar o entre herramienta y herramienta.', 'The rust-coloured part is what it thought before answering or between one tool and the next.'))] : [];
  const cold = metric === 'usd' && measureTask === 'explicar' ? [element('p', 'fine', say('El punto suelto de low es la primera ejecución del día: pagó por guardar en la caché las instrucciones de Claude Code (capítulo 13). Las demás ya las leyeron de la caché.', 'The stray low dot is the first run of the day: it paid to store Claude Code\'s instructions in the cache (chapter 13). The others read them from the cache.'))] : [];
  $('measure-checks').replaceChildren(...legend, ...cold, ...LEVELS.map(effort => element('div', 'effort-check', raw('strong', '', effort), ...checkText(effort).map(text => element('span', '', text)))));
}

// ---------- 04 · What it tells us ----------
function renderLessons() {
  const ratio = (t, key) => mid(t, 'max', key) / mid(t, 'low', key);
  const thinkShare = mid('explicar', 'max', 'thinking') / mid('explicar', 'max', 'output');
  const card = (tag, title, text) => element('article', '', element('span', '', tag), element('h3', '', title), element('p', '', text));
  $('lessons').replaceChildren(
    card(say('LO SENCILLO', 'THE SIMPLE TASK'), say('Explicar una factura: todos acertaron.', 'Explaining an invoice: every run got it.'),
      say(`Las 15 ejecuciones vieron el error de la luz y calcularon los 213,68 €. low tardó ${time(mid('explicar', 'low', 'seconds'))}; max, ${time(mid('explicar', 'max', 'seconds'))}: ${times(ratio('explicar', 'seconds'))} más tiempo y ${times(ratio('explicar', 'usd'))} más dinero por la misma respuesta.`,
        `All 15 runs spotted the power bill error and worked out the €213.68. low took ${time(mid('explicar', 'low', 'seconds'))}; max, ${time(mid('explicar', 'max', 'seconds'))}: ${times(ratio('explicar', 'seconds'))} the time and ${times(ratio('explicar', 'usd'))} the money for the same answer.`)),
    card(say('LA CURVA', 'THE CURVE'), say('Subir un nivel no cuesta lo mismo.', 'Each step up does not cost the same.'),
      say(`Al explicar la factura, de low a high el coste apenas cambia (de ${money(mid('explicar', 'low', 'usd'))} a ${money(mid('explicar', 'high', 'usd'))}); xhigh cuesta ${money(mid('explicar', 'xhigh', 'usd'))} y max, ${money(mid('explicar', 'max', 'usd'))}. En max, el ${fmt(thinkShare * 100)} % de lo que escribe es pensamiento que no llegas a leer.`,
        `Explaining the invoice, from low to high the cost barely changes (from ${money(mid('explicar', 'low', 'usd'))} to ${money(mid('explicar', 'high', 'usd'))}); xhigh costs ${money(mid('explicar', 'xhigh', 'usd'))} and max, ${money(mid('explicar', 'max', 'usd'))}. In max, ${fmt(thinkShare * 100)} % of what it writes is thinking you never read.`)),
    card(say('LAS TRAMPAS', 'THE TRAPS'), say('El único fallo fue low, con la trampa escondida.', 'The only miss was low, with the trap buried.'),
      say('Con una sola factura, low vio el error siempre. Entre 62 archivos, lo pasó por alto en una de las dos tablas y en el informe, donde tomó los 2.950 kWh por el pico del invierno. De medium hacia arriba, todas lo vieron.', 'With one invoice, low always spotted the error. Among 62 files, it missed it in one of the two tables and in the report, where it took the 2,950 kWh as the winter peak. From medium upwards, every run spotted it.')),
    card(say('LOS EXTRAS', 'THE EXTRAS'), say('Más esfuerzo, más extras; la misma previsión.', 'More effort, more extras; the same forecast.'),
      say(`Los cinco informes prevén entre 25.585 y 25.691 € para julio a diciembre. Lo que cambia es lo que añaden: horquillas, facturas estimadas, un botón de IVA. El de max tardó ${time(mid('informe', 'max', 'seconds'))} y costó ${money(mid('informe', 'max', 'usd'))}, ${times(ratio('informe', 'usd'))} lo de low.`,
        `All five reports forecast between €25,585 and €25,691 for July to December. What changes is what they add: ranges, estimated invoices, a VAT button. The max one took ${time(mid('informe', 'max', 'seconds'))} and cost ${money(mid('informe', 'max', 'usd'))}, ${times(ratio('informe', 'usd'))} the low one.`)));
}

// ---------- 05 · How to choose ----------
const CHOICES = [{ key: 'low', name: 'low' }, { key: 'medium', name: 'medium' }, { key: 'high', name: 'high / xhigh' }, { key: 'max', name: 'max' }];
const SITUATIONS = [
  { text: () => say('¿Cómo se dice «levadura» en inglés?', 'How do you say «levadura» in English?'), ok: ['low'], why: () => say('Una respuesta que vas a leer al momento. Cualquier esfuerzo extra es espera.', 'An answer you will read straight away. Any extra effort is just waiting.') },
  { text: () => say('Explícame esta factura de la luz que tengo delante.', 'Explain this power bill I have in front of me.'), ok: ['low', 'medium'], why: () => say('Lo medimos: los cinco niveles acertaron, y low fue el más rápido y barato.', 'We measured it: all five levels got it right, and low was the fastest and cheapest.') },
  { text: () => say('Pasa a una tabla las facturas del año para la gestoría.', 'Turn the year\'s invoices into a table for the accountant.'), ok: ['medium', 'high'], why: () => say('Muchos archivos y alguna trampa: low pasó por alto el error de la luz en una de cada dos.', 'Many files and a trap or two: low missed the power bill error in one run out of two.') },
  { text: () => say('Revisa el contrato del local antes de firmar la renovación.', 'Review the shop lease before signing the renewal.'), ok: ['high'], why: () => say('Hay letra pequeña y un error cuesta caro. Merece comprobar cláusula a cláusula.', 'There is small print and a mistake is expensive. Worth checking clause by clause.') },
  { text: () => say('Renombra las 40 fotos de los productos con su nombre y precio.', 'Rename the 40 product photos with their name and price.'), ok: ['low', 'medium'], why: () => say('Mecánico y fácil de revisar: un vistazo a la carpeta basta.', 'Mechanical and easy to review: a glance at the folder is enough.') },
  { text: () => say('Esta noche, solo: encuentra por qué la tienda online pierde pedidos a veces y arréglalo con pruebas.', 'Tonight, alone: find out why the online shop sometimes loses orders and fix it with tests.'), ok: ['high', 'max'], why: () => say('Difícil, con casos escondidos, y nadie espera la respuesta: es justo para lo que sirve el esfuerzo alto.', 'Hard, with hidden cases, and nobody is waiting for the answer: exactly what high effort is for.') },
];
const answers = new Map();
function renderChoose() {
  $('choose-list').replaceChildren(...SITUATIONS.map((s, i) => {
    const picked = answers.get(i), right = picked && s.ok.includes(picked);
    const best = s.ok.map(key => CHOICES.find(c => c.key === key).name).join(say(' o ', ' or '));
    const feedback = !picked ? [] : [element('p', 'assign-feedback', element('strong', '', right ? say('Bien elegido.', 'Good choice.') : say(`Mejor ${best}.`, `Better: ${best}.`)), ' ', s.why())];
    return element('div', 'assign-row' + (picked ? right ? ' right' : ' wrong' : ''), element('p', 'assign-task', s.text()),
      element('div', 'assign-buttons', ...CHOICES.map(c => { return chip(c.name, picked === c.key, () => { answers.set(i, c.key); renderChoose(); }, true); })), ...feedback);
  }));
  const done = answers.size, right = [...answers].filter(([i, key]) => SITUATIONS[i].ok.includes(key)).length;
  $('choose-score').replaceChildren(done < SITUATIONS.length
    ? element('span', '', say(`Llevas ${done} de ${SITUATIONS.length}.`, `${done} of ${SITUATIONS.length} done.`))
    : element('span', '', element('strong', '', say(`${right} de ${SITUATIONS.length}.`, `${right} out of ${SITUATIONS.length}.`)), ' ', say('Empieza con el de serie; bájalo si vas a revisarlo tú y súbelo cuando haya trampas y nadie más vaya a comprobarlo.', 'Start with the default; lower it if you will review it yourself and raise it when there are traps and nobody else will check.')));
}

function renderAll() { renderLevels(); renderTasks(); renderMeasure(); renderLessons(); renderChoose(); }
document.addEventListener('languagechange', renderAll);
renderAll();
