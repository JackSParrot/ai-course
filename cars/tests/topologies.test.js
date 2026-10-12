import test from "node:test";
import assert from "node:assert/strict";
import { NeuralNetwork } from "../src/neural-network.js";
import { INPUT_OPTIONS, OUTPUT_OPTIONS, createDefaultTopology, createDefaultTopologyState, readNetworkInputs, activeOutputIndexes, validateTopology, topologySizes } from "../src/topology.js";
import { TopologyStore, TOPOLOGY_STORAGE_KEY, copyTopologyState, validateTopologyState } from "../src/topology-store.js";
import { Controls } from "../src/controls.js";
import { Car, MAX_SPEED } from "../src/car.js";
import { Sensor, SENSOR_LENGTH } from "../src/sensor.js";
import { Simulation, FIXED_STEP } from "../src/simulation.js";
import { Track } from "../src/track.js";
import { BUILT_IN_MAPS } from "../src/maps.js";

function memoryStorage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}

test("las seis entradas se pueden usar en absoluto, normalizadas o mezcladas", () => {
  const type = createDefaultTopology();
  const car = { speed: MAX_SPEED / 2, sensor: { distances: [0, 55, 110, 165, 220] } };
  type.inputs = INPUT_OPTIONS.map(input => ({ id: input.id, mode: "normalized" }));
  assert.deepEqual(readNetworkInputs(type, car).map(input => input.value), [0.5, 0, 0.25, 0.5, 0.75, 1]);
  type.inputs.forEach(input => { input.mode = "raw"; });
  assert.deepEqual(readNetworkInputs(type, car).map(input => input.value), [82.5, 0, 55, 110, 165, 220]);
  type.inputs = [{ id: "sensor-2", mode: "raw" }, { id: "speed", mode: "normalized" }, { id: "sensor-11", mode: "normalized" }];
  assert.deepEqual(readNetworkInputs(type, car).map(input => input.value), [220, 0.5, 0.25]);
  car.speed = MAX_SPEED;
  assert.equal(readNetworkInputs(type, car)[1].value, 1);
  car.speed = 0;
  assert.equal(readNetworkInputs(type, car)[1].value, 0);
});

test("sin borde el sensor entrega su alcance, y con borde entrega la distancia más cercana", () => {
  const sensor = new Sensor();
  const position = { x: 0, y: 0, angle: 0 };
  sensor.update(position, []);
  assert.deepEqual(sensor.distances, Array(5).fill(SENSOR_LENGTH));
  sensor.update(position, [[{ x: 110, y: -300 }, { x: 110, y: 300 }], [{ x: 150, y: -300 }, { x: 150, y: 300 }]]);
  assert.equal(sensor.distances[2], 110);
  assert.equal(sensor.rays[2].distance, 110);
});

test("ReLU se aplica a las capas ocultas y salida sin limitar los valores a uno", () => {
  const network = new NeuralNetwork([2, 2, 2], () => 0.5, "relu");
  network.layers = [
    { weights: [[2, -1], [-1, 0]], biases: [1, 0] },
    { weights: [[2, 1], [-1, 1]], biases: [0, 1] },
  ];
  assert.deepEqual(network.forward([100, 4]), [394, 0]);
  assert.deepEqual(network.activations, [[100, 4], [197, 0], [394, 0]]);
  assert.throws(() => new NeuralNetwork([2, 0, 1]), /neurona/);
  assert.throws(() => new NeuralNetwork([2, 1], Math.random, "tanh"), /activación/);
});

test("las seis acciones, incluso las combinadas, pulsan exactamente sus botones", () => {
  const expected = {
    forward: ["accelerate"], "forward-right": ["accelerate", "right"], "forward-left": ["accelerate", "left"],
    right: ["right"], left: ["left"], brake: ["brake"],
  };
  const controls = new Controls();
  for (const [action, buttons] of Object.entries(expected)) {
    controls.setFromNetwork([3], [action], "threshold");
    assert.deepEqual(Object.keys(controls).filter(key => controls[key]).sort(), [...buttons].sort());
  }
  // El orden elegido para las neuronas también determina el mapeo, no el catálogo.
  controls.setFromNetwork([0.9, 0.5, 0.51], ["forward-left", "right", "brake"]);
  assert.equal(controls.accelerate, true);
  assert.equal(controls.left, true);
  assert.equal(controls.brake, true);
  assert.equal(controls.right, false);
  controls.setFromNetwork([0, 0, 0], ["forward-left", "right", "brake"]);
  assert.ok(Object.values(controls).every(value => value === false));
});

