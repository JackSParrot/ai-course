import { getLocale } from '../../i18n/i18n.js';
import { createTrainingSetup, validateTrainingSettings } from "./training-engine.js";
import { populationPlan } from "./genetics.js";
import { Renderer, prepareCanvas } from "./renderer.js";
import { Track, WORLD_WIDTH, WORLD_HEIGHT } from "./track.js";
import { drawTrainingChart } from "./training-chart.js";

const field = id => document.getElementById(`training-${id}`);
const number = (value, digits = 1) => value.toLocaleString(getLocale(), { minimumFractionDigits: digits, maximumFractionDigits: digits });
const ORIGIN_NAMES = { random: "Aleatoria", elite: "Élite intacta", mutation: "Copia mutada", saved: "Campeón guardado" };
const SELECTION_NAMES = { elite: "Conservar + padre", parent: "Puede ser padre", discard: "Descartar", champion: "Campeón" };

function cell(text) {
  const element = document.createElement("td");
  element.textContent = text;
  return element;
}

export class TrainingUI {
  constructor(mapStore, topologyStore, modelStore, actions) {
    this.mapStore = mapStore;
    this.topologyStore = topologyStore;
    this.modelStore = modelStore;
    this.actions = actions;
    this.worker = null;
    this.state = null;
    this.setup = null;
    this.bundle = null;
    this.running = false;
    this.pending = null;
    this.selectedType = "";
    this.selectedCandidate = "";
    this.tableKey = "";
    this.renderer = null;
    this.renderedMap = -1;

    field("settings").addEventListener("submit", event => event.preventDefault());
    field("settings").addEventListener("input", () => this.render());
    field("step").addEventListener("click", () => this.start("step"));
    field("auto").addEventListener("click", () => this.start("auto"));
    field("pause").addEventListener("click", () => this.pause());
    field("new").addEventListener("click", () => this.reset());
    field("pace").addEventListener("change", () => this.worker?.postMessage({ command: "pace", pace: field("pace").value }));
    field("type").addEventListener("change", () => {
      this.selectedType = field("type").value;
      this.selectedCandidate = "";
      this.render();
    });
    field("use").addEventListener("click", () => this.use(false));
    field("test").addEventListener("click", () => this.use(true));
    field("save").addEventListener("click", () => {
      try {
        this.modelStore.save(this.bundle);
        this.message("Campeones guardados: pesos, topologías, mapas vistos y resultados. Podrás recuperarlos al volver a abrir la página.");
        this.renderButtons();
      } catch (error) { this.message(error.message, true); }
    });
    field("load").addEventListener("click", () => this.load());
    window.addEventListener("resize", () => this.renderGraphics());
    document.addEventListener("languagechange", () => this.renderGraphics());
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => this.renderGraphics());
    this.render();
    if (modelStore.warning) this.message(modelStore.warning, true);
  }

  readSettings() {
    return { population: Number(field("population").value), generations: Number(field("generations").value),
      mutationRate: Number(field("rate").value), mutationAmount: Number(field("amount").value), seed: Number(field("seed").value) };
  }

  start(command) {
    if (this.running || this.pending || this.state?.phase === "complete") return;
    try {
      this.actions.pauseRace();
      this.message("");
      if (this.worker) {
        this.running = true;
        this.worker.postMessage({ command });
        this.renderButtons();
        return;
      }
      if (!field("settings").reportValidity()) return;
      const settings = this.readSettings();
      validateTrainingSettings(settings);
      const setup = createTrainingSetup(this.mapStore, this.topologyStore.state, settings);
      this.worker = new Worker(new URL("./training-worker.js", import.meta.url), { type: "module" });
      this.setup = setup;
      this.bundle = null;
      this.pending = command;
      this.tableKey = "";
      this.renderer = null;
      this.worker.addEventListener("message", event => this.receive(event.data));
      this.worker.addEventListener("error", () => this.fail("No se pudo ejecutar el entrenamiento. Reinicia el experimento para volver a intentarlo."));
      this.worker.postMessage({ command: "init", setup, pace: field("pace").value });
      this.render();
    } catch (error) { this.fail(error.message); }
  }

  receive(message) {
    if (message.kind === "error") { this.fail(message.message); return; }
    this.state = message.state;
    this.running = message.running;
    // Solo se publican campeones cuando TODOS los tipos han sido seleccionados.
    if (this.state.groups.every(group => group.champion)) {
      this.bundle = { version: 1, maps: this.setup.maps, settings: this.setup.settings,
        champions: this.state.groups.map(group => group.champion) };
    }
    if (this.pending) {
      this.worker.postMessage({ command: this.pending });
      this.pending = null;
      this.running = true;
    }
    this.render();
  }

  fail(message) {
    this.pending = null;
    this.running = false;
    this.worker?.terminate();
    this.worker = null;
    this.state = null;
    // Un error no borra un campeón que ya se hubiese obtenido.
    if (!this.bundle) this.setup = null;
    this.render();
    this.message(message, true);
  }

  pause() {
    this.pending = null;
    this.worker?.postMessage({ command: "pause" });
  }

  reset() {
    this.worker?.terminate();
    this.worker = null;
    this.state = null;
    this.setup = null;
    this.bundle = null;
    this.running = false;
    this.pending = null;
    this.selectedCandidate = "";
    this.tableKey = "";
    this.renderer = null;
    this.render();
    this.message("Listo para empezar con redes aleatorias. Los campeones guardados y los de la carrera se conservan.");
  }

  use(test) {
    try {
      if (!this.bundle) return;
      this.pause();
      if (test) this.actions.test(this.bundle);
      else this.actions.use(this.bundle);
      this.message(test ? "Prueba preparada en un mapa nuevo para estos campeones. Sus pesos quedan fijos; pulsa Iniciar en la carrera."
        : "Cada coche usa ahora una copia del campeón de su tipo. Pulsa Iniciar en la carrera.");
    } catch (error) { this.message(error.message, true); }
  }

  load() {
    try {
      const bundle = structuredClone(this.modelStore.saved);
      this.actions.use(bundle);
      this.worker?.terminate();
      this.worker = null;
      this.state = null;
      this.setup = { maps: bundle.maps, types: bundle.champions.map(champion => champion.type), settings: bundle.settings };
      this.bundle = bundle;
      this.running = false;
      this.pending = null;
      this.selectedCandidate = "";
      this.tableKey = "";
      this.renderer = null;
      this.render();
      this.message("Campeones recuperados y aplicados a la carrera. Se recuperan sus pesos y resultados; una nueva población empieza desde cero.");
    } catch (error) { this.message(error.message, true); }
  }

  message(text, error = false) {
    field("message").textContent = text;
    field("message").classList.toggle("error", error);
  }

  groups() {
    if (this.state) return this.state.groups;
    if (this.bundle) return this.bundle.champions.map(champion => ({ type: champion.type, history: [], champion,
      population: [{ ...champion, origin: "saved", parentId: null, changes: 0, selection: "champion" }] }));
    return this.topologyStore.state.types.filter(type => this.topologyStore.state.assignments.includes(type.id))
      .map(type => ({ type, history: [], champion: null, population: [] }));
  }

  refreshPlan() {
    const experiment = this.mapStore.getExperiment();
    const maps = this.setup?.maps ?? experiment.trainingMaps;
    const types = this.setup?.types ?? this.groups().map(group => group.type);
    const settings = this.setup?.settings ?? this.readSettings();
    const plan = populationPlan(settings.population);
    field("plan").replaceChildren();
    const summary = document.createElement("strong");
    summary.textContent = `${types.length} tipos × ${settings.population} redes · ${maps.length} mapas × 2 salidas por tipo y generación.`;
    const mapNames = document.createElement("span");
    mapNames.textContent = `Mapas de entrenamiento: ${maps.map(map => map.name).join(" · ") || "Selecciona 3 o 4 en la biblioteca"}.`;
    const separation = document.createElement("span");
    separation.textContent = this.setup ? "Este experimento conserva una copia de sus mapas y tipos. Los cambios del editor se usan al empezar otro."
      : `Prueba reservada: ${experiment.testMap?.name ?? "Falta reservar un mapa"}. No interviene en la selección ni la mutación.`;
    const offspring = document.createElement("span");
    offspring.textContent = `Por tipo: ${plan.elite} élites intactas + ${settings.population - plan.elite - plan.fresh} copias mutadas de los ${plan.parents} mejores + ${plan.fresh} redes aleatorias nuevas.`;
    field("plan").append(summary, mapNames, separation, offspring);
    if (!this.setup) {
      this.renderTypePicker();
      this.renderer = null;
      this.renderGraphics();
    }
  }

  renderTypePicker() {
    const groups = this.groups();
    if (!groups.some(group => group.type.id === this.selectedType)) this.selectedType = groups[0]?.type.id ?? "";
    const key = JSON.stringify(groups.map(group => [group.type.id, group.type.name]));
    if (field("type").dataset.types !== key) {
      field("type").replaceChildren(...groups.map(group => new Option(group.type.name, group.type.id)));
      field("type").dataset.types = key;
    }
    field("type").value = this.selectedType;
  }

  renderButtons() {
    const busy = this.running || Boolean(this.pending);
    const complete = this.state?.phase === "complete";
    field("step").disabled = busy || complete;
    field("auto").disabled = busy || complete;
    field("pause").disabled = !busy;
    field("new").disabled = !this.worker && !this.bundle && !this.state;
    field("use").disabled = !this.bundle || busy;
    field("test").disabled = !this.bundle || busy;
    field("save").disabled = !this.bundle || busy;
    field("load").disabled = !this.modelStore.saved || busy;
    for (const input of field("settings").elements) input.disabled = Boolean(this.worker);
    const labels = { evaluate: "1. Evaluar población", select: "2. Seleccionar mejores", reproduce: "3. Crear descendientes", complete: "Entrenamiento terminado" };
    field("step").textContent = labels[this.state?.phase ?? "evaluate"];
    field("auto").textContent = this.state ? "Continuar automáticamente" : "Entrenar automáticamente";
  }

  render() {
    this.renderTypePicker();
    this.renderButtons();
    this.refreshPlan();
    const state = this.state;
    const phase = state?.phase;
    const group = this.groups().find(item => item.type.id === this.selectedType);
    const champion = group?.champion;
    field("state").textContent = this.pending ? "PREPARANDO" : phase === "complete" ? "ENTRENAMIENTO TERMINADO"
      : this.running ? "ENTRENANDO" : state ? "EN PAUSA · TU TURNO" : this.bundle ? "CAMPEONES RECUPERADOS" : "LISTO PARA EMPEZAR";
    document.querySelectorAll("[data-training-phase]").forEach(element => {
      if (element.dataset.trainingPhase === phase) element.setAttribute("aria-current", "step");
      else element.removeAttribute("aria-current");
    });
    const explanations = {
      evaluate: this.running ? "Los coches conducen con pesos fijos. Se mide el avance de cada red en todos los mapas y salidas; los colores indican cómo nació."
        : "Esta población está lista. Evalúala para comparar sus redes en las mismas condiciones. Ningún peso cambiará mientras conducen.",
      select: "Evaluación terminada. Compara las puntuaciones y abre el detalle de una red. El siguiente paso elige las élites y los posibles padres dentro de cada tipo.",
      reproduce: "Selección terminada. Las élites pasarán intactas. Los posibles padres producirán copias con pequeñas mutaciones; también entrarán redes nuevas al azar.",
      complete: "Terminó el número de generaciones elegido. Puedes guardar los campeones y comprobar cómo conducen en el mapa reservado, sin cambiar sus pesos.",
    };
    field("explanation").textContent = explanations[phase] ?? (this.bundle
      ? "Has recuperado campeones, no una población en curso. Puedes probarlos o empezar un entrenamiento nuevo con la configuración de arriba."
      : "Empieza con «1. Evaluar población»: al terminar, podrás inspeccionar los resultados antes de seleccionar y crear descendientes.");
    field("generation").textContent = state ? `${state.generation} / ${state.settings.generations}` : "—";
    field("cases").textContent = state ? `${state.completedCases} / ${state.totalCases}` : "0 / 0";
    field("best").textContent = champion ? number(champion.fitness.score) : "—";
    field("laps").textContent = champion ? `${champion.fitness.completed} / ${champion.fitness.attempts}` : "—";
    field("progress").max = state?.totalCases || 1;
    field("progress").value = state?.completedCases || 0;
    field("results-note").textContent = this.bundle
      ? `${this.bundle.champions.length} campeones disponibles, uno por tipo. Guardar conserva pesos y resultados en este navegador. La prueba no modifica ni selecciona redes.`
      : "Tras seleccionar una generación, podrás conducir con el mejor de cada tipo. Guarda los campeones antes de cerrar la página para conservarlos.";
    this.renderPopulation(group);
    this.renderGraphics();
  }

  renderPopulation(group) {
    if (!group) return;
    const candidates = group.population;
    if (!candidates.some(candidate => candidate.id === this.selectedCandidate)) this.selectedCandidate = candidates[0]?.id ?? "";
    const key = JSON.stringify([group.type.id, this.state?.phase, this.readSettings().population, candidates, this.selectedCandidate]);
    if (key === this.tableKey) return;
    this.tableKey = key;
    field("population-title").textContent = `${group.type.name} · ${candidates.length || this.readSettings().population} redes`;
    field("selection-help").textContent = candidates.some(candidate => candidate.selection)
      ? "Selección dentro de este tipo. Pulsa una red para ver sus resultados."
      : "Pulsa una red para ver cómo obtuvo su puntuación.";
    const rows = candidates.map(candidate => {
      const row = document.createElement("tr");
      row.classList.toggle("selected-candidate", candidate.id === this.selectedCandidate);
      const first = document.createElement("td");
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = candidate.id;
      button.setAttribute("aria-label", `Inspeccionar red ${candidate.id}`);
      button.setAttribute("aria-pressed", String(candidate.id === this.selectedCandidate));
      button.addEventListener("click", () => {
        this.selectedCandidate = candidate.id;
        this.renderPopulation(group);
        field("detail").open = true;
        // La tabla se reconstruye al cambiar la selección: devolver el foco al botón.
        field("population-body").querySelector('button[aria-pressed="true"]')?.focus();
      });
      first.append(button);
      row.append(first, cell(ORIGIN_NAMES[candidate.origin]), cell(candidate.parentId ?? "—"), cell(String(candidate.changes)),
        cell(candidate.fitness ? number(candidate.fitness.score) : "—"),
        cell(candidate.fitness ? `${candidate.fitness.completed}/${candidate.fitness.attempts}` : "—"),
        cell(SELECTION_NAMES[candidate.selection] ?? (candidate.fitness ? "Sin seleccionar" : "Por evaluar")));
      return row;
    });
    if (!rows.length) {
      const row = document.createElement("tr");
      const empty = cell("Al empezar, cada fila será una red con sus propios pesos y sesgos aleatorios.");
      empty.colSpan = 7; row.append(empty); rows.push(row);
    }
    field("population-body").replaceChildren(...rows);
    const candidate = candidates.find(item => item.id === this.selectedCandidate);
    this.renderDetail(candidate);
    this.renderMutation(candidate);
  }

  renderDetail(candidate) {
    const results = candidate?.results ?? [];
    field("detail-title").textContent = candidate ? `Por qué puntúa así · ${candidate.id}` : "Desglose de una red";
    field("detail-note").textContent = candidate?.fitness
      ? `75 % × media (${number(candidate.fitness.average)}) + 25 % × peor intento (${number(candidate.fitness.worst)}) = ${number(candidate.fitness.score)} puntos. Mismo peso para cada mapa y salida.`
      : "Los resultados aparecen al acabar cada intento. La puntuación final requiere todos los mapas y salidas.";
    field("detail-body").replaceChildren(...results.map(result => {
      const row = document.createElement("tr");
      row.append(cell(`${result.mapName} · salida ${result.start}`),
        ...["advance", "lap", "time", "collision", "inactivity", "total"].map(key => cell(number(result.score[key]))));
      return row;
    }));
  }

  renderMutation(candidate) {
    const box = field("mutation");
    const heading = document.createElement("strong");
    const explanation = document.createElement("p");
    box.replaceChildren(heading, explanation);
    if (candidate?.example) {
      heading.textContent = `${candidate.parentId} → ${candidate.id} · ${candidate.changes} parámetros mutados`;
      explanation.textContent = `${candidate.example.label}: uno de los cambios, redondeado a 4 decimales. Los parámetros no mutados se copian. El padre conserva todos sus valores.`;
      const calculation = document.createElement("code");
      const { before, delta, after } = candidate.example;
      calculation.textContent = `${number(before, 4)} ${delta < 0 ? "−" : "+"} ${number(Math.abs(delta), 4)} ≈ ${number(after, 4)}`;
      box.append(calculation);
    } else if (candidate?.origin === "elite") {
      heading.textContent = `${candidate.parentId} → ${candidate.id} · 0 cambios`;
      explanation.textContent = "Una copia exacta del campeón. Selecciona una «Copia mutada» de la tabla para ver un cambio real en sus pesos o sesgos.";
    } else {
      heading.textContent = candidate?.origin === "saved" ? "Pesos recuperados" : "¿Dónde está el aprendizaje?";
      explanation.textContent = candidate?.origin === "saved" ? "Esta red conserva exactamente los pesos guardados. Su resultado de entrenamiento aparece en la tabla."
        : "Al seleccionar y reproducir favorecemos los pesos que funcionaron mejor. Los cambios se hacen entre generaciones; la topología se mantiene fija.";
    }
  }

  renderGraphics() {
    const group = this.groups().find(item => item.type.id === this.selectedType);
    const history = group?.history ?? [];
    drawTrainingChart(field("chart"), history);
    field("history-summary").textContent = history.length
      ? `Mejor de ${group.type.name}: ${number(history[0].best)} → ${number(history.at(-1).best)} puntos en ${history.length} ${history.length === 1 ? "generación" : "generaciones"}. Compara varias semillas antes de sacar conclusiones.`
      : this.bundle && !this.state ? "El guardado conserva los campeones y sus resultados, no el historial de la población."
        : "La curva se construye tras cada selección. Mejor puntuación no garantiza aprender un mapa nuevo.";
    const maps = this.setup?.maps ?? this.mapStore.getExperiment().trainingMaps;
    const view = this.state?.phase === "evaluate" ? this.state.view : group?.view;
    const mapIndex = view?.mapIndex ?? 0;
    const map = maps[mapIndex] ?? this.mapStore.get(this.mapStore.state.activeId);
    if (!this.renderer) {
      this.renderer = new Renderer(field("canvas"), null, new Track(map));
      this.renderedMap = mapIndex;
    } else if (this.renderedMap !== mapIndex) {
      this.renderer.setTrack(new Track(map));
      this.renderedMap = mapIndex;
    }
    if (view) {
      this.renderer.drawWorld(view.cars, view.selectedId, true);
      if (view.checkpoint < 32) {
        const context = prepareCanvas(field("canvas"), WORLD_WIDTH, WORLD_HEIGHT);
        context.strokeStyle = "#f5d985";
        context.lineWidth = 4;
        context.setLineDash([10, 6]);
        context.beginPath(); context.moveTo(view.nextGate.a.x, view.nextGate.a.y); context.lineTo(view.nextGate.b.x, view.nextGate.b.y); context.stroke();
        context.setLineDash([]);
      }
      field("case-label").textContent = `${view.typeName} · ${map.name} · salida ${view.start}`;
      field("case-clock").textContent = `${number(view.elapsed)} s`;
      field("live-caption").textContent = `${view.active} redes conduciendo. Líder: ${view.checkpoint}/32 puntos de control. Los coches se superponen porque todos parten del mismo lugar y no chocan entre sí.`;
    } else {
      const context = prepareCanvas(field("canvas"), WORLD_WIDTH, WORLD_HEIGHT);
      context.drawImage(this.renderer.background, 0, 0);
      field("case-label").textContent = `${map.name} · esperando evaluación`;
      field("case-clock").textContent = "0,0 s";
      field("live-caption").textContent = "Cada red hará dos intentos por mapa. La línea amarilla será el siguiente punto de control del líder.";
    }
  }
}
