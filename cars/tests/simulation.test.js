import test from "node:test";
import assert from "node:assert/strict";
import { NeuralNetwork } from "../src/neural-network.js";
import { Sensor, SENSOR_LENGTH } from "../src/sensor.js";
import { Controls } from "../src/controls.js";
import { Car } from "../src/car.js";
import { Track } from "../src/track.js";
import { Simulation, FIXED_STEP } from "../src/simulation.js";

function near(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 0.000001, `${actual} no coincide con ${expected}`);
}

test("una red calcula pesos, sesgos y la sigmoide en varias capas", () => {
  const network = new NeuralNetwork([2, 2, 1]);
  network.layers = [
    { weights: [[1, -1], [2, 1]], biases: [0, -1] },
    { weights: [[2, -1]], biases: [0.25] },
  ];
  // Para [1, 1], la primera neurona da 0,5 y la segunda sigmoid(2).
  const secondNeuron = 1 / (1 + Math.exp(-2));
  const expected = 1 / (1 + Math.exp(-(1 - secondNeuron + 0.25)));
  near(network.forward([1, 1])[0], expected);
  assert.deepEqual(network.activations[0], [1, 1]);
  assert.throws(() => network.forward([1]), /2 entradas/);
  assert.throws(() => network.forward([NaN, 1]), /numéricas/);
});

test("los sensores salen del centro hacia las 10, 11, 12, 1 y 2 del coche", () => {
  const sensor = new Sensor();
  sensor.update({ x: 40, y: 70, angle: -Math.PI / 2 }, []);
  const expectedDirections = [-150, -120, -90, -60, -30];
  sensor.rays.forEach((ray, index) => {
    assert.deepEqual(ray.start, { x: 40, y: 70 });
    const angle = expectedDirections[index] * Math.PI / 180;
    near(ray.end.x, 40 + Math.cos(angle) * SENSOR_LENGTH);
    near(ray.end.y, 70 + Math.sin(angle) * SENSOR_LENGTH);
  });
  assert.deepEqual(sensor.distances, Array(5).fill(SENSOR_LENGTH));
});

test("un sensor detecta el borde más cercano y mide su distancia absoluta", () => {
  const sensor = new Sensor();
  sensor.update({ x: 0, y: 0, angle: 0 }, [
    [{ x: 180, y: -300 }, { x: 180, y: 300 }],
    [{ x: 110, y: -300 }, { x: 110, y: 300 }],
  ]);
  near(sensor.distances[2], 110);
  near(sensor.rays[2].hit.x, 110);
  near(sensor.distances[1], 110 / Math.cos(Math.PI / 6));
  assert.ok(sensor.distances.every(value => value >= 0 && value <= SENSOR_LENGTH));
  sensor.update({ x: 0, y: 0, angle: 0 }, [[{ x: 300, y: -300 }, { x: 300, y: 300 }]]);
  assert.deepEqual(sensor.distances, Array(5).fill(SENSOR_LENGTH));
});

test("las cuatro salidas pulsan botones independientes con umbral estricto", () => {
  const controls = new Controls();
  controls.setFromNetwork([0.51, 0.5, 0, 1]);
  assert.equal(controls.accelerate, true);
  assert.equal(controls.brake, false);
  assert.equal(controls.left, false);
  assert.equal(controls.right, true);
  controls.clear();
  assert.ok(Object.values(controls).every(value => value === false));
});

test("frenar prevalece sobre acelerar, los giros opuestos se cancelan y no hay marcha atrás", () => {
  const track = new Track();
  const car = new Car(1, "#fff", { x: 400, y: 160, angle: 0 }, new NeuralNetwork());
  car.speed = 30;
  car.controls.accelerate = true;
  car.controls.brake = true;
  car.controls.left = true;
  car.controls.right = true;
  car.move(FIXED_STEP, track);
  assert.ok(car.speed < 30);
  assert.equal(car.angle, 0);
  for (let i = 0; i < 60; i++) car.move(FIXED_STEP, track);
  assert.equal(car.speed, 0);
  const position = { x: car.x, y: car.y, angle: car.angle };
  car.controls.left = false;
  car.move(FIXED_STEP, track);
  assert.deepEqual({ x: car.x, y: car.y, angle: car.angle }, position);
});

