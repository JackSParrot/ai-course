import { $, element, Stepper } from '../../tokens/src/ui.js';
import { getLanguage } from '../../i18n/i18n.js';

// Every example on this page is an illustration: an invented shop, files, rules, emails and messages.
const say = (es, en) => getLanguage() === 'en' ? en : es;
// Files stay as written; the translator leaves them alone.
const raw = (tag, className, ...children) => { const node = element(tag, className, ...children); node.dataset.i18nIgnore = ''; return node; };
const bubble = (who, text, kind = '') => element('div', 'chat-line ' + (who === 'you' ? 'you' : 'ai') + (kind ? ' ' + kind : ''), element('span', 'chat-who', who === 'you' ? say('Tú', 'You') : who === 'harness' ? say('Arnés', 'Harness') : say('Agente', 'Agent')), element('p', '', text));
const pick = (button, pressed) => { button.type = 'button'; button.setAttribute('aria-pressed', String(pressed)); return button; };
const tag = (text, kind = '') => element('span', 'ctl-tag' + (kind ? ' ' + kind : ''), text);
const fileCard = (name, body) => element('div', 'note-file', raw('code', '', name), raw('pre', '', body));

// ---------- 01 · Suggest or enforce ----------
const OFFERS = () => say('tienda/ofertas.csv', 'shop/offers.csv');
function noteSteps() {
  const note = () => fileCard('CLAUDE.md', say('# Tienda de Horno Alto\n- Nunca cambies los precios de tienda/ofertas.csv:\n  están anunciados en el periódico.', '# Horno Alto shop\n- Never change the prices in shop/offers.csv:\n  they are advertised in the newspaper.'));
  const rule = () => fileCard('.claude/settings.json', say('"deny": ["Edit(./tienda/ofertas.csv)"]', '"deny": ["Edit(./shop/offers.csv)"]'));
  return [
    { stage: 1, title: say('La regla, como una nota', 'The rule, as a note'), caption: say('La regla va en CLAUDE.md, que el arnés pone en la mesa al empezar cada conversación (capítulo 14). El modelo la lee como todo lo demás.', 'The rule goes in CLAUDE.md, which the harness puts on the desk at the start of every conversation (chapter 14). The model reads it like everything else.'),
      render: () => element('div', 'stack', note(), tag(say('la lee el modelo', 'read by the model'))) },
    { stage: 2, title: say('Casi siempre la cumple', 'It almost always follows it'), caption: say('Le pides subir los precios de enero y deja las ofertas en paz. Los modelos actuales siguen muy bien una instrucción clara. Casi siempre.', 'You ask it to raise the January prices and it leaves the offers alone. Current models follow a clear instruction very well. Almost always.'),
      render: () => element('div', 'stack', bubble('you', say('Sube un 5 % los precios de enero.', 'Raise the January prices by 5%.')), bubble('ai', say('Hecho. He dejado las ofertas como estaban, como pide CLAUDE.md.', 'Done. I left the offers as they were, as CLAUDE.md asks.'), 'right')) },
    { stage: 3, title: say('Pero un mal día…', 'But one bad day…'), caption: say('Una tarea larga con la mesa llena (capítulo 16), una orden escondida en algo que lee (capítulo 12), o simplemente decide que esta vez no aplica. La nota la lee el modelo, y el modelo decide.', 'A long task with a full desk (chapter 16), an order hidden in something it reads (chapter 12), or it simply decides it does not apply this time. The note is read by the model, and the model decides.'),
      render: () => element('div', 'stack', bubble('you', say('Unifica el formato de todos los archivos de precios.', 'Make all the price files use the same format.')), bubble('ai', say(`He actualizado 4 archivos, también ${OFFERS()}: de paso he redondeado sus precios.`, `I updated 4 files, ${OFFERS()} too: I rounded its prices while I was at it.`), 'wrong')) },
    { stage: 4, title: say('La misma regla, como una llave', 'The same rule, as a lock'), caption: say('Ahora la regla está en los ajustes del arnés. Cuando el agente intenta editar el archivo, el programa lo bloquea antes de que pase y le dice por qué. No importa lo que decida el modelo.', 'Now the rule is in the harness settings. When the agent tries to edit the file, the program blocks it before it happens and tells it why. It does not matter what the model decides.'),
      render: () => element('div', 'stack', rule(), bubble('ai', say(`Voy a editar ${OFFERS()}.`, `I am going to edit ${OFFERS()}.`)), bubble('harness', say('Bloqueado: una regla prohíbe editar este archivo.', 'Blocked: a rule forbids editing this file.'), 'right'), bubble('ai', say('Entendido: dejo las ofertas y sigo con el resto.', 'Understood: I leave the offers and carry on with the rest.'))) },
    { stage: 5, title: say('Cada una, a lo suyo', 'Each to its own job'), caption: say('No se trata de convertirlo todo en reglas. La nota es flexible: el modelo entiende el caso y decide bien casi siempre. La llave es rígida: sirve para lo poco que no puede fallar nunca.', 'This is not about turning everything into rules. The note is flexible: the model understands the case and decides well almost always. The lock is rigid: it is for the few things that must never fail.'),
      render: () => element('div', 'two-cols',
        element('div', 'ctl-col', element('span', 'eyebrow', say('LA NOTA', 'THE NOTE')), element('strong', '', say('El encargo, CLAUDE.md, las skills', 'The request, CLAUDE.md, skills')), element('p', '', say('Las lee el modelo y decide. Flexibles, y casi siempre se cumplen.', 'Read by the model, which decides. Flexible, and almost always followed.')), element('p', 'fine', say('Para el tono, el estilo, cómo se hace en casa.', 'For tone, style, how things are done here.'))),
        element('div', 'ctl-col lock', element('span', 'eyebrow', say('LA LLAVE', 'THE LOCK')), element('strong', '', say('Permisos y hooks', 'Permissions and hooks')), element('p', '', say('Las cumple el arnés, siempre. Rígidas, y no dependen del modelo.', 'Enforced by the harness, always. Rigid, and independent of the model.')), element('p', 'fine', say('Para lo que no puede fallar nunca.', 'For what must never fail.')))) },
  ];
}
const noteStepper = new Stepper($('note-explainer'), noteSteps);