test("el modo ganador elige solo una acción, resuelve empates y deja libre un vector de ceros", () => {
  assert.deepEqual(activeOutputIndexes([0.2, 0.4, 0.4], "winner"), [1]);
  assert.deepEqual(activeOutputIndexes([0, 0, 0], "winner"), []);
  assert.deepEqual(activeOutputIndexes([10, 200, 5], "winner"), [1]);
  assert.deepEqual(activeOutputIndexes([0.5, 0.50001, 2], "threshold"), [1, 2]);
  const controls = new Controls();
  controls.setFromNetwork([0.8, 0.9, 0.7], ["brake", "forward-right", "left"], "winner");
  assert.deepEqual({ ...controls }, { accelerate: true, brake: false, left: false, right: true });
});

test("una red sin capas ocultas usa sus entradas elegidas y mueve un coche con una salida combinada", () => {
  const topology = { ...createDefaultTopology(), inputs: [{ id: "speed", mode: "normalized" }],
    hidden: [], outputs: ["forward-right"], activation: "relu" };
  const brain = new NeuralNetwork(topologySizes(topology), () => 0.5, topology.activation);
  brain.layers[0].weights = [[2]];
  brain.layers[0].biases = [1];
  const car = new Car(1, "#fff", { x: 400, y: 160, angle: 0 }, brain, topology);
  const track = new Track();
  car.speed = MAX_SPEED / 2;
  car.think(track);
  assert.deepEqual(car.brain.activations[0], [0.5]);
  assert.deepEqual(car.outputs, [2]);
  assert.equal(car.controls.accelerate, true);
  assert.equal(car.controls.right, true);
  car.move(FIXED_STEP, track);
  assert.ok(car.speed > MAX_SPEED / 2);
  assert.ok(car.x > 400 && car.angle > 0);
});

test("distintas topologías conviven con redes independientes y mantienen valores finitos", () => {
  const state = createDefaultTopologyState();
  // El máximo tamaño admitido se combina con entradas absolutas y ReLU.
  state.types[2].hidden = [16, 16, 16, 16];
  state.types[2].outputs = OUTPUT_OPTIONS.map(output => output.id);
  const simulation = new Simulation(4, undefined, state);
  assert.deepEqual(simulation.cars[0].brain.sizes, [5, 6, 4]);
  assert.deepEqual(simulation.cars[2].brain.sizes, [6, 8, 6, 4]);
  assert.deepEqual(simulation.cars[4].brain.sizes, [6, 16, 16, 16, 16, 6]);
  assert.notEqual(simulation.cars[0].brain, simulation.cars[1].brain);
  for (let i = 0; i < 180; i++) simulation.step();
  for (const car of simulation.cars) {
    assert.ok(car.inputs.every(input => Number.isFinite(input.value)));
    assert.ok(car.brain.activations.flat().every(Number.isFinite));
    assert.ok(car.outputs.every(Number.isFinite));
    assert.ok(Number.isFinite(car.distance));
  }
});

test("editar un tipo solo reconstruye sus coches; renombrarlo conserva las redes", () => {
  const simulation = new Simulation();
  const before = simulation.cars.map(car => car.brain);
  const state = copyTopologyState(simulation.topologies);
  state.types[0].hidden = [3, 2];
  assert.equal(simulation.setTopologies(state), 2);
  assert.notEqual(simulation.cars[0].brain, before[0]);
  assert.notEqual(simulation.cars[1].brain, before[1]);
  for (let i = 2; i < 6; i++) assert.equal(simulation.cars[i].brain, before[i]);
  const after = simulation.cars.map(car => car.brain);
  state.types[0].name = "Otro nombre";
  assert.equal(simulation.setTopologies(state), 0);
  simulation.cars.forEach((car, index) => assert.equal(car.brain, after[index]));
  assert.equal(simulation.cars[0].topology.name, "Otro nombre");
  state.assignments[5] = state.types[0].id;
  assert.equal(simulation.setTopologies(state), 1);
  assert.deepEqual(simulation.cars[5].brain.sizes, [5, 3, 2, 4]);
  state.types[0].hidden[0] = 16;
  assert.equal(simulation.cars[5].brain.sizes[1], 3, "la simulación no comparte el borrador mutable");
});

