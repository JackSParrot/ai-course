import { $, element, Stepper } from '../../tokens/src/ui.js';
import { getLanguage } from '../../i18n/i18n.js';

// Every example on this page is an illustration: an invented shop, files, changes and costs.
const say = (es, en) => getLanguage() === 'en' ? en : es;
// Files stay as written; the translator leaves them alone.
const raw = (tag, className, ...children) => { const node = element(tag, className, ...children); node.dataset.i18nIgnore = ''; return node; };
const bubble = (who, text, kind = '') => element('div', 'chat-line ' + (who === 'you' ? 'you' : 'ai') + (kind ? ' ' + kind : ''), element('span', 'chat-who', who === 'you' ? say('Tú', 'You') : say('Agente', 'Agent')), element('p', '', text));
const flow = items => element('div', 'block-flow', ...items.map(text => element('span', 'block-step', text)));
const pick = (button, pressed) => { button.type = 'button'; button.setAttribute('aria-pressed', String(pressed)); return button; };

// ---------- 01 · The brief ----------
// Each missing piece of the brief causes one typical mistake.
const PIECES = [
  { key: 'where', button: () => say('Dónde está', 'Where it is'),
    text: () => say('Los precios están en tienda/precios.csv.', 'The prices are in shop/prices.csv.'),
    ok: () => say('Cambia el archivo bueno, tienda/precios.csv.', 'Changes the right file, shop/prices.csv.'),
    bad: () => say('Encuentra antes precios-2023.csv y cambia el archivo viejo.', 'Finds prices-2023.csv first and changes the old file.') },
  { key: 'done', button: () => say('Cuándo está hecho', 'When it is done'),
    text: () => say('Está hecho cuando la web enseña los 40 precios nuevos.', 'It is done when the website shows the 40 new prices.'),
    ok: () => say('Actualiza también la web, no solo la tabla.', 'Updates the website too, not just the table.'),
    bad: () => say('Cambia la tabla y dice «hecho», pero la web sigue con los precios viejos.', 'Changes the table and says «done», but the website still shows the old prices.') },
  { key: 'keep', button: () => say('Qué no tocar', 'What not to touch'),
    text: () => say('Las 6 ofertas se quedan igual, y el pan de centeno pasa a 3,20 €.', 'The 6 offers stay the same, and the rye loaf goes to €3.20.'),
    ok: () => say('Deja las ofertas como estaban y pone el centeno a 3,20 €.', 'Leaves the offers as they were and sets the rye loaf to €3.20.'),
    bad: () => say('Sube también las 6 ofertas y el centeno un 5 %: no podía saber que eran distintos.', 'Also raises the 6 offers and the rye loaf by 5%: it could not know they were different.') },
  { key: 'check', button: () => say('Cómo comprobarlo', 'How to check it'),
    text: () => say('Antes de acabar, comprueba que ninguna oferta ha cambiado y que ningún precio sube más de un 10 %.', 'Before finishing, check that no offer has changed and that no price goes up by more than 10%.'),
    ok: () => say('Lo comprueba solo y encuentra un precio con la coma mal puesta antes de decirte nada.', 'Checks it itself and finds a price with the decimal point in the wrong place before telling you anything.'),
    bad: () => say('No tiene con qué comprobarlo: un precio con la coma mal puesta se queda así, y revisar las 40 filas te toca a ti.', 'It has nothing to check against: a price with the decimal point in the wrong place stays that way, and checking the 40 rows is up to you.') },
];
const brief = new Set();
function renderBrief() {
  $('brief-pieces').replaceChildren(...PIECES.map(piece => {
    const button = pick(element('button', 'chip', (brief.has(piece.key) ? '✓ ' : '+ ') + piece.button()), brief.has(piece.key));
    button.addEventListener('click', () => { brief.has(piece.key) ? brief.delete(piece.key) : brief.add(piece.key); renderBrief(); });
    return button;
  }));
  const lines = [say('Sube un 5 % los precios de la tienda de Horno Alto.', 'Raise the prices in the Horno Alto shop by 5%.'), ...PIECES.filter(p => brief.has(p.key)).map(p => p.text())];
  $('brief-text').replaceChildren(element('div', 'mission-card', element('p', '', lines.join(' '))));
  const rows = PIECES.map(p => element('div', 'brief-row ' + (brief.has(p.key) ? 'right' : 'wrong'), element('span', 'brief-mark', brief.has(p.key) ? '✓' : '✗'), element('p', '', brief.has(p.key) ? p.ok() : p.bad())));
  const all = brief.size === PIECES.length, none = brief.size === 0;
  const verdict = all ? bubble('ai', say('Hecho: 40 precios nuevos en la web, las 6 ofertas sin tocar y el centeno a 3,20 €. He comprobado las ofertas y los saltos: un bizcocho salía a 0,63 € y lo he corregido a 6,30 €.', 'Done: 40 new prices on the website, the 6 offers untouched and the rye loaf at €3.20. I checked the offers and the jumps: a sponge cake came out at €0.63 and I fixed it to €6.30.'), 'right')
    : bubble('ai', none ? say('¡Hecho! He subido los precios un 5 %.', 'Done! I raised the prices by 5%.') : say('¡Hecho! Precios actualizados.', 'Done! Prices updated.'), 'wrong');
  $('brief-result').replaceChildren(element('div', 'stack', verdict, ...rows));
}