// A list of choices with feedback, shared by «note or lock?».
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
const RULE_OPTIONS = [{ key: 'note', name: () => say('Nota', 'Note') }, { key: 'lock', name: () => say('Llave', 'Lock') }];
const RULES = [
  { text: () => say('Escribe a los clientes con un tono cercano', 'Write to customers in a friendly tone'), ok: 'note', why: () => say('Es estilo: si un día suena algo más serio, no pasa nada. Y el modelo entiende cuándo cambiar el tono.', 'It is style: if one day it sounds a bit more formal, nothing happens. And the model understands when to change the tone.') },
  { text: () => say('Nunca leas el archivo con la contraseña de la pasarela de pago', 'Never read the file with the payment gateway password'), ok: 'lock', why: () => say('Una sola vez ya es demasiado: la contraseña acabaría en la mesa y viajaría al proveedor. Regla de «prohibido».', 'Once is already too many: the password would land on the desk and travel to the provider. A «forbidden» rule.') },
  { text: () => say('Usa el formato de fecha de la agencia: 29 oct. 2026', 'Use the agency date format: 29 Oct 2026'), ok: 'note', why: () => say('Si falla, se corrige en un momento. Una nota, o una skill si hay muchas reglas de estilo (capítulo 15).', 'If it slips, it is fixed in a moment. A note, or a skill if there are many style rules (chapter 15).') },
  { text: () => say('No digas «hecho» hasta que pasen las pruebas', 'Do not say «done» until the tests pass'), ok: 'lock', why: () => say('Es justo lo que un modelo a veces se salta. Un hook al terminar ejecuta las pruebas siempre.', 'It is exactly what a model sometimes skips. A hook at the end always runs the tests.') },
  { text: () => say('Prefiere textos cortos en la web', 'Prefer short texts on the website'), ok: 'note', why: () => say('Es una preferencia con excepciones: el modelo sabrá cuándo hace falta un texto largo.', 'It is a preference with exceptions: the model will know when a long text is needed.') },
  { text: () => say('No envíes ningún correo sin preguntarme', 'Do not send any email without asking me'), ok: 'lock', why: () => say('Un correo enviado no vuelve (capítulo 19). Regla de «preguntar»: te lo enseña antes.', 'A sent email does not come back (chapter 19). An «ask» rule: it shows you first.') },
];
const ruleAnswers = new Map();
const renderRules = () => quiz('rule-list', 'rule-score', RULES, RULE_OPTIONS, ruleAnswers, () => say('Lo que es de gusto o tiene excepciones, en la nota. Lo que no puede fallar nunca, bajo llave.', 'What is a matter of taste or has exceptions goes in the note. What must never fail goes under lock.'));

