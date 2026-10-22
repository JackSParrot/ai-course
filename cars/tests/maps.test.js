import test from "node:test";
import assert from "node:assert/strict";
import { BUILT_IN_MAPS, DEFAULT_TRAINING_IDS, copyMap, mapGeometryKey } from "../src/maps.js";
import { Track, validateMap } from "../src/track.js";
import { MapStore, MAP_STORAGE_KEY, parseMap, serializeMap, validateMapState } from "../src/map-store.js";
import { Simulation } from "../src/simulation.js";
import { SENSOR_LENGTH } from "../src/sensor.js";

function memoryStorage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}

function newMap() {
  return { ...copyMap(BUILT_IN_MAPS[3]), id: "", name: "Circuito del grupo", width: 96 };
}

test("todas las plantillas son válidas en ambos sentidos y caben los seis coches", () => {
  for (const map of BUILT_IN_MAPS) {
    for (const reversed of [false, true]) {
      const simulation = new Simulation(4, { ...copyMap(map), reversed });
      assert.ok(simulation.track.length > 1000);
      for (const car of simulation.cars) {
        assert.equal(simulation.track.touchesCar(car.getCorners()), false);
        assert.ok(car.sensor.distances.every(value => Number.isFinite(value) && value >= 0 && value <= SENSOR_LENGTH));
      }
    }
  }
});

test("el editor acepta un rectángulo dibujado desde cero y redondea las curvas", () => {
  const map = newMap();
  map.points = [[220, 180], [840, 180], [840, 540], [220, 540]].map(([x, y]) => ({ x, y }));
  map.startIndex = 0;
  const track = new Track(map);
  assert.ok(track.center.length > map.points.length);
  assert.equal(track.contains({ x: 530, y: 180 }), true);
  assert.equal(track.contains({ x: 530, y: 360 }), false);
  assert.equal(track.contains({ x: 20, y: 20 }), false);
});

test("rechaza cruces, solapes, puntos duplicados y carreteras fuera del lienzo", () => {
  const crossed = newMap();
  crossed.points = [[200, 180], [850, 540], [850, 180], [200, 540]].map(([x, y]) => ({ x, y }));
  assert.match(validateMap(crossed).message, /cruza/);
  const overlapped = newMap();
  overlapped.points = [[450, 300], [520, 300], [520, 370], [450, 370]].map(([x, y]) => ({ x, y }));
  assert.equal(validateMap(overlapped).valid, false);
  const duplicate = newMap();
  duplicate.points[1] = { ...duplicate.points[0] };
  assert.match(validateMap(duplicate).message, /juntos/);
  const outside = newMap();
  outside.points[0].y = 20;
  assert.equal(validateMap(outside).valid, false);
});

test("valida nombres, coordenadas, ancho, salida, versión y número de puntos", () => {
  for (const change of [
    map => { map.name = ""; }, map => { map.width = 0; }, map => { map.width = Infinity; },
    map => { map.startIndex = 99; }, map => { map.version = 2; }, map => { map.points = map.points.slice(0, 2); },
    map => { map.points[0].x = NaN; }, map => { map.points = Array(65).fill({ x: 100, y: 100 }); },
  ]) {
    const map = newMap();
    change(map);
    assert.equal(validateMap(map).valid, false);
  }
});

test("los errores del editor localizan cruces, curvas cerradas y bordes fuera del área útil", () => {
  for (const points of [
    [[200, 180], [850, 540], [850, 180], [200, 540]],
    [[450, 300], [520, 300], [520, 370], [450, 370]],
    [[200, 180], [500, 180], [205, 190], [800, 540], [200, 540]],
  ]) {
    const map = { ...newMap(), points: points.map(([x, y]) => ({ x, y })) };
    const result = validateMap(map);
    assert.equal(result.valid, false);
    assert.ok(result.locations.length > 0);
    assert.ok(result.pointIndices.length > 0);
    assert.ok(result.pointIndices.every(i => Number.isInteger(i) && i >= 0 && i < points.length));
    assert.match(result.message, /Puntos:/);
  }
  const map = newMap();
  map.points = map.points.map(p => ({ x: p.x, y: p.y - 100 }));
  const before = JSON.stringify(map);
  const result = validateMap(map);
  assert.equal(result.code, "bounds");
  assert.ok(result.preview.outer.length > 0, "la carretera inválida conserva sus bordes para dibujarse");
  assert.ok(result.locations.every(p => p.y < 68));
  assert.equal(JSON.stringify(map), before, "la validación no modifica el borrador");
});