// ---------- 02 · Plan first ----------
const planLine = (n, text, kind = '') => element('div', 'plan-line' + (kind ? ' ' + kind : ''), raw('span', 'plan-n', String(n)), element('p', '', text));
function planSteps() {
  const plan = fixed => [
    planLine(1, say('Leer tienda/precios.csv y la página de ofertas.', 'Read shop/prices.csv and the offers page.')),
    planLine(2, say('Subir un 5 % los 34 productos que no están en oferta, redondeando a céntimos.', 'Raise the 34 products not on offer by 5%, rounding to the cent.'), fixed ? '' : 'suspect'),
    fixed ? planLine(3, say('Poner el pan de centeno a 3,20 €, sin el 5 %.', 'Set the rye loaf to €3.20, without the 5%.'), 'fixed') : null,
    planLine(fixed ? 4 : 3, say('Publicar los precios en la web y comprobar que ninguna oferta ha cambiado.', 'Publish the prices on the website and check that no offer has changed.')),
  ].filter(Boolean);
  const bars = [[say('En el encargo', 'In the brief'), 1], [say('En el plan', 'In the plan'), 1], [say('A mitad del trabajo', 'Half-way through'), 8], [say('Al final', 'At the end'), 20], [say('Publicado', 'Published'), 40]];
  return [
    { stage: 1, title: say('Pide un plan antes de que toque nada', 'Ask for a plan before it touches anything'), caption: say('En modo plan el agente puede leer archivos, pero no cambiarlos. Lee lo que necesita y te cuenta qué va a hacer.', 'In plan mode the agent can read files but not change them. It reads what it needs and tells you what it is going to do.'),
      render: () => element('div', 'stack', bubble('you', say('Antes de cambiar nada, cuéntame qué vas a hacer para subir los precios de enero.', 'Before changing anything, tell me what you will do to raise the January prices.')), flow([say('Lee precios.csv', 'Reads prices.csv'), say('Lee la página de ofertas', 'Reads the offers page'), say('Escribe un plan · sin tocar nada', 'Writes a plan · without touching anything')])) },
    { stage: 2, title: say('Léelo: ahí se ven los malentendidos', 'Read it: that is where misunderstandings show'), caption: say('Un plan se lee en un minuto. El paso 2 sube «todo lo que no está en oferta»… también el pan de centeno, que tenía un precio fijo. Lo dijiste, pero se ha perdido.', 'A plan takes a minute to read. Step 2 raises «everything not on offer»… the rye loaf too, which had a fixed price. You said it, but it got lost.'),
      render: () => element('div', 'plan-card', element('span', 'eyebrow', say('EL PLAN', 'THE PLAN')), ...plan(false)) },
    { stage: 3, title: say('Lo corriges con una frase', 'You fix it with one sentence'), caption: say('Una línea tuya y el plan cambia. Todavía no se ha tocado ni un archivo: corregir no ha costado nada.', 'One line from you and the plan changes. Not a single file has been touched yet: fixing it cost nothing.'),
      render: () => element('div', 'stack', bubble('you', say('El pan de centeno va a 3,20 € fijo, sin el 5 %.', 'The rye loaf goes to a fixed €3.20, without the 5%.')), element('div', 'plan-card', element('span', 'eyebrow', say('EL PLAN, CORREGIDO', 'THE PLAN, FIXED')), ...plan(true))) },
    { stage: 4, title: say('Cuanto más tarde, más cuesta', 'The later, the dearer'), caption: say('Un malentendido cazado en el plan se arregla con una frase. A mitad hay que deshacer; al final, revisarlo todo; publicado, lo han visto los clientes.', 'A misunderstanding caught in the plan is fixed with one sentence. Half-way through you have to undo; at the end, check everything; once published, customers have seen it.'),
      render: () => element('div', 'cost-bars', ...bars.map(([label, value]) => { const bar = element('span', value > 1 ? 'bad' : 'good'); bar.style.width = (value / 40 * 100) + '%'; return element('div', 'compare-row', element('span', '', label), element('div', 'compare-track', bar), raw('small', '', '×' + value)); })) },
  ];
}
const planStepper = new Stepper($('plan-explainer'), planSteps);