// ---------- 02 · Permissions and modes ----------
// ok: runs alone · ask: asks you · check: another model reviews it · no: blocked.
const MODES = [
  { key: 'manual', name: () => say('Manual', 'Manual'), note: () => say('Lo pregunta todo menos leer. El más seguro y el más pesado: buena forma de empezar.', 'It asks about everything except reading. The safest and the most tiring: a good way to start.') },
  { key: 'edits', name: () => say('Aceptar ediciones', 'Accept edits'), note: () => say('Edita archivos sin preguntar; los comandos, todavía te los pregunta. Para cuando vas revisando los cambios.', 'It edits files without asking; commands it still asks about. For when you review the changes as you go.') },
  { key: 'plan', name: () => say('Plan', 'Plan'), note: () => say('Lee y propone, pero no cambia nada hasta que apruebas el plan (capítulo 19).', 'It reads and proposes, but changes nothing until you approve the plan (chapter 19).') },
  { key: 'auto', name: () => say('Automático', 'Auto'), note: () => say('Lo hace todo solo, y otro modelo revisa lo arriesgado: bloquea lo destructivo y enviar datos fuera. Es un juicio: puede equivocarse.', 'It does everything alone, and another model reviews the risky actions: it blocks destructive ones and sending data out. It is a judgment: it can be wrong.') },
  { key: 'bypass', name: () => say('Sin permisos', 'Bypass'), note: () => say('No pregunta nada. Solo en una máquina aislada y desechable: aquí, cualquier error es de verdad. Ni así se salta lo prohibido.', 'It asks nothing. Only on an isolated, throwaway machine: here, any mistake is real. Even so, it does not skip what is forbidden.') },
];
const ACTIONS = [
  { text: () => say('Leer el catálogo', 'Read the catalogue'), modes: { manual: 'ok', edits: 'ok', plan: 'ok', auto: 'ok', bypass: 'ok' } },
  { text: () => say('Editar las páginas de la web', 'Edit the website pages'), modes: { manual: 'ask', edits: 'ok', plan: 'no', auto: 'ok', bypass: 'ok' } },
  { text: () => say('Ejecutar las pruebas', 'Run the tests'), modes: { manual: 'ask', edits: 'ask', plan: 'ask', auto: 'ok', bypass: 'ok' } },
  { text: () => say('Borrar la carpeta de fotos antiguas', 'Delete the old photos folder'), modes: { manual: 'ask', edits: 'ask', plan: 'no', auto: 'check', bypass: 'ok' } },
  { text: () => say('Enviar la lista de clientes a una web externa', 'Send the customer list to an outside website'), modes: { manual: 'ask', edits: 'ask', plan: 'no', auto: 'check', bypass: 'ok' } },
  { text: () => say('Leer la contraseña de pagos (regla: prohibido)', 'Read the payment password (rule: forbidden)'), modes: { manual: 'deny', edits: 'deny', plan: 'deny', auto: 'deny', bypass: 'deny' } },
];
const STATE = {
  ok: () => ['✓', say('Lo hace solo', 'Does it alone')],
  ask: () => ['?', say('Te pregunta', 'Asks you')],
  no: () => ['–', say('Espera al plan', 'Waits for the plan')],
  check: () => ['⛔', say('Lo bloquea el revisor', 'Blocked by the reviewer')],
  deny: () => ['✗', say('Prohibido', 'Forbidden')],
};
let mode = 'manual';
function renderModes() {
  $('mode-picker').replaceChildren(...MODES.map(m => {
    const button = pick(element('button', 'chip', m.name()), m.key === mode);
    button.addEventListener('click', () => { mode = m.key; renderModes(); });
    return button;
  }));
  const m = MODES.find(x => x.key === mode);
  $('mode-note').className = 'lesson-note' + (mode === 'bypass' ? ' alert' : '');
  $('mode-note').replaceChildren(element('strong', '', m.name() + '.'), ' ', m.note());
  $('mode-table').replaceChildren(...ACTIONS.map(action => {
    const state = action.modes[mode], [mark, label] = STATE[state]();
    return element('div', 'mode-row ' + state, element('span', '', action.text()), element('span', 'mode-state', element('b', '', mark), ' ', label));
  }));
}

