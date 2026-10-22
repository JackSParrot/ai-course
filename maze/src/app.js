import { translateText as t, getLocale } from "../../i18n/i18n.js";
import { Evolution, MAZES, ARROWS, copyMaze, validateMaze, evaluateDNA, compareResults, rankWeights, exportExperiment, restoreExperiment } from "./evolution.js";

const $ = id => document.getElementById(id);
const STORAGE = "neural-maze.evolution.v2";
const number = (n, digits = 0) => n.toLocaleString(getLocale(), { maximumFractionDigits: digits });
let engine = new Evolution(), manualDNA = [], selected = "", step = 0, replayTimer = null, autoTimer = null, running = false;
let viewedGeneration = null, archivedPopulation = [], boardExplorers = [];
let editorDraft = null, wallUndo = [], storageBlocked = false, storedMessage = "", statusSource = "", storageSource = "", customMaze = null;
const origins = { random: "ADN aleatorio", elite: "Élite · copia intacta", child: "Hijo · cruce y mutación" };
const phaseNames = { empty: "ADN VACÍO", ready: "POR EVALUAR", evaluated: "POBLACIÓN EVALUADA", parents: "PADRES ELEGIDOS", birth: "HIJO PREPARADO" };
const help = {
  empty: "Sin instrucciones, el explorador no se mueve. Prueba unas flechas o crea una población de ADN aleatorio para empezar a comparar soluciones.",
  ready: "Todos salen desde la misma entrada con ADN fijo. Ejecuta sus instrucciones para comparar hasta dónde llegan.",
  evaluated: "La clasificación ya está calculada. Sortea dos padres: los mejores tienen más fichas, pero cualquier individuo puede ser elegido.",
  parents: "Estos son los dos resultados del sorteo. Ahora observa cómo el corte y las mutaciones crean un hijo, sin modificar a los padres.",
  birth: "El hijo todavía no ha sido evaluado. Crea la nueva generación con élites, hijos y exploradores aleatorios; después compara sus recorridos.",
};

function element(tag, text, className) { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; }
function message(text) { statusSource = text; $("status").textContent = t(text); }
function storageMessage(text) { storageSource = text; $("storage-note").textContent = t(text); }
function stopReplay() { clearInterval(replayTimer); replayTimer = null; }
function pause() { clearTimeout(autoTimer); autoTimer = null; running = false; stopReplay(); }
function save() {
  if (storageBlocked) return;
  try { localStorage.setItem(STORAGE, JSON.stringify({ ...exportExperiment(engine), customMaze })); storageMessage("Población actual guardada en este navegador. Al volver, los nacimientos pendientes se preparan de nuevo. No se envían datos."); }
  catch { storageMessage("Este navegador no ha podido guardar. Puedes seguir jugando durante esta sesión."); }
}
try {
  const saved = localStorage.getItem(STORAGE);
  if (saved) {
    const data = JSON.parse(saved); engine = restoreExperiment(data);
    if (data.customMaze) { validateMaze(data.customMaze); customMaze = copyMaze(data.customMaze); }
    else if (engine.maze.id === "custom") customMaze = copyMaze(engine.maze);
    storedMessage = "Experimento recuperado. Puedes continuar desde esta generación.";
  }
} catch { storageBlocked = true; storedMessage = "No se pudo recuperar el experimento. El guardado original se conserva; puedes empezar uno nuevo."; }