// ---------- 03 · Check, don't believe ----------
const CHANGES = [
  { what: () => say('Barra de pan', 'Baguette'), from: '1,00', to: '1,05', wrong: false },
  { what: () => say('Pan de centeno', 'Rye loaf'), from: '2,90', to: '3,20', wrong: false, why: () => say('Bien: es el precio fijo que pediste.', 'Right: it is the fixed price you asked for.') },
  { what: () => say('Tarta de manzana (oferta)', 'Apple tart (offer)'), from: '12,00', to: '12,60', wrong: true, why: () => say('Es una oferta: debía quedarse igual.', 'It is an offer: it should have stayed the same.') },
  { what: () => say('Cruasán', 'Croissant'), from: '1,20', to: '1,26', wrong: false },
  { what: () => say('Bizcocho de limón', 'Lemon sponge cake'), from: '6,00', to: '0,63', wrong: true, why: () => say('La coma, mal puesta: debía ser 6,30.', 'The decimal point is in the wrong place: it should be 6.30.') },
  { what: () => say('Magdalenas (6)', 'Muffins (6)'), from: '3,00', to: '3,15', wrong: false },
  { what: () => say('precios-2023.csv', 'prices-2023.csv'), from: say('existe', 'exists'), to: say('borrado', 'deleted'), wrong: true, why: () => say('Nadie pidió borrarlo. Si no estaba guardado en ningún sitio, se ha perdido.', 'Nobody asked for it to be deleted. If it was not saved anywhere, it is gone.') },
  { what: () => say('Empanada de atún', 'Tuna pie'), from: '8,50', to: '8,93', wrong: false, why: () => say('Bien: 8,925 redondeado.', 'Right: 8.925 rounded.') },
];
const marked = new Set();
let solved = false;
const money = value => /\d/.test(value) ? say(value + ' €', '€' + value.replace(',', '.')) : value;
function renderReview() {
  $('review-list').replaceChildren(
    element('div', 'review-summary', bubble('ai', say('Hecho: los precios han subido un 5 % y las ofertas no se han tocado.', 'Done: prices are up 5% and the offers have not been touched.'))),
    ...CHANGES.map((change, i) => {
      const state = solved ? (change.wrong ? (marked.has(i) ? ' found' : ' missed') : (marked.has(i) ? ' false-alarm' : ' fine')) : '';
      const button = pick(element('button', 'review-row' + state, element('span', 'review-what', change.what()), raw('span', 'review-diff', `${money(change.from)} → ${money(change.to)}`), ...(solved && change.why ? [element('small', 'review-why', change.why())] : [])), marked.has(i));
      button.disabled = solved;
      button.addEventListener('click', () => { marked.has(i) ? marked.delete(i) : marked.add(i); renderReview(); });
      return button;
    }));
  const wrong = CHANGES.filter(c => c.wrong).length, found = CHANGES.filter((c, i) => c.wrong && marked.has(i)).length, alarms = CHANGES.filter((c, i) => !c.wrong && marked.has(i)).length;
  $('review-score').replaceChildren(solved
    ? element('span', '', element('strong', '', say(`Has encontrado ${found} de ${wrong}.`, `You found ${found} of ${wrong}.`)), ' ', alarms ? say(`Y has marcado ${alarms} que estaban bien. `, `And you marked ${alarms} that were fine. `) : '', say('El resumen decía «hecho» y había tres fallos: una oferta subida, un precio con la coma mal puesta y un archivo borrado que nadie pidió.', 'The summary said «done» and there were three faults: an offer raised, a price with the decimal point in the wrong place and a deleted file nobody asked for.'))
    : element('span', '', say(`Has marcado ${marked.size}. Cuando lo tengas, mira la solución.`, `You have marked ${marked.size}. When you are ready, see the solution.`)));
}
$('review-check').addEventListener('click', () => { solved = true; renderReview(); });
$('review-reset').addEventListener('click', () => { solved = false; marked.clear(); renderReview(); });