test("el terreno grande admite trazados extensos, más de 24 puntos y conserva tamaño al guardar", () => {
  const map = { ...newMap(), worldWidth: 3180, worldHeight: 2160 };
  map.points = Array.from({ length: 32 }, (_, i) => ({
    x: 1590 + 1250 * Math.cos(i * Math.PI / 16),
    y: 1080 + 750 * Math.sin(i * Math.PI / 16),
  }));
  const track = new Track(map);
  assert.equal(track.worldWidth, 3180);
  assert.equal(track.worldHeight, 2160);
  assert.ok(track.length > 6000);
  assert.equal(validateMap({ ...map, worldWidth: undefined, worldHeight: undefined }).valid, false);
  assert.deepEqual(parseMap(serializeMap(map)), map);
  const store = new MapStore(memoryStorage());
  const saved = store.saveMap(map);
  assert.equal(store.get(saved.id).worldWidth, 3180);
  for (const reversed of [false, true]) {
    const simulation = new Simulation(4, { ...map, reversed });
    for (let step = 0; step < 10; step++) simulation.step();
    assert.ok(simulation.cars.every(car => Number.isFinite(car.x) && Number.isFinite(car.y)));
  }
  for (const size of [{worldWidth: NaN}, {worldHeight: 0}, {worldWidth: 10000}, {worldHeight: 1800}]) {
    assert.equal(validateMap({ ...map, ...size }).valid, false);
  }
});

test("guardar y recargar conserva geometría, nombre, uso y mapa activo", () => {
  const storage = memoryStorage();
  const store = new MapStore(storage);
  const saved = store.saveMap(newMap(), "test");
  assert.ok(saved.id.startsWith("custom-"));
  const reloaded = new MapStore(storage);
  assert.deepEqual(reloaded.get(saved.id), saved);
  assert.equal(reloaded.state.activeId, saved.id);
  assert.equal(reloaded.purpose(saved.id), "test");
  assert.equal(reloaded.purpose("reserve"), "practice");
  assert.equal(reloaded.getExperiment().trainingMaps.length, 4);
});

test("los nuevos circuitos de entrenamiento combinan curvas a izquierda y derecha", () => {
  for (const id of ["chicane", "technical"]) {
    const map = BUILT_IN_MAPS.find(map => map.id === id);
    const turns = map.points.map((point, i, points) => {
      const previous = points[(i + points.length - 1) % points.length];
      const next = points[(i + 1) % points.length];
      return (point.x - previous.x) * (next.y - point.y) - (point.y - previous.y) * (next.x - point.x);
    });
    assert.ok(turns.filter(turn => turn < 0).length >= 2);
    assert.ok(turns.filter(turn => turn > 0).length >= 2);
    for (const reversed of [false, true]) assert.equal(validateMap({ ...map, reversed }).valid, true);
  }
});

test("la biblioteca anterior recibe variedad conservando circuitos propios y planes personalizados", () => {
  for (const customized of [false, true]) {
    const storage = memoryStorage();
    const store = new MapStore(storage);
    const custom = store.saveMap(newMap());
    const legacy = structuredClone(store.state);
    legacy.maps = legacy.maps.filter(map => !["chicane", "technical"].includes(map.id));
    legacy.trainingIds = customized ? ["oval", "triangle", custom.id] : ["oval", "triangle", "sweep", "rectangle"];
    const oldPlan = [...legacy.trainingIds];
    storage.setItem(MAP_STORAGE_KEY, JSON.stringify(legacy));
    const restored = new MapStore(storage);
    assert.equal(restored.warning, "");
    assert.deepEqual(restored.get(custom.id), custom);
    assert.equal(restored.state.activeId, custom.id);
    assert.equal(restored.state.testId, "reserve");
    assert.deepEqual(restored.state.trainingIds, customized ? oldPlan : DEFAULT_TRAINING_IDS);
    assert.ok(restored.get("chicane"));
    assert.ok(restored.get("technical"));
  }
});

test("cambiar de circuito conserva las redes y reajusta las salidas y sensores", () => {
  const simulation = new Simulation();
  const brains = simulation.cars.map(car => car.brain);
  const weights = JSON.stringify(brains.map(brain => brain.layers));
  for (let i = 0; i < 60; i++) simulation.step();
  simulation.setMap(BUILT_IN_MAPS[1]);
  assert.equal(simulation.elapsed, 0);
  simulation.cars.forEach((car, index) => {
    assert.equal(car.brain, brains[index]);
    assert.deepEqual(car.start, simulation.track.getStart(index));
    assert.equal(car.distance, 0);
    assert.equal(car.crashed, false);
    assert.equal(simulation.track.touchesCar(car.getCorners()), false);
  });
  assert.equal(JSON.stringify(brains.map(brain => brain.layers)), weights);
});

