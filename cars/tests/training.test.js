import test from "node:test";
import assert from "node:assert/strict";
import { NeuralNetwork } from "../src/neural-network.js";
import { createRandom } from "../src/geometry.js";
import { createDefaultTopologyState, topologySizes } from "../src/topology.js";
import { MapStore } from "../src/map-store.js";
import { BUILT_IN_MAPS, copyMap, mapGeometryKey } from "../src/maps.js";
import { Track } from "../src/track.js";
import { Simulation } from "../src/simulation.js";
import { cloneNetwork, networkData, networkFromData, mutateNetwork, populationPlan } from "../src/genetics.js";
import { CourseProgress, scoreEpisode, aggregateResults, EPISODE_SECONDS, STALL_SECONDS } from "../src/training-score.js";
import { GeneticTrainer, PopulationEpisode, createTrainingSetup, DEFAULT_TRAINING_SETTINGS, validateTrainingSettings } from "../src/training-engine.js";
import { TrainedModelStore, TRAINING_STORAGE_KEY, validateChampions, assertUnseenMap } from "../src/trained-models.js";

function memoryStorage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}

function setup(overrides = {}) {
  return { maps: BUILT_IN_MAPS.slice(0, 3).map(copyMap), types: [createDefaultTopologyState().types[2]],
    settings: { ...DEFAULT_TRAINING_SETTINGS, population: 8, generations: 3, ...overrides } };
}

function evaluate(trainer) {
  let steps = 0;
  while (trainer.phase === "evaluate" && steps++ < 100000) trainer.tick();
  assert.equal(trainer.phase, "select", "la evaluación debe terminar aunque ningún coche avance");
}

function train(configuration = setup()) {
  const trainer = new GeneticTrainer(configuration);
  while (trainer.phase !== "complete") {
    evaluate(trainer);
    trainer.select();
    if (trainer.phase === "reproduce") trainer.reproduce();
  }
  return trainer;
}

test("mutar cambia una copia de pesos y sesgos sin tocar al padre; clonar conserva todos los números", () => {
  const type = createDefaultTopologyState().types[0];
  const parent = new NeuralNetwork(topologySizes(type), createRandom(7), type.activation);
  const before = networkData(parent);
  const child = mutateNetwork(parent, type, createRandom(21), 1, 0.2);
  assert.deepEqual(networkData(parent), before);
  assert.deepEqual(networkData(cloneNetwork(parent, type)), before);
  assert.notDeepEqual(networkData(child.brain), before);
  const expected = parent.layers.reduce((sum, layer) => sum + layer.biases.length + layer.weights.flat().length, 0);
  assert.equal(child.changes, expected);
  assert.equal(child.example.after, child.example.before + child.example.delta);
  child.brain.layers.forEach((layer, index) => {
    const a = [...layer.weights.flat(), ...layer.biases];
    const b = [...parent.layers[index].weights.flat(), ...parent.layers[index].biases];
    a.forEach((value, gene) => assert.ok(Math.abs(value - b[gene]) <= 0.2 + 1e-12));
  });
  const tinyChange = mutateNetwork(parent, type, () => 0.5, 0.01, 0.2);
  assert.equal(tinyChange.changes, 1);
  assert.notDeepEqual(networkData(tinyChange.brain), before);
});

test("guardar y reconstruir una red conserva su inferencia y no comparte matrices", () => {
  for (const type of createDefaultTopologyState().types) {
    const original = new NeuralNetwork(topologySizes(type), createRandom(10), type.activation);
    const data = networkData(original);
    const restored = networkFromData(JSON.parse(JSON.stringify(data)), type);
    const inputs = Array(type.inputs.length).fill(0.75);
    assert.deepEqual(restored.forward(inputs), original.forward(inputs));
    restored.layers[0].weights[0][0] += 1;
    assert.deepEqual(networkData(original), data);
    const malformed = structuredClone(data);
    malformed.layers[0].weights[0][0] = Infinity;
    assert.throws(() => networkFromData(malformed, type), /pesos/);
    assert.throws(() => networkFromData({ ...data, sizes: [1, 1] }, type), /coincide/);
  }
});