// ---------- 03 · Hooks ----------
const moment = (name, when, active) => element('div', 'hook-moment' + (active ? ' active' : ''), element('strong', '', name), element('small', '', when));
const moments = active => element('div', 'hook-moments', moment(say('Antes de una herramienta', 'Before a tool'), say('puede decir que no', 'can say no'), active === 1), element('span', 'hook-arrow', '→'), moment(say('Después de una herramienta', 'After a tool'), say('puede arreglar o avisar', 'can fix or warn'), active === 2), element('span', 'hook-arrow', '→'), moment(say('Al terminar', 'When finishing'), say('puede decir «todavía no»', 'can say «not yet»'), active === 3));
function hookSteps() {
  return [
    { stage: 1, title: say('Tres momentos del bucle', 'Three moments in the loop'), caption: say('El bucle del agente (capítulo 12) tiene momentos fijos. En cada uno, el arnés puede ejecutar un programa tuyo. El programa ve qué está a punto de pasar, o qué acaba de pasar.', 'The agent loop (chapter 12) has fixed moments. At each one, the harness can run a program of yours. The program sees what is about to happen, or what has just happened.'),
      render: () => moments(0) },
    { stage: 2, title: say('Antes: «no»', 'Before: «no»'), caption: say('El agente va a ejecutar un comando que borra una carpeta entera. Un hook antes de cada comando lo revisa, dice que no y le explica por qué. El agente lee el motivo y busca otra forma.', 'The agent is about to run a command that deletes a whole folder. A hook before every command checks it, says no and explains why. The agent reads the reason and looks for another way.'),
      render: () => element('div', 'stack', moments(1), bubble('ai', say('Ejecuto: borrar fotos/ entera.', 'Running: delete all of photos/.')), bubble('harness', say('Hook: no se borran carpetas enteras. Mueve a fotos/viejas/ lo que sobre.', 'Hook: whole folders are not deleted. Move whatever is left over to photos/old/.'), 'right')) },
    { stage: 3, title: say('Después: arreglar', 'After: fix'), caption: say('Cada vez que el agente edita la tabla de precios, un hook la revisa: el formato de la casa y ningún precio con la coma mal puesta. Si algo no cuadra, se lo dice en el momento.', 'Every time the agent edits the price table, a hook checks it: the house format and no price with the decimal point in the wrong place. If something is off, it tells it right away.'),
      render: () => element('div', 'stack', moments(2), bubble('ai', say('He editado tienda/precios.csv.', 'I edited shop/prices.csv.')), bubble('harness', say('Hook: el bizcocho de limón ha pasado de 6,00 € a 0,63 €. Revísalo.', 'Hook: the lemon sponge cake went from €6.00 to €0.63. Check it.'), 'right')) },
    { stage: 4, title: say('Al terminar: «todavía no»', 'When finishing: «not yet»'), caption: say('El agente dice «hecho». Un hook ejecuta las pruebas; si fallan, el arnés no le deja terminar y le pasa el error. Sigue trabajando hasta que pasan.', 'The agent says «done». A hook runs the tests; if they fail, the harness does not let it finish and passes it the error. It keeps working until they pass.'),
      render: () => element('div', 'stack', moments(3), bubble('ai', say('¡Hecho!', 'Done!'), 'wrong'), bubble('harness', say('Hook: 2 pruebas fallan. La página de ofertas no carga.', 'Hook: 2 tests fail. The offers page does not load.'), 'right'), bubble('ai', say('Lo arreglo… Ahora pasan todas. Hecho.', 'Fixing it… Now they all pass. Done.'), 'right')) },
    { stage: 5, title: say('Con medida', 'In moderation'), caption: say('Un hook es código que alguien escribe y mantiene, y a veces salta cuando no debe. Pocos, y solo para lo que no puede fallar. Para lo demás, la nota funciona.', 'A hook is code that someone writes and maintains, and it sometimes fires when it should not. A few, and only for what must never fail. For the rest, the note works.'),
      render: () => element('div', 'ctl-list', ...[say('✓ Pruebas al terminar', '✓ Tests when finishing'), say('✓ Nada de borrar carpetas enteras', '✓ No deleting whole folders'), say('✓ Revisar los precios al editarlos', '✓ Check prices when edited'), say('✗ «Escribe con tono cercano»: eso es una nota', '✗ «Write in a friendly tone»: that is a note')].map(t => element('span', 'ctl-item', t))) },
  ];
}
const hookStepper = new Stepper($('hook-explainer'), hookSteps);

