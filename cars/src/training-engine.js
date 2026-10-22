import { Car } from "./car.js";
import { Track } from "./track.js";
import { NeuralNetwork } from "./neural-network.js";
import { createRandom } from "./geometry.js";
import { copyMap, mapGeometryKey } from "./maps.js";
import { copyTopology, topologySizes, validateTopology } from "./topology.js";
import { cloneNetwork, mutateNetwork, networkData, populationPlan } from "./genetics.js";
import { CourseProgress, EPISODE_SECONDS, STALL_SECONDS, aggregateResults, scoreEpisode } from "./training-score.js";

const STEP = 1 / 60;
const START_POSITIONS = [0, 5];
export const ORIGIN_COLORS = { random: "#ac9ae7", elite: "#f0cd70", mutation: "#73d8bd" };
export const DEFAULT_TRAINING_SETTINGS = { population: 24, generations: 20, mutationRate: 0.12, mutationAmount: 0.2, seed: 42 };

export function validateTrainingSettings(settings) {
  if (!Number.isInteger(settings.population) || settings.population < 8 || settings.population > 64) throw new Error("La población debe tener entre 8 y 64 redes por tipo.");
  if (!Number.isInteger(settings.generations) || settings.generations < 1 || settings.generations > 200) throw new Error("Elige entre 1 y 200 generaciones.");
  if (!Number.isFinite(settings.mutationRate) || settings.mutationRate < 0.01 || settings.mutationRate > 1
    || !Number.isFinite(settings.mutationAmount) || settings.mutationAmount < 0.01 || settings.mutationAmount > 1) throw new Error("La probabilidad y la intensidad de mutación deben estar entre 0,01 y 1.");
  if (!Number.isInteger(settings.seed) || settings.seed < 1 || settings.seed > 2140000000) throw new Error("La semilla debe ser un entero positivo menor que 2140000001.");
}

export function createTrainingSetup(mapStore, topologyState, settings = DEFAULT_TRAINING_SETTINGS) {
  const { trainingMaps, testMap } = mapStore.getExperiment();
  if (!testMap) throw new Error("Reserva un mapa para la prueba final antes de entrenar.");
  if (trainingMaps.some(map => mapGeometryKey(map) === mapGeometryKey(testMap))) throw new Error("La prueba debe tener un trazado distinto al de entrenamiento.");
  const types = topologyState.types.filter(type => topologyState.assignments.includes(type.id)).map(copyTopology);
  // El trabajador ni siquiera recibe el mapa de prueba.
  return { maps: trainingMaps.map(copyMap), types, settings: { ...settings } };
}

export class PopulationEpisode {
  constructor(track, population, type, startIndex, mapIndex, direction = 0) {
    this.track = track;
    this.elapsed = 0;
    this.mapIndex = mapIndex;
    this.startIndex = startIndex;
    this.direction = direction;
    const start = track.getStart(START_POSITIONS[startIndex]);
    // Todos los candidatos reciben exactamente la misma salida; no chocan entre sí.
    this.runners = population.map((individual, index) => {
      const car = new Car(index + 1, ORIGIN_COLORS[individual.origin], start, individual.brain, type);
      car.think(track);
      return { individual, car, progress: new CourseProgress(track, start), stopped: false, stalled: false, lastAdvance: 0, lastDistance: 0, elapsed: 0 };
    });
  }

  step() {
    this.elapsed += STEP;
    for (const runner of this.runners) {
      if (runner.stopped) continue;
      const { car, progress } = runner;
      const previous = { x: car.x, y: car.y };
      car.think(this.track);
      car.move(STEP, this.track);
      // Un salto que termina fuera de la pista no consigue un checkpoint.
      if (!car.crashed) progress.update(previous, car);
      if (progress.bestDistance >= runner.lastDistance + 1) {
        runner.lastAdvance = this.elapsed;
        runner.lastDistance = progress.bestDistance;
      }
      runner.elapsed = this.elapsed;
      runner.stalled = !car.crashed && !progress.finished && this.elapsed - runner.lastAdvance >= STALL_SECONDS;
      runner.stopped = car.crashed || progress.finished || runner.stalled || this.elapsed >= EPISODE_SECONDS;
    }
  }