// ---------- 04 · Being able to undo ----------
const file = (name, state = '') => element('div', 'undo-file' + (state ? ' ' + state : ''), raw('code', '', name), ...(state ? [element('small', '', state === 'changed' ? say('cambiado', 'changed') : state === 'broken' ? say('roto', 'broken') : state === 'restored' ? say('como estaba', 'as it was') : '')] : []));
const files = state => element('div', 'undo-files', ...['tienda/precios.csv', 'tienda/web/precios.html', 'tienda/web/ofertas.html'].map((name, i) => file(say(name, name.replace('tienda', 'shop').replace('precios', 'prices').replace('ofertas', 'offers')), state[i])));
const point = text => element('div', 'undo-point', element('span', 'eyebrow', say('PUNTO DE VUELTA', 'RESTORE POINT')), element('p', '', text));
function undoSteps() {
  return [
    { stage: 1, title: say('Antes de cada encargo, un punto de vuelta', 'Before each request, a restore point'), caption: say('El arnés guarda cómo estaban los archivos antes de que el agente empiece. Tú no tienes que hacer nada.', 'The harness saves how the files were before the agent starts. You do not have to do anything.'),
      render: () => element('div', 'stack', point(say('Lunes, 10:02 · antes de «sube los precios»', 'Monday, 10:02 · before «raise the prices»')), files(['', '', ''])) },
    { stage: 2, title: say('El agente trabaja', 'The agent works'), caption: say('Cambia la tabla y las dos páginas. Mientras tanto, el punto de vuelta sigue ahí.', 'It changes the table and both pages. Meanwhile, the restore point is still there.'),
      render: () => element('div', 'stack', point(say('Lunes, 10:02', 'Monday, 10:02')), files(['changed', 'changed', 'changed'])) },
    { stage: 3, title: say('Sale mal', 'It goes wrong'), caption: say('La página de ofertas se ha roto. Podrías pedirle que lo arregle, pero quizá sea más rápido volver atrás y pedirlo mejor.', 'The offers page is broken. You could ask it to fix it, but it may be quicker to go back and ask better.'),
      render: () => element('div', 'stack', point(say('Lunes, 10:02', 'Monday, 10:02')), files(['changed', 'changed', 'broken']), bubble('ai', say('¡Hecho! Precios actualizados.', 'Done! Prices updated.'), 'wrong')) },
    { stage: 4, title: say('Vuelves al punto', 'You go back to the point'), caption: say('Un paso y los archivos están como el lunes a las 10:02. Ahora puedes repetir el encargo con lo que has aprendido. Por eso puedes dejarle probar cosas atrevidas.', 'One step and the files are as they were on Monday at 10:02. Now you can repeat the request with what you have learned. That is why you can let it try bold things.'),
      render: () => element('div', 'stack', point(say('Lunes, 10:02 · restaurado', 'Monday, 10:02 · restored')), files(['restored', 'restored', 'restored'])) },
    { stage: 5, title: say('Lo que no vuelve', 'What does not come back'), caption: say('El punto de vuelta guarda tus archivos, no el mundo. Un correo enviado, una web publicada o un pago no vuelven. Y lo que cambió un comando por su cuenta puede no estar guardado: para eso, git.', 'The restore point keeps your files, not the world. A sent email, a published website or a payment do not come back. And what a command changed on its own may not be saved: that is what git is for.'),
      render: () => element('div', 'undo-gone', ...[say('📧 Correo a 300 clientes', '📧 Email to 300 customers'), say('🌐 Web publicada', '🌐 Website published'), say('💳 Pago cobrado', '💳 Payment charged'), say('⌨️ Archivo borrado con un comando', '⌨️ File deleted by a command')].map(text => element('span', 'undo-gone-item', text))) },
  ];
}
const undoStepper = new Stepper($('undo-explainer'), undoSteps);