function syncSettings() {
  $("population-size").value = engine.size; $("mutation-rate").value = engine.mutationRate; $("seed").value = engine.seed;
  const option = $("maze-preset").querySelector('[value="custom"]'); option.disabled = !customMaze;
  $("maze-preset").value = engine.maze.id;
}
function population() { return viewedGeneration === null ? engine.population : archivedPopulation; }
function generation() { return viewedGeneration ?? engine.generation; }
function duration() { return population().length ? engine.length : manualDNA.length; }
function colorFor(candidate) {
  const index = Math.max(0, population().findIndex(p => p.id === candidate.id));
  return `hsl(${(index * 137.508 + 166) % 360} 60% 34%)`;
}
function resultFor(candidate) { return candidate.result ?? evaluateDNA(engine.maze, candidate.dna, engine.distances); }
function current() {
  const candidate = population().find(p => p.id === selected) ?? population()[0];
  if (!candidate) return { id: "", dna: manualDNA, result: evaluateDNA(engine.maze, manualDNA, engine.distances), origin: "manual" };
  return { ...candidate, result: candidate.result ?? evaluateDNA(engine.maze, candidate.dna, engine.distances) };
}
function choose(id, animate = false) {
  pause(); selected = id; if (animate) step = 0;
  render(); if (animate) replay();
}
function geneRow(dna, { cut = -1, mutations = [], active = -1, trace = null, mixed = false, parent = "" } = {}) {
  const row = element("div", undefined, "dna");
  dna.forEach((gene, i) => {
    const changed = mutations.some(m => m.index === i);
    const unused = trace && i >= trace.length - 1;
    const span = element("span", ARROWS[gene], `gene${mixed ? i < cut ? " from-a" : " from-b" : parent ? ` from-${parent}` : ""}${i === cut ? " cut" : ""}${changed ? " mutated" : ""}${i === active ? " active" : ""}${trace?.[i + 1]?.hit ? " hit" : ""}${unused ? " unused" : ""}`);
    span.title = `${t("Gen")} ${i + 1}: ${t({ up: "arriba", down: "abajo", left: "izquierda", right: "derecha" }[gene])}${changed ? ` · ${t("Mutación")}` : ""}${unused ? ` · ${t("Sin ejecutar: ya llegó al tesoro")}` : ""}`;
    row.append(span);
  });
  if (!dna.length) row.append(element("p", t("[ ] · ADN vacío: todavía no hay movimientos."), "fine"));
  return row;
}
function drawBoard() {
  const canvas = $("maze-canvas"), ratio = Math.min(window.devicePixelRatio || 1, 2), width = Math.max(200, canvas.clientWidth);
  canvas.width = Math.round(width * ratio); canvas.height = canvas.width;
  const context = canvas.getContext("2d"), maze = engine.maze, cell = 660 / maze.width, cellHeight = 660 / maze.height;
  context.setTransform(canvas.width / 660, 0, 0, canvas.height / 660, 0, 0);
  context.fillStyle = "#16362e"; context.fillRect(0, 0, 660, 660);
  for (let y = 0; y < maze.height; y++) for (let x = 0; x < maze.width; x++) {
    const open = maze.cells[y][x] === ".";
    context.fillStyle = open ? (x + y) % 2 ? "#e8e4ce" : "#e3dfc8" : (x + y) % 2 ? "#466352" : "#385544";
    context.fillRect(x * cell + .35, y * cellHeight + .35, cell - .7, cellHeight - .7);
    if (!open) { context.fillStyle = "#8aa18466"; context.fillRect(x * cell + 2, y * cellHeight + 2, cell - 4, 2); }
    if (open && $("show-distances").checked && engine.distances[y * maze.width + x] >= 0) {
      context.fillStyle = "#4d5b46"; context.font = `${Math.round(cell * .2)}px Consolas`; context.textAlign = "left"; context.textBaseline = "top";
      context.font = `${Math.max(7, cell * .4)}px Consolas`;
      context.fillText(engine.distances[y * maze.width + x], x * cell + 2, y * cellHeight + 2);
    }
  }
  function trail(trace, color, lineWidth, alpha) {
    context.globalAlpha = alpha; context.strokeStyle = color; context.lineWidth = lineWidth; context.lineJoin = "round"; context.lineCap = "round";
    context.beginPath(); trace.forEach((point, i) => { const x = (point.x + .5) * cell, y = (point.y + .5) * cellHeight; if (i) context.lineTo(x, y); else context.moveTo(x, y); }); context.stroke(); context.globalAlpha = 1;
  }
  const candidate = current(), result = candidate.result;
  step = Math.max(0, Math.min(step, duration()));
  const visible = $("show-population").checked && population().length ? population() : [candidate];
  const runners = visible.map(p => ({ ...p, result: resultFor(p) }));
  if ($("show-trails").checked) {
    for (const runner of runners) if (runner.id !== candidate.id) trail(runner.result.trace.slice(0, step + 1), colorFor(runner), Math.max(.9, cell * .07), .35);
    trail(result.trace.slice(0, step + 1), colorFor(candidate), Math.max(2.6, cell * .16), 1);
  }
  context.textAlign = "center"; context.textBaseline = "middle"; context.font = `${Math.max(13, cell * .85)}px 'Segoe UI Emoji',sans-serif`;
  context.fillText("🧭", (maze.start.x + .5) * cell, (maze.start.y + .5) * cellHeight);
  context.fillText("💎", (maze.goal.x + .5) * cell, (maze.goal.y + .5) * cellHeight);
  boardExplorers = [];
  const ordered = [...runners.filter(p => p.id !== candidate.id), runners.find(p => p.id === candidate.id)].filter(Boolean);
  for (const runner of ordered) {
    const index = population().findIndex(p => p.id === runner.id), r = runner.result, cursor = Math.min(step, r.steps), pose = r.trace[cursor];
    const chosen = runner.id === candidate.id, spread = chosen ? 0 : cell * .16;
    const x = (pose.x + .5) * cell + Math.cos(index * 2.4) * spread, y = (pose.y + .5) * cellHeight + Math.sin(index * 2.4) * spread;
    const size = chosen ? Math.max(4.5, cell * .28) : Math.max(2.8, cell * .19);
    const solved = r.solved && cursor === r.steps, gene = runner.dna[Math.max(0, cursor - 1)];
    context.save(); context.translate(x, y);
    if (chosen || solved) { context.strokeStyle = solved ? "#a66a07" : "#fffefa"; context.lineWidth = 1.8; context.beginPath(); context.arc(0, 0, size + 2, 0, Math.PI * 2); context.stroke(); }
    context.rotate({ right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[gene] ?? 0);
    context.fillStyle = colorFor(runner); context.strokeStyle = chosen && pose.hit ? "#b23632" : "#fffefa"; context.lineWidth = chosen ? 1.4 : .7;
    context.beginPath(); context.moveTo(size, 0); context.lineTo(-size * .8, -size * .7); context.lineTo(-size * .45, 0); context.lineTo(-size * .8, size * .7); context.closePath(); context.fill(); context.stroke(); context.restore();
    boardExplorers.push({ id: runner.id, x: x / 660, y: y / 660 });
  }
  const pose = result.trace[Math.min(step, result.steps)];
  canvas.setAttribute("aria-label", `${t(maze.name)}. ${t("Generación")} ${generation()}. ${runners.length} ${t("exploradores visibles")}. ${t("Explorador en columna")} ${pose.x + 1}, ${t("fila")} ${pose.y + 1}. ${t("Paso")} ${step} / ${duration()}.`);
  $("playhead").max = duration(); $("playhead").value = step; $("move-label").textContent = `${step} / ${duration()}`;
  const arrived = runners.filter(p => p.result.solved && p.result.steps <= step).length;
  $("live-readout").textContent = `${t("Generación")} ${generation()} · ${runners.length} ${t("exploradores visibles")} · ${arrived} ${t("en el tesoro")} · ${t("Seleccionado")}: ${candidate.id || t("Tu primer explorador")}`;
}
function renderDNA() {
  const candidate = current(), result = candidate.result;
  $("individual-name").textContent = candidate.id || t("Tu primer explorador");
  $("individual-note").textContent = `${t(origins[candidate.origin] ?? "ADN de prueba manual")} · ${candidate.dna.length} / ${engine.length} ${t("movimientos")}${result.solved ? ` · ${result.steps} ${t("ejecutados")} · ${candidate.dna.length - result.steps} ${t("sin usar")}` : ""}`;
  $("dna").replaceChildren(...geneRow(candidate.dna, { active: step <= result.steps ? step - 1 : -1, trace: result.trace }).childNodes);
  $("manual-controls").hidden = engine.phase !== "empty";
  $("undo-gene").disabled = !manualDNA.length; $("clear-dna").disabled = !manualDNA.length;
  const labels = [["Tesoro", result.solved ? "Encontrado" : "Pendiente"], ["Mejor distancia restante", result.bestDistance], ["Pasos hasta esa casilla", result.bestStep], ["Choques con paredes", result.collisions]];
  $("evaluation").replaceChildren(...labels.map(([label, value]) => { const box = element("div", t(label)); box.append(element("strong", typeof value === "number" ? value : t(value))); return box; }));
  const parents = candidate.ancestry?.parents;
  $("ancestry").textContent = viewedGeneration !== null ? t("Esta repetición conserva los movimientos originales. Los cruces se inspeccionan en la generación actual.") : parents?.length ? `${t("Procedencia")}: ${parents.join(" + ")}${candidate.origin === "elite" ? ` · ${t("ADN copiado sin cambios")}` : ""}.` : t("El ADN aleatorio no tiene padres. El mejor resultado histórico se conserva mediante las élites.");
}
function renderRanking() {
  const rows = viewedGeneration !== null ? [...population()].sort(compareResults) : engine.ranking.length ? engine.ranking : engine.population, slots = rows[0]?.result ? rankWeights(rows) : [];
  const parentIds = viewedGeneration === null ? engine.pending?.draws.map(d => d.individual.id) ?? [] : [];
  $("population").replaceChildren(...rows.map((candidate, i) => {
    const tr = element("tr"); tr.className = `${candidate.id === selected ? "selected" : ""} ${candidate.id === parentIds[0] ? "parent-a" : ""} ${candidate.id === parentIds[1] ? "parent-b" : ""}`;
    const td = element("td"), button = element("button", candidate.id), swatch = element("span", "●"); swatch.style.color = colorFor(candidate); swatch.setAttribute("aria-hidden", "true"); button.type = "button"; button.setAttribute("aria-label", `${t("Inspeccionar explorador")} ${candidate.id}`); button.addEventListener("click", () => choose(candidate.id)); td.append(swatch, button); tr.append(td);
    const r = candidate.result;
    [r ? `${r.bestDistance}${r.solved ? " 💎" : ""}` : "—", r?.bestStep ?? "—", r?.collisions ?? "—", slots[i] ? `${slots[i].weight} / ${number(slots[i].probability * 100, 2)} %` : "—"].forEach(value => tr.append(element("td", value)));
    return tr;
  }));
  if (!rows.length) { const tr = element("tr"), td = element("td", t("Todavía no hay población. Todos los ADN empezarán siendo aleatorios.")); td.colSpan = 5; tr.append(td); $("population").append(tr); }
  let cumulative = 0;
  $("wheel").style.background = slots.length ? `conic-gradient(${slots.map(slot => { const start = cumulative; cumulative += slot.probability * 100; return `${colorFor(slot.individual)} ${start}% ${cumulative}%`; }).join(",")})` : "";
  const draws = viewedGeneration === null ? engine.pending?.draws : null;
  $("draws").replaceChildren();
  if (draws) draws.forEach((draw, i) => { const line = element("p"); line.append(element("strong", `${t(i ? "Padre B" : "Padre A")}: ${draw.individual.id}`), document.createTextNode(` · ${t("azar")} ${number(draw.roll * 100, 2)} % · ${t("probabilidad")} ${number(draw.probability * 100, 2)} %`)); $("draws").append(line); });
  else $("draws").textContent = t("Primero evalúa la población. Después podrás ver los dos sorteos.");
  $("wheel").style.setProperty("--roll", `${(draws?.at(-1).roll ?? 0) * 360}deg`);
}
function renderBirth() {
  const child = viewedGeneration === null ? engine.pending?.child : null;
  const ancestor = current().ancestry;
  const record = child ?? (ancestor?.parentDNA ? ancestor : null);
  const target = $("birth"); target.replaceChildren();
  if (!record) target.append(element("p", t("Aquí verás a los padres, el corte y las flechas que cambian."), "empty-note"));
  else {
    const rows = [[`${t("Padre A")} · ${record.parents[0]}`, record.parentDNA[0], { cut: record.cut, parent: "a" }], [`${t("Padre B")} · ${record.parents[1]}`, record.parentDNA[1], { cut: record.cut, parent: "b" }], ["Cruce antes de mutar", record.before, { cut: record.cut, mixed: true }], ["Hijo después de mutar", child?.dna ?? current().dna, { cut: record.cut, mutations: record.mutations, mixed: true }]];
    for (const [label, dna, options] of rows) { const section = element("div", undefined, "birth-row"); section.append(element("strong", t(label)), geneRow(dna, options)); target.append(section); }
    target.append(element("p", `${t("Corte después del gen")} ${record.cut}. ${t("Mutaciones")}: ${record.mutations.length} / ${engine.length}.`));
    const list = element("ul", undefined, "mutation-list");
    record.mutations.forEach(m => list.append(element("li", `${t("Gen")} ${m.index + 1}: ${ARROWS[m.before]} → ${ARROWS[m.after]}`)));
    if (!record.mutations.length) list.append(element("li", t("Esta vez ningún gen ha mutado. Es un resultado válido del azar.")));
    target.append(list);
    if (record.mutationRolls) {
      const details = element("details"), summary = element("summary", t("Ver el sorteo de cada gen")), table = element("table"), head = element("tr");
      ["Gen", "Azar", "Límite", "Resultado"].forEach(label => head.append(element("th", t(label)))); table.append(head);
      record.mutationRolls.forEach((roll, i) => { const row = element("tr"), mutated = roll < record.mutationRate; [i + 1, `${number(roll * 100, 2)} %`, `${number(record.mutationRate * 100, 2)} %`, t(mutated ? "Cambia" : "Se conserva")].forEach(value => row.append(element("td", value))); table.append(row); });
      details.append(summary, element("p", t("Si el número al azar es menor que el límite, el gen cambia por otra dirección.")), table); target.append(details);
    }
  }
  const elite = Math.max(1, Math.floor(engine.size / 16));
  $("population-plan").textContent = `${t("Próxima población")}: ${elite} ${t("élites intactas")} + ${engine.size - 2 * elite} ${t("hijos")} + ${elite} ${t("ADN nuevos al azar")}. ${t("El hijo que ves formará parte de ella.")}`;
}
function renderStats() {
  const last = engine.history.find(h => h.generation === generation());
  $("best").textContent = engine.best ? `${engine.best.result.quality} %` : "—";
  $("mean").textContent = last ? `${number(last.mean, 1)} %` : "—";
  $("diversity").textContent = population().length ? `${new Set(population().map(p => p.dna.join(","))).size} / ${engine.size}` : "—";
  $("solved").textContent = last ? `${last.solved} / ${engine.size}` : "—";
  $("routes").textContent = last ? last.routes : "—";
  $("best-moves").textContent = last?.bestSteps ? `${last.bestSteps} / 100` : "—";
  const first = engine.history[0];
  $("progress-comparison").textContent = first && last ? `${t("Primera generación")}: ${first.best} %. ${t("Esta generación")}: ${last.best} %. ${t("Mínimo del mapa")}: ${engine.distances[engine.maze.start.y * engine.maze.width + engine.maze.start.x]} ${t("movimientos")}.` : t("Compara el avance de la primera generación con el de las siguientes.");
  const chart = $("history-chart"); chart.replaceChildren();
  const ns = "http://www.w3.org/2000/svg";
  for (const y of [10, 50, 90]) { const line = document.createElementNS(ns, "line"); line.setAttribute("x1", "8"); line.setAttribute("x2", "312"); line.setAttribute("y1", y); line.setAttribute("y2", y); line.setAttribute("stroke", "#7c907555"); chart.append(line); }
  // Keep the first generation in the plot even during long experiments.
  const stride = Math.max(1, Math.ceil(engine.history.length / 200));
  const history = engine.history.filter((h, i) => i % stride === 0 || i === engine.history.length - 1); let maximum = 0;
  const bests = history.map(h => maximum = Math.max(maximum, h.best));
  for (const [values, color] of [[bests, "#67a88b"], [history.map(h => h.mean), "#d18b60"]]) if (values.length) {
    const line = document.createElementNS(ns, "polyline"); line.setAttribute("points", values.map((v, i) => `${8 + i * 304 / Math.max(1, values.length - 1)},${90 - v * .8}`).join(" ")); line.setAttribute("fill", "none"); line.setAttribute("stroke", color); line.setAttribute("stroke-width", "2.5"); chart.append(line);
  }
  chart.setAttribute("aria-label", `${t("Evolución del mejor avance y de la media")}. ${t("Generaciones evaluadas")}: ${engine.history.length}. ${$("progress-comparison").textContent}`);
}
function renderGenerationBrowser() {
  const picker = $("generation-view"), options = [new Option(`${t("Generación actual")} · ${engine.generation}`, "live")];
  for (const snapshot of engine.archive) if (snapshot.generation !== engine.generation) {
    const entry = engine.history[snapshot.generation - 1];
    options.push(new Option(`${t("Generación")} ${snapshot.generation} · ${entry.solved} / ${engine.size} ${t("en el tesoro")}`, snapshot.generation));
  }
  picker.replaceChildren(...options); picker.value = viewedGeneration === null ? "live" : viewedGeneration;
  $("return-live").hidden = viewedGeneration === null; $("archive-note").hidden = viewedGeneration === null;
}
function render() {
  $("generation").textContent = generation(); $("phase").textContent = t(viewedGeneration === null ? phaseNames[engine.phase] : "GENERACIÓN ANTERIOR"); $("phase-help").textContent = t(viewedGeneration === null ? help[engine.phase] : "Repite esta generación para comparar sus intentos con los actuales. Su ADN se conserva tal como se evaluó.");
  $("maze-name").textContent = `${t(engine.maze.name)} · ${engine.maze.width} × ${engine.maze.height}`;
  const allowed = { initialize: "empty", evaluate: "ready", select: "evaluated", cross: "parents", "next-generation": "birth" };
  for (const [id, phase] of Object.entries(allowed)) { $(id).hidden = engine.phase !== phase || viewedGeneration !== null; $(id).disabled = running; }
  $("auto").disabled = running || viewedGeneration !== null; $("pause").disabled = !running && !replayTimer;
  $("birth-cross").hidden = engine.phase !== "parents" || viewedGeneration !== null; $("birth-next").hidden = engine.phase !== "birth" || viewedGeneration !== null;
  $("birth-cross").disabled = running; $("birth-next").disabled = running;
  document.querySelectorAll("[data-phase]").forEach(el => { if (el.dataset.phase === engine.phase && viewedGeneration === null) el.setAttribute("aria-current", "step"); else el.removeAttribute("aria-current"); });
  drawBoard(); renderDNA(); renderRanking(); renderBirth(); renderStats(); renderGenerationBrowser();
}
function replay(onComplete = null) {
  stopReplay(); if (!duration()) return;
  if (step >= duration()) step = 0;
  $("pause").disabled = false;
  replayTimer = setInterval(() => {
    const pace = $("playback-speed").value;
    step = Math.min(duration(), step + (pace === "watch" ? 1 : pace === "fast" ? 10 : 4));
    drawBoard(); renderDNA();
    if (step >= duration()) { stopReplay(); $("pause").disabled = !running; onComplete?.(); }
  }, $("playback-speed").value === "watch" ? 65 : 32);
}
function perform(action) {
  if (viewedGeneration !== null) return;
  pause();
  try {
    engine[action](); selected = engine.ranking[0]?.id ?? engine.population[0]?.id ?? ""; step = 0;
    const notices = { initialize: "Primera población creada. Todas las instrucciones son aleatorias.", evaluate: "Evaluación terminada. La ruleta ya refleja las oportunidades de cada explorador.", chooseParents: "Dos sorteos independientes han elegido a los padres. Puedes ver sus fichas y porcentajes.", makeChild: "Hijo preparado. Compara las dos procedencias y los genes que han mutado.", nextGeneration: "Nueva generación creada. Ahora hay que ejecutar y evaluar sus instrucciones." };
    message(engine.phase === "evaluated" && engine.ranking[0].result.solved ? "¡Tesoro encontrado! Puedes inspeccionar la ruta o seguir buscando una más corta." : notices[action]);
    render(); save(); if (action === "evaluate") replay();
    const focus = action === "chooseParents" ? "selection-title" : action === "makeChild" ? "birth-title" : action === "nextGeneration" ? "experiment-title" : null;
    if (focus) $(focus).scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  } catch (error) { message(error.message); }
}
for (const [id, action] of Object.entries({ initialize: "initialize", evaluate: "evaluate", select: "chooseParents", cross: "makeChild", "next-generation": "nextGeneration" })) $(id).addEventListener("click", () => perform(action));
$("birth-cross").addEventListener("click", () => perform("makeChild"));
$("birth-next").addEventListener("click", () => perform("nextGeneration"));
function autoTick() {
  if (!running) return;
  try {
    if (engine.phase === "empty") engine.initialize();
    if (engine.phase === "ready") engine.evaluate();
    else { engine.cycle(); engine.evaluate(); }
    selected = engine.ranking[0].id; step = 0;
    message(engine.best.result.solved ? "¡Tesoro encontrado! Seguimos evolucionando para comparar otras rutas." : "Comparando generaciones. Pausa cuando quieras inspeccionar un nacimiento.");
    render(); save();
    replay(() => { if (running) autoTimer = setTimeout(autoTick, 220); });
  } catch (error) { pause(); render(); message(error.message); }
}
$("auto").addEventListener("click", () => {
  stopReplay(); running = true;
  if (engine.phase === "evaluated" && step < duration()) {
    render(); replay(() => { if (running) autoTimer = setTimeout(autoTick, 220); });
  } else autoTick();
});
$("pause").addEventListener("click", () => { pause(); render(); message("Evolución en pausa. Puedes inspeccionar cualquier explorador de esta generación."); });
$("replay").addEventListener("click", () => { pause(); step = 0; render(); replay(); });
$("next-move").addEventListener("click", () => { pause(); step = Math.min(step + 1, duration()); render(); });
$("playhead").addEventListener("input", event => { pause(); step = Number(event.target.value); render(); });
for (const id of ["show-population", "show-trails", "show-distances"]) $(id).addEventListener("change", drawBoard);
function viewGeneration(value) {
  pause(); viewedGeneration = value === "live" ? null : Number(value);
  archivedPopulation = viewedGeneration === null ? [] : engine.generationPopulation(viewedGeneration);
  selected = [...population()].sort((a, b) => a.result && b.result ? compareResults(a, b) : 0)[0]?.id ?? "";
  step = 0; render();
}
$("generation-view").addEventListener("change", event => viewGeneration(event.target.value));
$("return-live").addEventListener("click", () => viewGeneration("live"));
$("maze-canvas").addEventListener("click", event => {
  const rect = event.currentTarget.getBoundingClientRect(), x = (event.clientX - rect.left) / rect.width, y = (event.clientY - rect.top) / rect.height;
  const nearest = boardExplorers.map(p => ({ ...p, distance: Math.hypot(p.x - x, p.y - y) })).sort((a, b) => a.distance - b.distance)[0];
  if (nearest?.id && nearest.distance * rect.width < 16) choose(nearest.id);
});
$("maze-canvas").addEventListener("keydown", event => {
  if (!["ArrowRight", "ArrowLeft"].includes(event.key) || !population().length) return;
  event.preventDefault(); const list = population(), index = list.findIndex(p => p.id === selected);
  choose(list[(index + (event.key === "ArrowRight" ? 1 : list.length - 1)) % list.length].id);
});
document.querySelectorAll("[data-gene]").forEach(button => button.addEventListener("click", () => { if (engine.phase !== "empty" || manualDNA.length >= engine.length) return; stopReplay(); manualDNA.push(button.dataset.gene); step = manualDNA.length; render(); }));
$("undo-gene").addEventListener("click", () => { stopReplay(); manualDNA.pop(); step = manualDNA.length; render(); });
$("clear-dna").addEventListener("click", () => { stopReplay(); manualDNA = []; step = 0; render(); });
function reset(maze) {
  const next = new Evolution(maze, { seed: Number($("seed").value), size: Number($("population-size").value), mutationRate: Number($("mutation-rate").value) });
  pause(); engine = next; manualDNA = []; selected = ""; step = 0; viewedGeneration = null; archivedPopulation = []; storageBlocked = false;
  if (engine.maze.id === "custom") customMaze = copyMaze(engine.maze);
  syncSettings(); render(); save(); message("Nuevo experimento. El ADN está vacío; crea variedad antes de seleccionar.");
}
$("settings").addEventListener("submit", event => { event.preventDefault(); try { reset($("maze-preset").value === "custom" ? customMaze : MAZES.find(m => m.id === $("maze-preset").value)); } catch (error) { message(error.message); } });

function renderEditor() {
  const maze = editorDraft, grid = $("editor-grid"); grid.style.gridTemplateColumns = `repeat(${maze.width},minmax(18px,1fr))`;
  grid.replaceChildren(...maze.cells.flatMap((row, y) => [...row].map((cell, x) => {
    const start = x === maze.start.x && y === maze.start.y, goal = x === maze.goal.x && y === maze.goal.y;
    const button = element("button", start ? "🧭" : goal ? "💎" : "", `editor-cell${cell === "." ? " open" : ""}`); button.type = "button";
    button.disabled = start || goal || x === 0 || y === 0 || x === maze.width - 1 || y === maze.height - 1;
    button.setAttribute("aria-label", `${t("Columna")} ${x + 1}, ${t("fila")} ${y + 1}: ${t(cell === "." ? "pasillo" : "pared")}`); button.setAttribute("aria-pressed", String(cell === "."));
    button.addEventListener("click", () => { wallUndo.push([...maze.cells]); if (wallUndo.length > 100) wallUndo.shift(); const chars = [...maze.cells[y]]; chars[x] = cell === "." ? "#" : "."; maze.cells[y] = chars.join(""); $("editor-message").textContent = ""; renderEditor(); });
    return button;
  })));
  $("undo-wall").disabled = !wallUndo.length;
}
$("edit-maze").addEventListener("click", () => { pause(); render(); editorDraft = copyMaze(engine.maze); wallUndo = []; $("editor-message").textContent = ""; renderEditor(); $("maze-editor").showModal(); });
$("cancel-editor").addEventListener("click", () => $("maze-editor").close());
$("undo-wall").addEventListener("click", () => { if (wallUndo.length) { editorDraft.cells = wallUndo.pop(); renderEditor(); } });
$("apply-maze").addEventListener("click", () => { try { validateMaze(editorDraft); reset({ ...editorDraft, id: "custom", name: "Mi laberinto" }); $("maze-editor").close(); } catch (error) { $("editor-message").textContent = t(error.message); } });
document.addEventListener("visibilitychange", () => { if (document.hidden) { pause(); render(); } });
window.addEventListener("resize", drawBoard);
document.addEventListener("languagechange", () => { render(); message(statusSource); storageMessage(storageSource); if ($("maze-editor").open) renderEditor(); });
syncSettings(); selected = engine.ranking[0]?.id ?? engine.population[0]?.id ?? ""; render(); message(storedMessage);
storageMessage(storageBlocked ? "El guardado anterior se conserva hasta que inicies un nuevo experimento." : "Se guarda la población actual en este navegador. Los demás talleres conservan sus propios datos.");
