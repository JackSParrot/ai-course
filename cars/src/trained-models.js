import { Track } from "./track.js";
import { mapGeometryKey } from "./maps.js";
import { validateTopology, topologyKey } from "./topology.js";
import { networkFromData } from "./genetics.js";
import { validateTrainingSettings } from "./training-engine.js";
import { aggregateResults, scoreEpisode, EPISODE_SECONDS } from "./training-score.js";

export const TRAINING_STORAGE_KEY = "neural-racing.champions.v1";

export function validateChampions(bundle) {
  if (!bundle || bundle.version !== 1 || !Array.isArray(bundle.maps) || bundle.maps.length < 3 || bundle.maps.length > 4
    || !Array.isArray(bundle.champions) || !bundle.champions.length || bundle.champions.length > 6) throw new Error("El archivo de campeones no es válido.");
  validateTrainingSettings(bundle.settings);
  bundle.maps.forEach(map => new Track(map));
  if (new Set(bundle.maps.map(mapGeometryKey)).size !== bundle.maps.length) throw new Error("Los mapas del entrenamiento se repiten.");
  const ids = new Set();
  for (const champion of bundle.champions) {
    validateTopology(champion.type);
    if (ids.has(champion.type.id)) throw new Error("Hay campeones repetidos para el mismo tipo.");
    ids.add(champion.type.id);
    networkFromData(champion.network, champion.type);
    const bidirectional = Array.isArray(champion.results) && champion.results.some(result => result.direction !== undefined);
    if (typeof champion.id !== "string" || !champion.id || champion.id.length > 64
      || !Number.isInteger(champion.generation) || champion.generation < 1 || champion.generation > bundle.settings.generations
      || !Number.isFinite(champion.fitness?.score) || !Array.isArray(champion.results) || champion.results.length !== bundle.maps.length * (bidirectional ? 4 : 2)) throw new Error("Los resultados del campeón están incompletos.");
    const attempts = new Set();
    for (const result of champion.results) {
      const key = `${result.mapId}:${result.direction ?? 0}:${result.start}`;
      const map = bundle.maps.find(map => map.id === result.mapId);
      if (bidirectional && (![0, 1].includes(result.direction) || typeof result.reversed !== "boolean"
        || result.reversed !== (result.direction === 1 ? !map?.reversed : map?.reversed))) throw new Error("El sentido de un intento guardado no es válido.");
      if (!bundle.maps.some(map => map.id === result.mapId && map.name === result.mapName) || ![1, 2].includes(result.start) || attempts.has(key)
        || !Number.isFinite(result.progress) || result.progress < 0 || result.progress > 1
        || !Number.isInteger(result.checkpoints) || result.checkpoints < 0 || result.checkpoints > 32
        || [result.finished, result.crashed, result.stalled].some(flag => typeof flag !== "boolean")
        || Number(result.finished) + Number(result.crashed) + Number(result.stalled) > 1
        || result.finished !== (result.checkpoints === 32) || (result.finished && result.progress !== 1)
        || !Number.isFinite(result.elapsed) || result.elapsed <= 0 || result.elapsed > EPISODE_SECONDS + 1 / 60 + 0.000001) throw new Error("Los intentos guardados no son válidos.");
      const calculated = scoreEpisode(result);
      if (Object.keys(calculated).some(name => !Number.isFinite(result.score?.[name]) || Math.abs(calculated[name] - result.score[name]) > 0.000001)) throw new Error("La puntuación guardada no coincide con sus resultados.");
      attempts.add(key);
    }
    const fitness = aggregateResults(champion.results);
    if (Object.keys(fitness).some(name => !Number.isFinite(champion.fitness[name]) || Math.abs(fitness[name] - champion.fitness[name]) > 0.000001)) throw new Error("El resumen del campeón no coincide con sus intentos.");
  }
}

export function championForType(bundle, type) {
  return bundle.champions.find(champion => champion.type.id === type.id && topologyKey(champion.type) === topologyKey(type));
}

export function assertUnseenMap(bundle, map) {
  if (!map) throw new Error("Reserva un mapa de prueba en la biblioteca.");
  if (bundle.maps.some(trainingMap => mapGeometryKey(trainingMap) === mapGeometryKey(map))) throw new Error("Este trazado ya se usó para entrenar estos campeones. Reserva otro mapa para una prueba nueva.");
}

export class TrainedModelStore {
  constructor(storage) {
    this.storage = storage;
    this.saved = null;
    this.warning = "";
    this.readOnly = false;
    try {
      const text = storage?.getItem(TRAINING_STORAGE_KEY);
      if (text) {
        const bundle = JSON.parse(text);
        validateChampions(bundle);
        this.saved = bundle;
      }
    } catch {
      this.readOnly = true;
      this.warning = "No se pudieron leer los campeones guardados. Se mantienen los datos originales.";
    }
  }

  save(bundle) {
    validateChampions(bundle);
    if (!this.storage || this.readOnly) throw new Error("No se pueden guardar campeones en este navegador.");
    const next = structuredClone(bundle);
    next.savedAt = new Date().toISOString();
    try { this.storage.setItem(TRAINING_STORAGE_KEY, JSON.stringify(next)); }
    catch { throw new Error("No hay espacio o permiso para guardar los campeones."); }
    this.saved = next;
  }
}