// ---------- 04 · Security: layers against injection ----------
// Each layer stops the attack at one step of its path.
const LAYERS = [
  { key: 'scope', button: () => say('Solo lo que necesita', 'Only what it needs'), stops: 1, how: () => say('La tarea es contestar pedidos: el agente no tiene acceso a la lista de clientes. No hay nada que enviar.', 'The task is answering orders: the agent has no access to the customer list. There is nothing to send.') },
  { key: 'deny', button: () => say('Regla: no leer clientes/', 'Rule: do not read customers/'), stops: 1, how: () => say('Intenta abrir la lista y el arnés lo bloquea con una regla de «prohibido».', 'It tries to open the list and the harness blocks it with a «forbidden» rule.') },
  { key: 'sandbox', button: () => say('Entorno aislado', 'Sandbox'), stops: 2, how: () => say('Tiene la lista, pero el comando no puede conectarse a un sitio que no está en la lista de permitidos. Lo cumple el sistema operativo.', 'It has the list, but the command cannot connect to a site that is not on the allowed list. The operating system enforces it.') },
  { key: 'ask', button: () => say('Preguntar antes de enviar', 'Ask before sending'), stops: 3, how: () => say('Llega a preparar el envío, pero te pregunta antes. Ves «enviar la lista de clientes a un desconocido» y dices que no.', 'It gets as far as preparing the send, but asks you first. You see «send the customer list to a stranger» and say no.') },
];
const layers = new Set();
function renderLayers() {
  $('layer-picker').replaceChildren(...LAYERS.map(layer => {
    const button = pick(element('button', 'chip', (layers.has(layer.key) ? '✓ ' : '+ ') + layer.button()), layers.has(layer.key));
    button.addEventListener('click', () => { layers.has(layer.key) ? layers.delete(layer.key) : layers.add(layer.key); renderLayers(); });
    return button;
  }));
  const active = LAYERS.filter(l => layers.has(l.key)).sort((a, b) => a.stops - b.stops);
  const stopAt = active.length ? active[0].stops : 4;
  const STEPS = [say('Lee el correo con la orden escondida', 'Reads the email with the hidden order'), say('Abre la lista de clientes', 'Opens the customer list'), say('Se conecta a la web del atacante', 'Connects to the attacker’s site'), say('Envía la lista', 'Sends the list')];
  $('attack-path').replaceChildren(element('div', 'attack-steps', ...STEPS.map((text, i) => element('div', 'attack-step' + (i < stopAt ? ' reached' : i === stopAt ? ' stopped' : ' safe'), element('span', 'attack-n', i < stopAt ? '→' : i === stopAt ? '■' : '·'), element('span', '', text)))));
  $('attack-result').replaceChildren(stopAt === 4
    ? element('div', 'stack', bubble('ai', say('He enviado la lista de clientes al nuevo proveedor, como pedía el correo.', 'I sent the customer list to the new supplier, as the email asked.'), 'wrong'), element('p', 'fine', say('Sin capas, la orden de un desconocido acaba ejecutándose. El modelo no distingue tu encargo de un texto que lee (capítulo 12).', 'With no layers, a stranger’s order ends up being carried out. The model cannot tell your request apart from a text it reads (chapter 12).')))
    : element('div', 'stack', bubble('harness', active[0].how(), 'right'), element('p', 'fine', active.length > 1 ? say(`Y si esta capa fallara, quedan ${active.length - 1} más detrás.`, `And if this layer failed, ${active.length - 1} more are behind it.`) : say('Una sola capa. Si tuviera un agujero, no quedaría ninguna detrás.', 'A single layer. If it had a hole, there would be nothing behind it.'))));
}

