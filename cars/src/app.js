import { getLanguage } from '../../i18n/i18n.js';
import { Simulation, FIXED_STEP } from "./simulation.js";
import { CONTROL_NAMES, CONTROL_LABELS } from "./controls.js";
import { SENSOR_HOURS, SENSOR_LENGTH } from "./sensor.js";
import { Renderer } from "./renderer.js";
import { WORLD_WIDTH, WORLD_HEIGHT } from "./track.js";
import { MapStore } from "./map-store.js";
import { MapUI } from "./map-ui.js";
import { TopologyStore } from "./topology-store.js";
import { TopologyEditor } from "./topology-editor.js";
import { OUTPUT_OPTIONS, activeOutputIndexes } from "./topology.js";
import { TrainingUI } from "./training-ui.js";
import { TrainedModelStore, assertUnseenMap, championForType, validateChampions } from "./trained-models.js";

let storage = null;
try { storage = window.localStorage; } catch { /* El editor permitirá exportar si el guardado está bloqueado. */ }
const mapStore = new MapStore(storage);
const topologyStore = new TopologyStore(storage);
const modelStore = new TrainedModelStore(storage);
const simulation = new Simulation(4, mapStore.get(mapStore.state.activeId), topologyStore.state);
const trackCanvas = document.querySelector("#track-canvas");
const renderer = new Renderer(trackCanvas, document.querySelector("#network-canvas"), simulation.track);
const playButton = document.querySelector("#play-button");
const stepButton = document.querySelector("#step-button");
const showSensors = document.querySelector("#show-sensors");
const carPicker = document.querySelector("#car-picker");
const announcement = document.querySelector("#announcement");

let selectedId = 1;
let playing = false;
let simulationSpeed = 1;
let accumulator = 0;
let previousTime = null;
let lastPanelUpdate = 0;
let inspectedTopology = "";
let inputElements = [];
let outputElements = [];
let trainingUI = null;

// Crear los elementos repetidos una sola vez. Después solo cambian sus valores.
for (const car of simulation.cars) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "car-pick";
  button.style.setProperty("--car-color", car.color);
  button.setAttribute("aria-label", `Seleccionar coche ${car.id}`);
  button.innerHTML = `<i aria-hidden="true"></i>${String(car.id).padStart(2, "0")}`;
  button.addEventListener("click", () => selectCar(car.id));
  carPicker.append(button);
}

const sensorElements = SENSOR_HOURS.map(hour => {
  const element = document.createElement("div");
  element.className = "sensor-reading";
  element.innerHTML = `<span class="sensor-hour">${hour} h</span><div class="sensor-bar"><div class="sensor-bar-fill"></div></div><output class="sensor-value">0,00</output>`;
  document.querySelector("#sensor-readings").append(element);
  return { element, fill: element.querySelector(".sensor-bar-fill"), value: element.querySelector("output") };
});

const symbols = ["↑", "↓", "←", "→"];
const controlElements = CONTROL_NAMES.map((name, index) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "control-button";
  // Estos botones los pulsa la red, no la persona que observa.
  button.disabled = true;
  button.setAttribute("aria-pressed", "false");
  button.innerHTML = `<span class="control-symbol" aria-hidden="true">${symbols[index]}</span>${CONTROL_LABELS[index]}<span class="control-value">0,00</span>`;
  document.querySelector("#control-buttons").append(button);
  return { button, value: button.querySelector(".control-value"), name };
});

function decimal(value) {
  return getLanguage() === "en" ? value.toFixed(2) : value.toFixed(2).replace(".", ",");
}