test("el progreso cuenta una vuelta en orden, también al invertir el sentido del mapa", () => {
  for (const reversed of [false, true]) {
    const track = new Track({ ...copyMap(BUILT_IN_MAPS[0]), reversed });
    const start = track.getStart(0);
    const progress = new CourseProgress(track, start);
    let previous = start;
    for (let distance = 1; distance <= track.length + 2; distance++) {
      const current = track.poseAt(progress.startDistance + distance);
      progress.update(previous, current);
      previous = current;
    }
    assert.equal(progress.passed, 32);
    assert.equal(progress.fraction, 1);
    assert.equal(progress.finished, true);
  }
});

test("dar marcha atrás, repetir un tramo y saltar puntos de control no regala vueltas", () => {
  const track = new Track();
  const start = track.getStart(0);
  const progress = new CourseProgress(track, start);
  let previous = start;
  for (let distance = 1; distance < track.length; distance++) {
    const current = track.poseAt(progress.startDistance - distance);
    progress.update(previous, current);
    previous = current;
  }
  assert.equal(progress.passed, 0);
  assert.equal(progress.finished, false);
  assert.ok(progress.fraction <= 1 / 32);
  const forward = new CourseProgress(track, start);
  const ahead = track.poseAt(forward.startDistance + forward.spacing / 2);
  forward.update(start, ahead);
  const best = forward.bestDistance;
  for (let i = 0; i < 100; i++) { forward.update(ahead, start); forward.update(start, ahead); }
  assert.equal(forward.bestDistance, best);
  const gate10 = forward.gate(10);
  const before = { x: gate10.x - Math.cos(gate10.angle), y: gate10.y - Math.sin(gate10.angle) };
  const after = { x: gate10.x + Math.cos(gate10.angle), y: gate10.y + Math.sin(gate10.angle) };
  forward.update(before, after);
  assert.equal(forward.passed, 0);
});

test("la puntuación explica avance, vuelta, rapidez y penalizaciones; el peor intento pesa", () => {
  assert.deepEqual(scoreEpisode({ progress: 0.5, finished: false, crashed: true, stalled: false, elapsed: 7 }),
    { advance: 500, lap: 0, time: 0, collision: -25, inactivity: 0, total: 475 });
  assert.equal(scoreEpisode({ progress: 1, finished: true, crashed: false, stalled: false, elapsed: 11 }).total, 1250);
  assert.equal(scoreEpisode({ progress: 0, finished: false, crashed: false, stalled: true, elapsed: 3 }).total, -15);
  assert.deepEqual(aggregateResults([{ score: { total: 100 }, finished: true }, { score: { total: 0 }, finished: false }]),
    { score: 37.5, average: 50, worst: 0, completed: 1, attempts: 2 });
  assert.throws(() => aggregateResults([]));
});

test("todos parten igual y una red inmóvil termina a los tres segundos sin cambiar pesos", () => {
  const type = createDefaultTopologyState().types[0];
  const brain = new NeuralNetwork(topologySizes(type), () => 0.5, type.activation);
  const before = networkData(brain);
  const population = Array.from({ length: 2 }, () => ({ origin: "random", brain: cloneNetwork(brain, type) }));
  const episode = new PopulationEpisode(new Track(), population, type, 0, 0);
  const [first, second] = episode.runners;
  assert.deepEqual(first.car.start, second.car.start);
  while (!episode.done) episode.step();
  assert.ok(episode.elapsed >= STALL_SECONDS && episode.elapsed < STALL_SECONDS + 0.02);
  assert.equal(episode.results()[0].score.total, -15);
  assert.deepEqual(episode.results()[0], episode.results()[1]);
  assert.deepEqual(networkData(population[0].brain), before);
});