test("izquierda y derecha giran en el sentido correspondiente", () => {
  const track = new Track();
  for (const direction of ["left", "right"]) {
    const car = new Car(1, "#fff", { x: 400, y: 160, angle: 0 }, new NeuralNetwork());
    car.speed = 60;
    car.controls[direction] = true;
    car.move(FIXED_STEP, track);
    assert.equal(Math.sign(car.angle), direction === "left" ? -1 : 1);
  }
});

test("se detecta toda la carrocería, no solo el centro del coche", () => {
  const track = new Track();
  const car = new Car(1, "#fff", { x: 500, y: track.start.y - track.width / 2 + 4, angle: 0 }, new NeuralNetwork());
  assert.equal(track.contains(car), true);
  assert.equal(track.touchesCar(car.getCorners()), true);
});

test("las salidas de la red mueven el coche y una colisión lo detiene", () => {
  const track = new Track();
  const brain = new NeuralNetwork();
  // Red de prueba: solo pulsa acelerar, mediante sus pesos y sesgos reales.
  brain.layers[1].weights = Array.from({ length: 4 }, () => Array(6).fill(0));
  brain.layers[1].biases = [10, -10, -10, -10];
  const car = new Car(1, "#fff", { x: 550, y: 160, angle: 0 }, brain);
  for (let i = 0; i < 600; i++) {
    car.think(track);
    car.move(FIXED_STEP, track);
  }
  assert.ok(car.distance > 200);
  assert.equal(car.crashed, true);
  assert.equal(car.speed, 0);
  assert.ok(Object.values(car.controls).every(value => value === false));
  const finalPosition = { x: car.x, y: car.y };
  car.move(FIXED_STEP, track);
  assert.deepEqual({ x: car.x, y: car.y }, finalPosition);
});

test("cada coche tiene su propia red y todos empiezan dentro del circuito", () => {
  const simulation = new Simulation();
  assert.equal(simulation.cars.length, 6);
  assert.equal(new Set(simulation.cars.map(car => car.brain)).size, 6);
  assert.notDeepEqual(simulation.cars[0].brain.layers, simulation.cars[1].brain.layers);
  for (const car of simulation.cars) assert.equal(simulation.track.touchesCar(car.getCorners()), false);
});

test("reiniciar conserva los pesos y reproduce el mismo experimento", () => {
  const simulation = new Simulation();
  const weightsBefore = JSON.stringify(simulation.cars.map(car => car.brain.layers));
  const snapshot = () => simulation.cars.map(car => ({ x: car.x, y: car.y, distance: car.distance, crashed: car.crashed }));
  for (let i = 0; i < 300; i++) simulation.step();
  const firstRun = snapshot();
  assert.ok(firstRun.some(car => car.distance > 0));
  simulation.reset();
  assert.equal(simulation.elapsed, 0);
  for (let i = 0; i < 300; i++) simulation.step();
  assert.deepEqual(snapshot(), firstRun);
  assert.equal(JSON.stringify(simulation.cars.map(car => car.brain.layers)), weightsBefore);
  near(simulation.elapsed, 5);
});

test("cambiar la semilla crea redes distintas y devuelve los coches a la salida", () => {
  const simulation = new Simulation(4);
  const before = JSON.stringify(simulation.cars.map(car => car.brain.layers));
  simulation.step();
  simulation.createCars(99);
  assert.notEqual(JSON.stringify(simulation.cars.map(car => car.brain.layers)), before);
  assert.equal(simulation.elapsed, 0);
  for (const car of simulation.cars) {
    assert.equal(car.distance, 0);
    assert.equal(car.crashed, false);
  }
});