function prepareInspector(car) {
  const key = JSON.stringify(car.topology);
  if (key === inspectedTopology) return;
  inspectedTopology = key;
  const inputs = document.querySelector("#input-values");
  inputs.replaceChildren();
  inputElements = car.inputs.map((input, index) => {
    const row = document.createElement("tr");
    const label = document.createElement("td");
    label.textContent = `${index + 1}. ${input.label}`;
    const mode = document.createElement("span");
    mode.className = "input-mode";
    mode.textContent = input.mode === "raw" ? "ABS" : "0–1";
    label.append(mode);
    const raw = document.createElement("td");
    const value = document.createElement("td");
    row.append(label, raw, value);
    inputs.append(row);
    return { raw, value };
  });
  const outputs = document.querySelector("#output-values");
  outputs.replaceChildren();
  outputElements = car.topology.outputs.map((id, index) => {
    const row = document.createElement("div");
    row.className = "output-row";
    const indicator = document.createElement("i");
    indicator.className = "output-indicator";
    indicator.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.textContent = `${index + 1}. ${OUTPUT_OPTIONS.find(option => option.id === id).label}`;
    const value = document.createElement("strong");
    row.append(indicator, label, value);
    outputs.append(row);
    return { row, value };
  });
}

function selectCar(id) {
  selectedId = id;
  announcement.textContent = `Coche ${id} seleccionado.`;
  render();
}

function updatePlayback() {
  const allCrashed = simulation.cars.every(car => car.crashed);
  playButton.querySelector("use").setAttribute("href", playing ? "#pause" : "#play");
  playButton.querySelector("span").textContent = playing ? "Pausar" : simulation.elapsed > 0 ? "Continuar" : "Iniciar";
  playButton.setAttribute("aria-label", playing ? "Pausar simulación" : "Iniciar o continuar simulación");
  playButton.disabled = allCrashed;
  stepButton.disabled = playing || allCrashed;
  const state = document.querySelector("#run-state");
  state.textContent = allCrashed ? "FIN DE LA PRUEBA" : playing ? "EN MARCHA" : "EN PAUSA";
  state.classList.toggle("running", playing);
}