test("el mapa reservado nunca forma parte del entrenamiento y los datos quedan congelados", () => {
  const store = new MapStore(memoryStorage());
  const types = createDefaultTopologyState();
  types.assignments.fill(types.types[2].id);
  const config = createTrainingSetup(store, types, { ...DEFAULT_TRAINING_SETTINGS, population: 8 });
  assert.equal(config.maps.length, 4);
  assert.equal(config.types.length, 1);
  assert.equal(config.types[0].id, types.types[2].id);
  assert.ok(!JSON.stringify(config).includes(store.state.testId));
  const trainer = new GeneticTrainer(config);
  const initial = structuredClone(trainer.maps);
  config.maps[0].points[0].x += 10;
  config.types[0].hidden[0] = 15;
  assert.deepEqual(trainer.maps, initial);
  assert.notEqual(trainer.groups[0].type.hidden[0], 15);
  const noTest = { getExperiment: () => ({ trainingMaps: config.maps, testMap: null }) };
  assert.throws(() => createTrainingSetup(noTest, types), /Reserva/);
});

test("selección y reproducción son fases separadas, con élites intactas y descendencia del mismo tipo", () => {
  const config = setup({ generations: 2 });
  config.types = createDefaultTopologyState().types;
  const trainer = new GeneticTrainer(config);
  assert.throws(() => trainer.select(), /evaluar/);
  assert.throws(() => trainer.reproduce(), /seleccionar/);
  evaluate(trainer);
  assert.equal(trainer.completedCases, 18);
  assert.ok(trainer.snapshot().groups.every(group => group.population.every(candidate => candidate.selection === null)));
  assert.ok(trainer.snapshot().groups.every(group => group.view.typeId === group.type.id && group.view.active === 0));
  const originals = trainer.groups.map(group => group.ranking.map(candidate => ({ id: candidate.id, brain: networkData(candidate.brain) })));
  trainer.groups.forEach(group => group.population.forEach(candidate => {
    assert.equal(candidate.results.length, 6);
    assert.ok(candidate.results.every(result => result.elapsed <= EPISODE_SECONDS + 0.02));
  }));
  trainer.select();
  const bundle = trainer.champions();
  assert.equal(bundle.champions.length, 3);
  assert.equal(trainer.phase, "reproduce");
  const plan = populationPlan(8);
  for (const group of trainer.snapshot().groups) assert.equal(group.population.filter(item => item.selection === "elite").length, plan.elite);
  trainer.reproduce();
  assert.equal(trainer.phase, "evaluate");
  assert.equal(trainer.generation, 2);
  trainer.groups.forEach((group, index) => {
    const population = group.population;
    assert.deepEqual(networkData(population[0].brain), originals[index][0].brain);
    assert.equal(population.filter(candidate => candidate.origin === "random").length, plan.fresh);
    for (const child of population.filter(candidate => candidate.origin === "mutation")) {
      const parent = originals[index].slice(0, plan.parents).find(candidate => candidate.id === child.parentId);
      assert.ok(parent);
      assert.ok(child.changes > 0);
      assert.notDeepEqual(networkData(child.brain), parent.brain);
      assert.deepEqual(child.brain.sizes, topologySizes(group.type));
    }
  });
  assert.deepEqual(trainer.champions(), bundle, "los hijos no alteran al campeón archivado");
});

// Reutilizar este experimento entre comprobaciones: evita repetir carreras sin necesidad.
const experiment = train();

test("la misma semilla reproduce resultados; el elitismo conserva al mejor entre generaciones", () => {
  const repeated = train();
  assert.deepEqual(repeated.champions(), experiment.champions());
  assert.deepEqual(repeated.groups[0].history, experiment.groups[0].history);
  const history = experiment.groups[0].history;
  assert.equal(history.length, 3);
  for (let i = 1; i < history.length; i++) assert.ok(history[i].best >= history[i - 1].best);
  const other = new GeneticTrainer(setup({ seed: 99 }));
  assert.notDeepEqual(networkData(other.groups[0].population[0].brain), new GeneticTrainer(setup()).groups[0].population[0].brain);
});