test("cambiar solo la escala o activación conserva los números iniciales de los pesos para comparar", () => {
  const simulation = new Simulation(4);
  const weights = JSON.stringify(simulation.cars[0].brain.layers);
  const state = copyTopologyState(simulation.topologies);
  state.types[0].inputs.forEach(input => { input.mode = "raw"; });
  state.types[0].activation = "relu";
  simulation.setTopologies(state);
  assert.equal(JSON.stringify(simulation.cars[0].brain.layers), weights);
  assert.equal(simulation.cars[0].brain.activation, "relu");
  assert.ok(simulation.cars[0].inputs.some(input => input.value > 1));
});

test("reiniciar, cambiar de mapa y generar pesos nuevos conservan tipos y asignaciones", () => {
  const simulation = new Simulation();
  const state = JSON.stringify(simulation.topologies);
  const brains = simulation.cars.map(car => car.brain);
  simulation.step();
  simulation.reset();
  simulation.setMap(BUILT_IN_MAPS[1]);
  simulation.cars.forEach((car, index) => assert.equal(car.brain, brains[index]));
  simulation.createCars(99);
  assert.equal(JSON.stringify(simulation.topologies), state);
  simulation.cars.forEach((car, index) => {
    assert.notEqual(car.brain, brains[index]);
    assert.deepEqual(car.brain.sizes, brains[index].sizes);
    assert.equal(car.brain.activation, brains[index].activation);
  });
});

test("se rechazan configuraciones vacías, duplicadas, desconocidas o excesivas", () => {
  const invalid = [
    { inputs: [] }, { outputs: [] }, { inputs: [{ id: "unknown", mode: "raw" }] },
    { inputs: [{ id: "speed", mode: "bad" }] }, { inputs: [{ id: "speed", mode: "raw" }, { id: "speed", mode: "normalized" }] },
    { outputs: ["forward", "forward"] }, { outputs: ["fly"] }, { hidden: [0] }, { hidden: [17] },
    { hidden: [1.2] }, { hidden: [NaN] }, { hidden: [1, 1, 1, 1, 1] }, { activation: "tanh" },
    { outputMode: "random" }, { name: "   " },
  ];
  for (const change of invalid) assert.throws(() => validateTopology({ ...createDefaultTopology(), ...change }));
  const state = createDefaultTopologyState();
  state.assignments[0] = "missing";
  assert.throws(() => validateTopologyState(state), /Asigna/);
  state.assignments[0] = "classic";
  state.types[1].id = state.types[0].id;
  assert.throws(() => validateTopologyState(state), /repetidos/);
});

test("guardar y recargar conserva las topologías y asignaciones, sin guardar pesos", () => {
  const storage = memoryStorage();
  const store = new TopologyStore(storage);
  const draft = copyTopologyState(store.state);
  draft.types[0].name = "  Red de prueba  ";
  draft.types[0].hidden = [];
  draft.types[0].inputs = [{ id: "speed", mode: "raw" }];
  draft.types[0].outputs = ["forward-left"];
  draft.types[0].activation = "relu";
  draft.assignments[5] = draft.types[0].id;
  store.save(draft);
  const reloaded = new TopologyStore(storage);
  assert.deepEqual(reloaded.state, store.state);
  assert.equal(reloaded.state.types[0].name, "Red de prueba");
  assert.equal(reloaded.state.assignments[5], "classic");
  assert.equal(storage.getItem(TOPOLOGY_STORAGE_KEY).includes("weights"), false);
  draft.types[0].inputs[0].mode = "normalized";
  assert.equal(store.state.types[0].inputs[0].mode, "raw");
});

test("un fallo al guardar no altera el estado y un archivo corrupto no se sobrescribe", () => {
  const storage = memoryStorage();
  const store = new TopologyStore(storage);
  const before = JSON.stringify(store.state);
  const draft = copyTopologyState(store.state);
  draft.types[0].name = "Cambio sin guardar";
  storage.setItem = () => { throw new Error("QuotaExceededError"); };
  assert.throws(() => store.save(draft), /espacio o permiso/);
  assert.equal(JSON.stringify(store.state), before);
  assert.throws(() => new TopologyStore(null).save(draft), /No se pueden guardar/);
  const corrupt = memoryStorage();
  corrupt.setItem(TOPOLOGY_STORAGE_KEY, "datos dañados");
  const recovered = new TopologyStore(corrupt);
  assert.ok(recovered.warning);
  assert.throws(() => recovered.save(draft), /No se pueden guardar/);
  assert.equal(corrupt.getItem(TOPOLOGY_STORAGE_KEY), "datos dañados");
});