test("la salida sigue el punto elegido y el sentido cambia la orientación", () => {
  const map = newMap();
  const first = new Track(map);
  const second = new Track({ ...map, startIndex: 2 });
  const reverse = new Track({ ...map, reversed: true });
  assert.notDeepEqual(second.start, first.start);
  assert.ok(Math.cos(reverse.start.angle - first.start.angle) < -0.95);
});

test("la biblioteca separa entrenamiento y prueba y limita entrenamiento a cuatro", () => {
  const store = new MapStore(memoryStorage());
  const saved = store.saveMap(newMap());
  const before = JSON.stringify(store.state);
  assert.throws(() => store.setPurpose(saved.id, "training"), /máximo 4/);
  assert.equal(JSON.stringify(store.state), before);
  store.setPurpose("sweep", "test");
  const experiment = store.getExperiment();
  assert.equal(experiment.trainingMaps.length, 3);
  assert.equal(experiment.testMap.id, "sweep");
  assert.ok(experiment.trainingMaps.every(map => map.id !== experiment.testMap.id));
  assert.equal(store.purpose("reserve"), "practice");
});

test("renombrar, invertir o cambiar la salida de una copia no la convierte en una prueba nueva", () => {
  const store = new MapStore(memoryStorage());
  const copy = { ...copyMap(BUILT_IN_MAPS[0]), id: "", name: "Otro nombre", reversed: true, startIndex: 2 };
  assert.throws(() => store.saveMap(copy, "test"), /mismo|trazado/);
  const rotated = copyMap(copy);
  rotated.points.push(rotated.points.shift());
  assert.equal(mapGeometryKey(copy), mapGeometryKey(rotated));
  rotated.points.reverse();
  assert.equal(mapGeometryKey(copy), mapGeometryKey(rotated));
});

test("no se admiten dos copias del mismo trazado en entrenamiento", () => {
  const store = new MapStore(memoryStorage());
  store.setPurpose("technical", "practice");
  const copy = { ...copyMap(BUILT_IN_MAPS[0]), id: "", name: "Copia" };
  assert.throws(() => store.saveMap(copy, "training"), /mismo trazado/);
});

test("exportar e importar conserva el mapa y asigna una identidad nueva al guardarlo", () => {
  const original = newMap();
  original.name = "Curvas <del grupo> & más";
  const imported = parseMap(serializeMap(original));
  assert.deepEqual(imported, original);
  const store = new MapStore(memoryStorage());
  const saved = store.saveMap(imported);
  assert.notEqual(saved.id, original.id);
  assert.deepEqual(saved.points, original.points);
  assert.throws(() => parseMap("no es JSON"), /JSON válido/);
  assert.throws(() => parseMap(JSON.stringify({ version: 100 })), /exportado/);
  assert.throws(() => parseMap(" ".repeat(200001)), /grande/);
});

test("un fallo de almacenamiento no modifica el estado ni finge que ha guardado", () => {
  const store = new MapStore({ getItem: () => null, setItem: () => { throw new Error("quota"); } });
  const before = JSON.stringify(store.state);
  assert.throws(() => store.saveMap(newMap()), /espacio o permiso/);
  assert.equal(JSON.stringify(store.state), before);
});

test("los datos corruptos se conservan y la interfaz puede cargar las plantillas", () => {
  const storage = memoryStorage();
  storage.setItem(MAP_STORAGE_KEY, "contenido dañado");
  const store = new MapStore(storage);
  assert.equal(store.list().length, BUILT_IN_MAPS.length);
  assert.ok(store.warning);
  assert.throws(() => store.saveMap(newMap()), /No se puede guardar/);
  assert.equal(storage.getItem(MAP_STORAGE_KEY), "contenido dañado");
});

test("la biblioteca rechaza referencias inexistentes y protege las plantillas", () => {
  const store = new MapStore(memoryStorage());
  assert.throws(() => store.saveMap(copyMap(BUILT_IN_MAPS[0])), /plantillas/);
  assert.throws(() => store.select("missing"), /Falta/);
  const invalid = { ...store.state, trainingIds: ["reserve"], testId: "reserve" };
  assert.throws(() => validateMapState(invalid), /no puede/);
});