  get done() { return this.runners.every(runner => runner.stopped); }

  results() {
    return this.runners.map(runner => {
      const result = { mapId: this.track.definition.id, mapName: this.track.name, start: this.startIndex + 1, direction: this.direction, reversed: this.track.definition.reversed,
        progress: runner.progress.fraction, checkpoints: runner.progress.passed, finished: runner.progress.finished,
        crashed: runner.car.crashed, stalled: runner.stalled, elapsed: runner.elapsed };
      return { ...result, score: scoreEpisode(result) };
    });
  }

  view() {
    const leader = this.runners.reduce((best, runner) => runner.progress.bestDistance > best.progress.bestDistance ? runner : best);
    return { mapIndex: this.mapIndex, start: this.startIndex + 1, direction: this.direction, reversed: this.track.definition.reversed, elapsed: this.elapsed,
      active: this.runners.filter(runner => !runner.stopped).length, selectedId: leader.car.id,
      checkpoint: leader.progress.passed, nextGate: leader.progress.nextGate,
      cars: this.runners.map(({ car }) => ({ id: car.id, color: car.color, x: car.x, y: car.y, angle: car.angle,
        crashed: car.crashed, sensor: { rays: car.id === leader.car.id ? car.sensor.rays : [] } })) };
  }
}

export class GeneticTrainer {
  constructor(setup) {
    validateTrainingSettings(setup.settings);
    if (!Array.isArray(setup.maps) || setup.maps.length < 3 || setup.maps.length > 4) throw new Error("Selecciona 3 o 4 mapas de entrenamiento.");
    if (new Set(setup.maps.map(mapGeometryKey)).size !== setup.maps.length) throw new Error("Los mapas de entrenamiento deben tener trazados distintos.");
    if (!Array.isArray(setup.types) || setup.types.length < 1 || setup.types.length > 6) throw new Error("Asigna al menos un tipo a los coches.");
    setup.types.forEach(validateTopology);
    if (new Set(setup.types.map(type => type.id)).size !== setup.types.length) throw new Error("No se puede repetir un tipo de población.");
    this.maps = setup.maps.map(copyMap);
    this.tracks = this.maps.flatMap(map => [new Track(map), new Track({ ...map, reversed: !map.reversed })]);
    this.settings = { ...setup.settings };
    this.plan = populationPlan(this.settings.population);
    this.generation = 1;
    this.phase = "evaluate";
    this.groupIndex = 0;
    this.caseIndex = 0;
    this.completedCases = 0;
    this.lastView = null;
    this.groups = setup.types.map((type, index) => {
      const group = { type: copyTopology(type), random: createRandom(this.settings.seed + index * 1009), population: [], history: [], champion: null, ranking: [] };
      group.population = Array.from({ length: this.settings.population }, (_, slot) => this.randomIndividual(group, slot));
      return group;
    });
    this.beginEpisode();
  }

  individualId(slot) { return `G${this.generation}-${String(slot + 1).padStart(2, "0")}`; }

  randomIndividual(group, slot) {
    return { id: this.individualId(slot), origin: "random", parentId: null, changes: 0, example: null, results: [], fitness: null,
      brain: new NeuralNetwork(topologySizes(group.type), group.random, group.type.activation) };
  }

  beginEpisode() {
    const trackIndex = Math.floor(this.caseIndex / START_POSITIONS.length);
    const mapIndex = Math.floor(trackIndex / 2);
    const startIndex = this.caseIndex % START_POSITIONS.length;
    const group = this.groups[this.groupIndex];
    this.episode = new PopulationEpisode(this.tracks[trackIndex], group.population, group.type, startIndex, mapIndex, trackIndex % 2);
  }

