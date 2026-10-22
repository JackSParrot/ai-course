import { BUILT_IN_MAPS, DEFAULT_TRAINING_IDS, copyMap, mapGeometryKey } from "./maps.js";
import { Track } from "./track.js";

export const MAP_STORAGE_KEY = "neural-racing.maps.v1";
const BUILT_IN_IDS = BUILT_IN_MAPS.map(map => map.id);

function initialState() {
  return { version: 1, maps: BUILT_IN_MAPS.map(copyMap),
    trainingIds: [...DEFAULT_TRAINING_IDS], testId: "reserve", activeId: "oval" };
}

function cloneState(state) {
  return { ...state, maps: state.maps.map(copyMap), trainingIds: [...state.trainingIds] };
}

export function validateMapState(state) {
  if (!state || state.version !== 1 || !Array.isArray(state.maps) || state.maps.length < 1 || state.maps.length > 55) throw new Error("La biblioteca de mapas no es válida.");
  const ids = new Set();
  for (const map of state.maps) {
    if (!map.id || ids.has(map.id)) throw new Error("Hay identificadores de mapa duplicados o vacíos.");
    new Track(map);
    ids.add(map.id);
  }
  if (!Array.isArray(state.trainingIds) || state.trainingIds.length > 4 || new Set(state.trainingIds).size !== state.trainingIds.length || state.trainingIds.some(id => !ids.has(id))) throw new Error("Selecciona como máximo 4 mapas de entrenamiento distintos.");
  if (!ids.has(state.activeId) || (state.testId !== null && !ids.has(state.testId))) throw new Error("Falta un mapa seleccionado en la biblioteca.");
  if (state.trainingIds.includes(state.testId)) throw new Error("El mapa de prueba no puede estar en entrenamiento.");
  const trainingKeys = state.trainingIds.map(id => mapGeometryKey(state.maps.find(map => map.id === id)));
  if (new Set(trainingKeys).size !== trainingKeys.length) throw new Error("Dos mapas de entrenamiento tienen el mismo trazado. Elige circuitos distintos.");
  const test = state.maps.find(map => map.id === state.testId);
  if (test && trainingKeys.includes(mapGeometryKey(test))) throw new Error("Ese trazado ya está en entrenamiento o en prueba. Una copia con otro nombre no cuenta como mapa nuevo.");
}

function assignPurpose(state, id, purpose) {
  if (!["training", "test", "practice"].includes(purpose)) throw new Error("El uso del mapa no es válido.");
  if (!state.maps.some(map => map.id === id)) throw new Error("No se encuentra ese mapa.");
  state.trainingIds = state.trainingIds.filter(candidate => candidate !== id);
  if (state.testId === id) state.testId = null;
  if (purpose === "training") state.trainingIds.push(id);
  // Al reservar otra prueba, la anterior queda como mapa libre.
  if (purpose === "test") state.testId = id;
}

export class MapStore {
  constructor(storage) {
    this.storage = storage;
    this.state = initialState();
    this.warning = "";
    this.readOnly = false;
    try {
      const saved = storage?.getItem(MAP_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        validateMapState(parsed);
        this.state = cloneState(parsed);
        const missing = BUILT_IN_MAPS.filter(map => !this.state.maps.some(saved => saved.id === map.id));
        // Upgrade the old default selection, while retaining custom plans and all saved maps.
        const oldDefault = ["oval", "triangle", "sweep", "rectangle"];
        if (missing.some(map => DEFAULT_TRAINING_IDS.includes(map.id)) && this.state.trainingIds.length === 4
          && oldDefault.every(id => this.state.trainingIds.includes(id))) this.state.trainingIds = [...DEFAULT_TRAINING_IDS];
        this.state.maps.push(...missing.map(copyMap));
        validateMapState(this.state);
      }
    } catch {
      // Conservar los datos originales si no se pueden leer; no sobrescribirlos.
      this.readOnly = true;
      this.warning = "No se ha podido leer la biblioteca guardada. Tus datos se conservan; puedes usar la simulación y exportar tus diseños.";
    }
    if (!storage) this.warning = "El navegador no permite guardar aquí. Puedes diseñar y exportar un mapa para conservarlo.";
  }

  commit(next) {
    validateMapState(next);
    if (!this.storage || this.readOnly) throw new Error("No se puede guardar en este navegador. Exporta el mapa para conservarlo.");
    // Guardar antes de cambiar el estado: si falta espacio, no fingir éxito.
    try { this.storage.setItem(MAP_STORAGE_KEY, JSON.stringify(next)); }
    catch { throw new Error("No hay espacio o permiso para guardar. Exporta el mapa para conservarlo."); }
    this.state = next;
  }

  list() { return this.state.maps.map(copyMap); }
  get(id) { const map = this.state.maps.find(map => map.id === id); return map ? copyMap(map) : null; }
  isBuiltIn(id) { return BUILT_IN_IDS.includes(id); }
  purpose(id) { return this.state.trainingIds.includes(id) ? "training" : this.state.testId === id ? "test" : "practice"; }

  select(id) {
    const next = cloneState(this.state);
    next.activeId = id;
    this.commit(next);
  }

  setPurpose(id, purpose) {
    const next = cloneState(this.state);
    assignPurpose(next, id, purpose);
    this.commit(next);
  }

  saveMap(map, purpose = "practice") {
    const next = cloneState(this.state);
    const saved = copyMap(map);
    saved.name = saved.name.trim();
    if (!saved.id) saved.id = `custom-${crypto.randomUUID()}`;
    if (this.isBuiltIn(saved.id)) throw new Error("Las plantillas se guardan como un mapa nuevo.");
    const index = next.maps.findIndex(candidate => candidate.id === saved.id);
    if (index >= 0) next.maps[index] = saved;
    else next.maps.push(saved);
    assignPurpose(next, saved.id, purpose);
    next.activeId = saved.id;
    this.commit(next);
    return copyMap(saved);
  }

  // El entrenador recibe únicamente trainingMaps. La prueba va separada.
  getExperiment() {
    return { trainingMaps: this.state.trainingIds.map(id => this.get(id)), testMap: this.get(this.state.testId) };
  }
}

export function serializeMap(map) {
  new Track(map);
  return JSON.stringify({ format: "neural-racing-map", version: 1, map: copyMap(map) }, null, 2);
}

export function parseMap(text) {
  if (typeof text !== "string" || text.length > 200000) throw new Error("El archivo es demasiado grande. El límite es 200 KB.");
  let parsed;
  try { parsed = JSON.parse(text); }
  catch { throw new Error("El archivo no contiene JSON válido."); }
  if (parsed?.format !== "neural-racing-map" || parsed.version !== 1) throw new Error("Selecciona un archivo de mapa exportado desde Neural Racing.");
  new Track(parsed.map);
  return { ...copyMap(parsed.map), id: "" };
}