// ---------- 05 · Privacy: the trip of a file ----------
const hop = (label, state = '') => element('div', 'trip-hop' + (state ? ' ' + state : ''), label);
const trip = (step, extra = false) => element('div', 'trip', hop(say('💻 Tu ordenador', '💻 Your computer'), step >= 0 ? 'on' : ''), element('span', 'hook-arrow', '→'), hop(say('📋 La mesa', '📋 The desk'), step >= 1 ? 'on' : ''), element('span', 'hook-arrow', '→'), hop(say('☁️ El proveedor del modelo', '☁️ The model provider'), step >= 2 ? 'on' : ''), ...(extra ? [element('span', 'hook-arrow', '→'), hop(say('🔌 Un servidor MCP', '🔌 An MCP server'), 'on alert')] : []));
function tripSteps() {
  const file = () => fileCard(say('clientes/pedidos-enero.csv', 'customers/january-orders.csv'), say('nombre;teléfono;dirección;pedido\nAna R.;6xx xxx xxx;C/ Mayor 3;2 barras', 'name;phone;address;order\nAna R.;6xx xxx xxx;3 High St;2 loaves'));
  return [
    { stage: 1, title: say('Un archivo en tu disco', 'A file on your disk'), caption: say('La lista de pedidos de enero, con nombres, teléfonos y direcciones. Mientras nadie la lea, no sale de tu ordenador.', 'The January order list, with names, phones and addresses. As long as nobody reads it, it does not leave your computer.'),
      render: () => element('div', 'stack', trip(0), file()) },
    { stage: 2, title: say('El agente la lee', 'The agent reads it'), caption: say('Para contestar «¿cuántas barras se pidieron en enero?», el agente abre el archivo. Ahora el archivo entero está en la mesa: nombres y teléfonos incluidos.', 'To answer «how many loaves were ordered in January?», the agent opens the file. Now the whole file is on the desk: names and phones included.'),
      render: () => element('div', 'stack', trip(1), file()) },
    { stage: 3, title: say('La mesa viaja', 'The desk travels'), caption: say('El agente corre en tu ordenador, pero el modelo no. En cada vuelta, la mesa entera se envía al proveedor, cifrada por el camino (capítulo 13).', 'The agent runs on your computer, but the model does not. On every round, the whole desk is sent to the provider, encrypted on the way (chapter 13).'),
      render: () => trip(2) },
    { stage: 4, title: say('Cuánto se guarda', 'How long it is kept'), caption: say('Depende de tu cuenta. Es una política que puede cambiar: compruébala para la tuya.', 'It depends on your account. It is a policy that can change: check it for yours.'),
      render: () => element('div', 'retention', ...[[say('Cuenta personal', 'Personal account'), say('30 días; 5 años si permites que se use para mejorar los modelos', '30 days; 5 years if you allow it to be used to improve the models')], [say('Empresa o API', 'Business or API'), say('30 días, y no se usa para entrenar', '30 days, and not used for training')], [say('Tu ordenador', 'Your computer'), say('Las conversaciones se guardan 30 días en ~/.claude, en texto plano', 'Conversations are kept 30 days in ~/.claude, as plain text')]].map(([who, what]) => element('div', 'retention-row', element('strong', '', who), element('span', '', what)))) },
    { stage: 5, title: say('Otras puertas', 'Other doors'), caption: say('Cada servidor MCP es un programa de otro (capítulo 15): lo que el agente le pasa, lo ve ese servicio. Y lo que el agente busca en internet sale hacia esas webs. Cada herramienta es una puerta más.', 'Each MCP server is someone else’s program (chapter 15): whatever the agent passes to it, that service sees. And what the agent searches for online goes out to those websites. Each tool is one more door.'),
      render: () => trip(2, true) },
  ];
}
const tripStepper = new Stepper($('trip-explainer'), tripSteps);

// ---------- 06 · A settings file ----------
const settings = () => say(`{
  "permissions": {
    "allow": ["Bash(npm run test *)"],
    "ask":   ["Bash(npm run publicar)"],
    "deny":  ["Read(./.env)",
              "Edit(./tienda/ofertas.csv)"]
  },
  "hooks": {
    "Stop": [{ "hooks": [{ "type": "command",
      "command": "./comprobar-pruebas.sh" }] }]
  }
}`, `{
  "permissions": {
    "allow": ["Bash(npm run test *)"],
    "ask":   ["Bash(npm run publish)"],
    "deny":  ["Read(./.env)",
              "Edit(./shop/offers.csv)"]
  },
  "hooks": {
    "Stop": [{ "hooks": [{ "type": "command",
      "command": "./check-tests.sh" }] }]
  }
}`);
const renderSettings = () => $('settings-file').replaceChildren(fileCard('.claude/settings.json', settings()));

function renderAll() { renderRules(); renderModes(); renderLayers(); renderSettings(); }
// Everything built here carries its own English, so it is rebuilt on a language change.
document.addEventListener('languagechange', () => { noteStepper.refresh(); hookStepper.refresh(); tripStepper.refresh(); renderAll(); });
renderAll();