  // Paso 1. Solo conducir y medir: durante una evaluación NO se cambian pesos.
  tick() {
    if (this.phase !== "evaluate") return;
    this.episode.step();
    if (!this.episode.done) return;
    const group = this.groups[this.groupIndex];
    this.episode.results().forEach((result, index) => group.population[index].results.push(result));
    this.completedCases++;
    this.lastView = { ...this.episode.view(), typeId: group.type.id, typeName: group.type.name };
    group.view = this.lastView;
    this.caseIndex++;
    if (this.caseIndex === this.tracks.length * START_POSITIONS.length) {
      group.population.forEach(individual => { individual.fitness = aggregateResults(individual.results); });
      group.ranking = [...group.population].sort((a, b) => b.fitness.score - a.fitness.score || a.id.localeCompare(b.id));
      this.groupIndex++;
      this.caseIndex = 0;
    }
    if (this.groupIndex === this.groups.length) this.phase = "select";
    else this.beginEpisode();
  }

  // Paso 2. Elegir por resultados en TODOS los mapas; cada tipo compite consigo mismo.
  select() {
    if (this.phase !== "select") throw new Error("Primero hay que evaluar la generación completa.");
    for (const group of this.groups) {
      const best = group.ranking[0];
      const average = group.population.reduce((sum, candidate) => sum + candidate.fitness.score, 0) / group.population.length;
      group.history.push({ generation: this.generation, best: best.fitness.score, average, completed: best.fitness.completed });
      if (!group.champion || best.fitness.score > group.champion.fitness.score) {
        group.champion = { id: best.id, generation: this.generation, type: copyTopology(group.type), fitness: { ...best.fitness },
          results: best.results.map(result => ({ ...result, score: { ...result.score } })), network: networkData(best.brain) };
      }
    }
    this.phase = this.generation >= this.settings.generations ? "complete" : "reproduce";
  }

  // Paso 3. Copiar élites intactas, mutar hijos y añadir exploradores aleatorios.
  reproduce() {
    if (this.phase !== "reproduce") throw new Error("Primero hay que seleccionar a los mejores.");
    this.generation++;
    for (const group of this.groups) {
      const next = [];
      for (let slot = 0; slot < this.settings.population; slot++) {
        if (slot < this.plan.elite) {
          const parent = group.ranking[slot];
          next.push({ id: this.individualId(slot), origin: "elite", parentId: parent.id, changes: 0, example: null,
            brain: cloneNetwork(parent.brain, group.type), results: [], fitness: null });
        } else if (slot >= this.settings.population - this.plan.fresh) {
          next.push(this.randomIndividual(group, slot));
        } else {
          const parent = group.ranking[Math.floor(group.random() * this.plan.parents)];
          const mutation = mutateNetwork(parent.brain, group.type, group.random, this.settings.mutationRate, this.settings.mutationAmount);
          next.push({ id: this.individualId(slot), origin: "mutation", parentId: parent.id, ...mutation, results: [], fitness: null });
        }
      }
      group.population = next;
      group.ranking = [];
    }
    this.groupIndex = 0;
    this.caseIndex = 0;
    this.completedCases = 0;
    this.phase = "evaluate";
    this.beginEpisode();
  }

  champions() {
    return { version: 1, maps: this.maps.map(copyMap), settings: { ...this.settings },
      champions: this.groups.filter(group => group.champion).map(group => structuredClone(group.champion)) };
  }

  snapshot() {
    const current = this.groups[this.groupIndex];
    const view = this.phase === "evaluate" ? { ...this.episode.view(), typeId: current.type.id, typeName: current.type.name } : this.lastView;
    return { phase: this.phase, generation: this.generation, settings: this.settings, plan: this.plan,
      completedCases: this.completedCases, totalCases: this.groups.length * this.tracks.length * START_POSITIONS.length, view,
      groups: this.groups.map(group => ({ type: group.type, history: group.history, champion: group.champion, view: group.view,
        population: (group.ranking.length ? group.ranking : group.population).map((candidate, index) => ({
          id: candidate.id, origin: candidate.origin, parentId: candidate.parentId, changes: candidate.changes, example: candidate.example,
          fitness: candidate.fitness, results: candidate.results,
          selection: !["reproduce", "complete"].includes(this.phase) ? null
            : index < this.plan.elite ? "elite" : index < this.plan.parents ? "parent" : "discard",
        })) })) };
  }
}