function updatePanel() {
  const car = simulation.cars.find(candidate => candidate.id === selectedId);
  prepareInspector(car);
  const number = String(car.id).padStart(2, "0");
  document.documentElement.style.setProperty("--selected", car.color);
  document.querySelector("#selected-label").textContent = number;
  document.querySelector("#car-name").textContent = `Coche ${number}`;
  document.querySelector("#car-type-name").textContent = car.topology.name;
  document.querySelector("#race-network-note").textContent = car.trainingInfo
    ? `Coche ${car.id}: campeón de la generación ${car.trainingInfo.generation} · ${decimal(car.trainingInfo.score)} puntos de entrenamiento. Pesos fijos. Reiniciar los conserva; Nuevas redes los sustituye por valores aleatorios.`
    : "Este coche usa una red aleatoria. Entrena arriba y aplica los campeones para comprobar lo que han aprendido.";
  document.querySelector("#input-count").textContent = `${car.inputs.length} ENTRADAS`;
  document.querySelector("#output-count").textContent = `${car.outputs.length} SALIDAS`;
  document.querySelector(".architecture").textContent = car.brain.sizes.join(" → ");
  document.querySelector("#network-description").textContent = `${car.brain.activation === "relu" ? "ReLU · valores sin límite superior" : "Sigmoide · valores de 0 a 1"}. E: entradas · C: ocultas · S: salidas. El color se satura en 1.`;
  document.querySelectorAll(".selected-number").forEach(element => { element.textContent = number; });
  document.querySelector("#car-state").textContent = car.crashed ? "Ha tocado el borde" : car.speed > 0 ? "En movimiento" : "Detenido";

  const tenths = Math.floor(simulation.elapsed * 10 + 0.000001);
  const minutes = Math.floor(tenths / 600).toString().padStart(2, "0");
  const seconds = Math.floor(tenths / 10 % 60).toString().padStart(2, "0");
  document.querySelector("#elapsed").textContent = `${minutes}:${seconds}.${tenths % 10}`;
  document.querySelector("#active-cars").textContent = simulation.cars.filter(candidate => !candidate.crashed).length;
  document.querySelector("#car-speed").textContent = Math.round(car.speed);
  document.querySelector("#car-distance").textContent = Math.round(car.distance);

  [...carPicker.children].forEach((button, index) => {
    button.setAttribute("aria-pressed", String(index + 1 === selectedId));
    button.classList.toggle("crashed", simulation.cars[index].crashed);
  });
  sensorElements.forEach(({ element, fill, value }, index) => {
    const reading = car.sensor.distances[index];
    const used = car.topology.inputs.some(input => input.id === `sensor-${SENSOR_HOURS[index]}`);
    element.classList.toggle("unused", !used);
    fill.style.height = `${reading / SENSOR_LENGTH * 100}%`;
    value.textContent = reading.toFixed(0);
    element.setAttribute("aria-label", `Sensor ${SENSOR_HOURS[index]} horas: distancia ${decimal(reading)}. ${used ? "Entrada de la red" : "No llega a la red"}.`);
  });
  inputElements.forEach(({ raw, value }, index) => {
    const input = car.inputs[index];
    raw.textContent = `${decimal(input.raw)} ${input.unit}`;
    value.textContent = decimal(input.value);
  });
  const activeOutputs = activeOutputIndexes(car.outputs, car.topology.outputMode);
  outputElements.forEach(({ row, value }, index) => {
    row.classList.toggle("active", !car.crashed && activeOutputs.includes(index));
    value.textContent = decimal(car.outputs[index]);
  });
  controlElements.forEach(({ button, value, name }, index) => {
    const pressed = car.controls[name];
    button.setAttribute("aria-pressed", String(pressed));
    button.setAttribute("aria-label", `${CONTROL_LABELS[index]}: ${pressed ? "pulsado" : "sin pulsar"}.`);
    value.textContent = pressed ? "Pulsado" : "Libre";
  });
  document.querySelector("#control-hint").textContent = car.crashed
    ? "Coche detenido por colisión. Sus botones están desactivados."
    : car.topology.outputMode === "winner"
      ? "Solo actúa la salida de mayor valor positivo. En un empate gana la primera; todo ceros deja los botones libres."
      : "Cada salida > 0,50 activa su acción. El freno prevalece sobre el acelerador; los giros opuestos se cancelan.";
  renderer.drawNetwork(car.brain, car.topology);
  updatePlayback();
}

function render() {
  renderer.drawWorld(simulation.cars, selectedId, showSensors.checked);
  updatePanel();
}

playButton.addEventListener("click", () => {
  playing = !playing;
  accumulator = 0;
  previousTime = null;
  render();
  announcement.textContent = playing ? "Simulación en marcha." : "Simulación en pausa.";
});

stepButton.addEventListener("click", () => {
  simulation.step();
  render();
  announcement.textContent = "Avanzado un paso de 1/60 de segundo.";
});

document.querySelector("#reset-button").addEventListener("click", () => {
  playing = false;
  accumulator = 0;
  simulation.reset();
  render();
  announcement.textContent = "Coches en la salida. Se conservan las mismas redes.";
});

document.querySelector("#randomize-button").addEventListener("click", () => {
  playing = false;
  accumulator = 0;
  simulation.createCars(1 + Math.floor(Math.random() * 2147483646));
  render();
  announcement.textContent = "Seis nuevas redes aleatorias. Coches en la salida.";
});

document.querySelector("#simulation-speed").addEventListener("change", event => {
  simulationSpeed = Number(event.target.value);
});
showSensors.addEventListener("change", render);

// También se puede seleccionar un coche directamente sobre el circuito.
trackCanvas.addEventListener("click", event => {
  const bounds = trackCanvas.getBoundingClientRect();
  const x = (event.clientX - bounds.left) * WORLD_WIDTH / bounds.width;
  const y = (event.clientY - bounds.top) * WORLD_HEIGHT / bounds.height;
  const nearest = [...simulation.cars].sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
  if (Math.hypot(nearest.x - x, nearest.y - y) < 35) selectCar(nearest.id);
});