// A list of choices with feedback, shared by «can it be undone?» and «carry on or start again?».
function quiz(list, score, items, options, answers, done) {
  $(list).replaceChildren(...items.map((item, i) => {
    const picked = answers.get(i), right = picked === item.ok;
    const buttons = options.map(option => {
      const button = pick(element('button', 'chip', option.name()), picked === option.key);
      button.addEventListener('click', () => { answers.set(i, option.key); quiz(list, score, items, options, answers, done); });
      return button;
    });
    const feedback = picked ? [element('p', 'assign-feedback', element('strong', '', right ? say('Bien.', 'Right.') : say('No del todo.', 'Not quite.')), ' ', item.why())] : [];
    return element('div', 'assign-row' + (picked ? right ? ' right' : ' wrong' : ''), element('p', 'assign-task', item.text()), element('div', 'assign-buttons', ...buttons), ...feedback);
  }));
  const right = [...answers].filter(([i, key]) => items[i].ok === key).length;
  $(score).replaceChildren(answers.size < items.length
    ? element('span', '', say(`Llevas ${answers.size} de ${items.length}.`, `${answers.size} of ${items.length} done.`))
    : element('span', '', element('strong', '', say(`${right} de ${items.length}.`, `${right} out of ${items.length}.`)), ' ', done()));
}
const UNDO_OPTIONS = [{ key: 'undo', name: () => say('Se deshace', 'Can be undone') }, { key: 'final', name: () => say('No tiene vuelta atrás', 'No way back') }];
const UNDO = [
  { text: () => say('Cambiar los precios de la tabla', 'Change the prices in the table'), ok: 'undo', why: () => say('Es un archivo: vuelve con el punto de vuelta o con git.', 'It is a file: it comes back with the restore point or with git.') },
  { text: () => say('Cambiar los colores de la web en tu ordenador', 'Change the website colours on your computer'), ok: 'undo', why: () => say('Mientras no se publique, son solo archivos tuyos.', 'Until it is published, they are just your files.') },
  { text: () => say('Enviar el boletín a los 300 clientes', 'Send the newsletter to the 300 customers'), ok: 'final', why: () => say('Un correo enviado no vuelve. Que te lo enseñe y pregunte antes.', 'A sent email does not come back. Have it show you and ask first.') },
  { text: () => say('Publicar la web nueva en la tienda de verdad', 'Publish the new website on the real shop'), ok: 'final', why: () => say('Se puede volver a publicar la vieja, pero los clientes ya la han visto.', 'You can publish the old one again, but customers have already seen it.') },
  { text: () => say('Renombrar las 40 fotos de los productos', 'Rename the 40 product photos'), ok: 'undo', why: () => say('Si las fotos están guardadas en git, se deshace en un paso.', 'If the photos are saved in git, it is undone in one step.') },
  { text: () => say('Borrar una carpeta que no estaba guardada en ningún sitio', 'Delete a folder that was not saved anywhere'), ok: 'final', why: () => say('Sin copia no hay vuelta atrás. Guarda en git antes de dejarle trabajar.', 'Without a copy there is no way back. Save it in git before letting it work.') },
  { text: () => say('Cobrar un pedido de prueba con una tarjeta real', 'Charge a test order to a real card'), ok: 'final', why: () => say('El dinero se mueve de verdad. Para probar, una tarjeta de prueba.', 'The money really moves. To test, use a test card.') },
];
const undoAnswers = new Map();
const renderUndo = () => quiz('undo-list', 'undo-score', UNDO, UNDO_OPTIONS, undoAnswers, () => say('Lo que se deshace, déjale hacerlo solo; para lo demás, que pregunte. Cuanto más hay en git, más puedes delegar.', 'What can be undone, let it do alone; for the rest, have it ask. The more is in git, the more you can delegate.'));