test("la validación rechaza poblaciones, mapas y presupuestos imposibles", () => {
  for (const override of [{ population: 0 }, { population: 65 }, { generations: 0 }, { generations: 1.5 }, { generations: 201 }, { seed: NaN }, { mutationRate: 0 }, { mutationAmount: Infinity }]) {
    assert.throws(() => validateTrainingSettings({ ...DEFAULT_TRAINING_SETTINGS, ...override }));
  }
  assert.throws(() => new GeneticTrainer({ ...setup(), maps: BUILT_IN_MAPS.slice(0, 2) }), /3 o 4/);
  assert.throws(() => new GeneticTrainer({ ...setup(), maps: Array(3).fill(BUILT_IN_MAPS[0]) }), /distintos/);
  assert.throws(() => new GeneticTrainer({ ...setup(), types: [] }), /Asigna/);
});

test("la prueba reservada rechaza cualquier trazado ya visto, aunque cambie nombre, salida o sentido", () => {
  const bundle = experiment.champions();
  assert.doesNotThrow(() => assertUnseenMap(bundle, BUILT_IN_MAPS[4]));
  const seen = { ...copyMap(bundle.maps[0]), id: "otro-id", name: "Disfrazado", startIndex: 1, reversed: true };
  assert.equal(mapGeometryKey(seen), mapGeometryKey(bundle.maps[0]));
  assert.throws(() => assertUnseenMap(bundle, seen), /ya se usó/);
});

test("aplicar campeones a los coches conserva sus pesos al reiniciar o cambiar de mapa", () => {
  const bundle = experiment.champions();
  const type = bundle.champions[0].type;
  const state = { version: 1, types: [type], assignments: Array(6).fill(type.id) };
  const simulation = new Simulation(4, BUILT_IN_MAPS[0], state);
  simulation.applyChampions(bundle);
  const expected = bundle.champions[0].network;
  simulation.cars.forEach(car => assert.deepEqual(networkData(car.brain), expected));
  assert.notEqual(simulation.cars[0].brain.layers[0].weights, simulation.cars[1].brain.layers[0].weights);
  for (let i = 0; i < 300; i++) simulation.step();
  simulation.reset();
  simulation.setMap(BUILT_IN_MAPS[4]);
  simulation.cars.forEach(car => assert.deepEqual(networkData(car.brain), expected));
  assert.equal(simulation.cars[0].trainingInfo.generation, bundle.champions[0].generation);
  const incompatible = new Simulation();
  const before = incompatible.cars.map(car => networkData(car.brain));
  assert.throws(() => incompatible.applyChampions(bundle), /no coincide/);
  assert.deepEqual(incompatible.cars.map(car => networkData(car.brain)), before);
});

test("guardar, recargar y validar campeones conserva pesos y resultados sin fingir éxito al fallar", () => {
  const storage = memoryStorage();
  const store = new TrainedModelStore(storage);
  const bundle = experiment.champions();
  store.save(bundle);
  const restored = new TrainedModelStore(storage);
  assert.deepEqual(restored.saved.champions, bundle.champions);
  assert.deepEqual(restored.saved.maps, bundle.maps);
  assert.doesNotThrow(() => validateChampions(restored.saved));
  const failed = new TrainedModelStore({ getItem: () => null, setItem: () => { throw new Error("sin espacio"); } });
  assert.throws(() => failed.save(bundle), /espacio/);
  assert.equal(failed.saved, null);
  for (const corrupt of [
    data => { data.champions[0].network.layers[0].weights[0][0] = null; },
    data => { data.champions[0].fitness.completed = 900; },
    data => { data.champions[0].results[0].score.total += 50; },
    data => { data.champions[0].results[0].elapsed = -1; },
    data => { data.champions[0].results[0] = structuredClone(data.champions[0].results[1]); },
  ]) {
    const broken = structuredClone(bundle);
    corrupt(broken);
    const original = JSON.stringify(broken);
    storage.setItem(TRAINING_STORAGE_KEY, original);
    const invalid = new TrainedModelStore(storage);
    assert.equal(invalid.saved, null);
    assert.ok(invalid.warning);
    assert.throws(() => invalid.save(bundle));
    assert.equal(storage.getItem(TRAINING_STORAGE_KEY), original);
  }
});