// Evitar saltos de tiempo al volver de otra pestaña.
document.addEventListener("visibilitychange", () => {
  previousTime = null;
  accumulator = 0;
  if (document.hidden) {
    playing = false;
    updatePlayback();
  }
});
window.addEventListener("resize", render);
document.addEventListener("languagechange", () => {
  render();
  if (topologyEditor.dialog.open) topologyEditor.updatePreview();
});

function frame(time) {
  const elapsed = previousTime === null ? 0 : Math.min((time - previousTime) / 1000, 0.1);
  previousTime = time;

  if (playing) {
    accumulator += elapsed * simulationSpeed;
    while (accumulator >= FIXED_STEP) {
      simulation.step();
      accumulator -= FIXED_STEP;
    }
    if (simulation.cars.every(car => car.crashed)) {
      playing = false;
      announcement.textContent = "Todos los coches han tocado el borde. Reinicia o crea nuevas redes.";
    }
    renderer.drawWorld(simulation.cars, selectedId, showSensors.checked);
    // Los números del panel se actualizan 10 veces por segundo para facilitar la lectura.
    if (time - lastPanelUpdate > 100 || !playing) {
      updatePanel();
      lastPanelUpdate = time;
    }
  }
  requestAnimationFrame(frame);
}

function pauseSimulation() {
  playing = false;
  accumulator = 0;
  previousTime = null;
  render();
}

function changeMap(map) {
  pauseSimulation();
  simulation.setMap(map);
  renderer.setTrack(simulation.track);
  trackCanvas.setAttribute("aria-label", `Circuito ${map.name} con seis coches. Los cinco rayos muestran los sensores del coche seleccionado.`);
  render();
}

function pauseForEditor() {
  pauseSimulation();
  trainingUI?.pause();
}

const mapUI = new MapUI(mapStore, changeMap, pauseForEditor, () => trainingUI?.refreshPlan());

const topologyEditor = new TopologyEditor(topologyStore, state => {
  const changed = simulation.setTopologies(state);
  trainingUI?.refreshPlan();
  render();
  return changed;
}, pauseForEditor);
document.querySelector("#edit-selected-topology").addEventListener("click", () => {
  topologyEditor.open(simulation.cars.find(car => car.id === selectedId).topology.id);
});

function useChampions(bundle) {
  pauseSimulation();
  simulation.applyChampions(bundle);
  render();
  announcement.textContent = "Campeones aplicados. Pulsa Iniciar para conducir con sus pesos fijos.";
  document.querySelector("#carrera").scrollIntoView({ behavior: "smooth", block: "start" });
}

trainingUI = new TrainingUI(mapStore, topologyStore, modelStore, {
  pauseRace: pauseSimulation,
  use: useChampions,
  test: bundle => {
    const { testMap } = mapStore.getExperiment();
    assertUnseenMap(bundle, testMap);
    validateChampions(bundle);
    // Validar la compatibilidad antes de cambiar el mapa o los pesos de la carrera.
    if (simulation.cars.some(car => !championForType(bundle, car.topology))) {
      throw new Error("Las topologías de la carrera han cambiado. Usa las del entrenamiento o entrena de nuevo.");
    }
    mapStore.select(testMap.id);
    changeMap(testMap);
    mapUI.render();
    useChampions(bundle);
    announcement.textContent = `Prueba reservada en ${testMap.name}. Pulsa Iniciar: sus resultados no se usan para aprender.`;
  },
});

trackCanvas.setAttribute("aria-label", `Circuito ${simulation.track.name} con seis coches. Los cinco rayos muestran los sensores del coche seleccionado.`);
render();
requestAnimationFrame(frame);

matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  render();
  if (topologyEditor.dialog.open) topologyEditor.updatePreview();
});