// ---------- 05 · A clean desk ----------
const DESK_OPTIONS = [{ key: 'go', name: () => say('Seguir', 'Carry on') }, { key: 'new', name: () => say('Empezar de nuevo', 'Start again') }];
const DESK = [
  { text: () => say('Los precios están listos. Ahora quieres un texto para las redes sociales de la panadería.', 'The prices are ready. Now you want a post for the bakery\'s social media.'), ok: 'new', why: () => say('Es otra tarea. Todo lo de los precios sobra en la mesa y se paga en cada vuelta.', 'It is another task. Everything about prices is clutter on the desk and is paid for on every round.') },
  { text: () => say('Va por la mitad de los envíos y todo va bien.', 'It is half-way through delivery settings and all is going well.'), ok: 'go', why: () => say('Lo que tiene en la mesa es justo lo que necesita.', 'What is on the desk is exactly what it needs.') },
  { text: () => say('Le has corregido lo mismo dos veces y sigue mal.', 'You have corrected the same thing twice and it is still wrong.'), ok: 'new', why: () => say('Cada intento fallido sigue en la mesa y lo vuelve a leer. Mejor un encargo nuevo que incluya lo que has aprendido.', 'Every failed attempt stays on the desk and gets read again. Better a new request that includes what you have learned.') },
  { text: () => say('Quieres que alguien revise lo que acaba de hacer.', 'You want someone to review what it has just done.'), ok: 'new', why: () => say('Unos ojos que no han visto cómo se hizo: un revisor con la mesa limpia (capítulo 17).', 'Eyes that did not see how it was done: a reviewer with a clean desk (chapter 17).') },
  { text: () => say('Le acabas de pedir un cambio y quieres ajustar un detalle de ese mismo cambio.', 'You have just asked for a change and want to adjust a detail of that same change.'), ok: 'go', why: () => say('Necesita el contexto de lo que acaba de hacer: empezar de cero obligaría a explicarlo todo otra vez.', 'It needs the context of what it has just done: starting from scratch would mean explaining it all again.') },
];
const deskAnswers = new Map();
const renderDesk = () => quiz('desk-list', 'desk-score', DESK, DESK_OPTIONS, deskAnswers, () => say('Una tarea, una conversación. Empezar de nuevo no pierde nada si lo importante está apuntado (capítulo 16).', 'One task, one conversation. Starting again loses nothing if what matters is written down (chapter 16).'));

function renderAll() { renderBrief(); renderReview(); renderUndo(); renderDesk(); }
// Everything built here carries its own English, so it is rebuilt on a language change.
document.addEventListener('languagechange', () => { planStepper.refresh(); undoStepper.refresh(); renderAll(); });
renderAll();
