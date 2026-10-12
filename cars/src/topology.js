import { MAX_SPEED } from "./car-settings.js";
import { SENSOR_HOURS, SENSOR_LENGTH } from "./sensor.js";
import { clamp } from "./geometry.js";

// Los identificadores son estables; el orden de cada lista es el orden de las neuronas.
export const INPUT_OPTIONS = [
  { id: "speed", label: "Velocidad actual", short: "Vel.", maximum: MAX_SPEED, unit: "u/s" },
  ...SENSOR_HOURS.map((hour, sensorIndex) => ({
    id: `sensor-${hour}`, label: `Sensor ${hour} h`, short: `${hour} h`,
    maximum: SENSOR_LENGTH, unit: "u", sensorIndex,
  })),
];

// Una salida puede pulsar uno o dos botones físicos del coche.
export const OUTPUT_OPTIONS = [
  { id: "forward", label: "Avanzar", short: "↑", controls: ["accelerate"] },
  { id: "forward-right", label: "Avanzar y girar a la derecha", short: "↑→", controls: ["accelerate", "right"] },
  { id: "forward-left", label: "Avanzar y girar a la izquierda", short: "↑←", controls: ["accelerate", "left"] },
  { id: "right", label: "Girar a la derecha", short: "→", controls: ["right"] },
  { id: "left", label: "Girar a la izquierda", short: "←", controls: ["left"] },
  { id: "brake", label: "Frenar", short: "↓", controls: ["brake"] },
];

export const MAX_HIDDEN_LAYERS = 4;
export const MAX_NEURONS = 16;
export const ACTIVATION_THRESHOLD = 0.5;

export function copyTopology(type) {
  return { ...type, inputs: type.inputs.map(input => ({ ...input })), hidden: [...type.hidden], outputs: [...type.outputs] };
}

export function topologySizes(type) {
  return [type.inputs.length, ...type.hidden, type.outputs.length];
}

export function topologyKey(type) {
  // Cambiar el nombre no cambia las matemáticas ni requiere nuevos pesos.
  return JSON.stringify([type.inputs, type.hidden, type.outputs, type.activation, type.outputMode]);
}

export function validateTopology(type) {
  if (!type || typeof type.id !== "string" || !type.id || type.id.length > 80) throw new Error("El identificador del tipo no es válido.");
  if (typeof type.name !== "string" || !type.name.trim() || type.name.trim().length > 48) throw new Error("Escribe un nombre de entre 1 y 48 caracteres.");
  if (!Array.isArray(type.inputs) || type.inputs.length < 1 || type.inputs.length > INPUT_OPTIONS.length) throw new Error("Selecciona al menos una entrada.");
  const inputIds = type.inputs.map(input => input?.id);
  if (new Set(inputIds).size !== inputIds.length || type.inputs.some(input => !INPUT_OPTIONS.some(option => option.id === input?.id) || !["raw", "normalized"].includes(input.mode))) throw new Error("Las entradas y sus escalas deben ser válidas y no repetirse.");
  if (!Array.isArray(type.outputs) || type.outputs.length < 1 || type.outputs.length > OUTPUT_OPTIONS.length) throw new Error("Selecciona al menos una salida.");
  if (new Set(type.outputs).size !== type.outputs.length || type.outputs.some(id => !OUTPUT_OPTIONS.some(option => option.id === id))) throw new Error("Las salidas deben ser válidas y no repetirse.");
  if (!Array.isArray(type.hidden) || type.hidden.length > MAX_HIDDEN_LAYERS || type.hidden.some(size => !Number.isInteger(size) || size < 1 || size > MAX_NEURONS)) throw new Error(`Usa de 0 a ${MAX_HIDDEN_LAYERS} capas ocultas, con 1 a ${MAX_NEURONS} neuronas por capa.`);
  if (!["sigmoid", "relu"].includes(type.activation)) throw new Error("Elige sigmoide o ReLU.");
  if (!["threshold", "winner"].includes(type.outputMode)) throw new Error("Elige cómo se convierten las salidas en acciones.");
}

export function createDefaultTopology() {
  return { id: "classic", name: "Clásico", inputs: INPUT_OPTIONS.slice(1).map(input => ({ id: input.id, mode: "normalized" })),
    hidden: [6], outputs: ["forward", "brake", "left", "right"], activation: "sigmoid", outputMode: "threshold" };
}

export function createDefaultTopologyState() {
  const classic = createDefaultTopology();
  const combined = { ...copyTopology(classic), id: "combined", name: "Acciones combinadas",
    inputs: INPUT_OPTIONS.map(input => ({ id: input.id, mode: "normalized" })),
    hidden: [8, 6], outputs: ["forward", "forward-right", "forward-left", "brake"], outputMode: "winner" };
  const raw = { ...copyTopology(combined), id: "raw-relu", name: "Absolutos + ReLU",
    inputs: INPUT_OPTIONS.map(input => ({ id: input.id, mode: "raw" })), hidden: [6], activation: "relu" };
  return { version: 1, types: [classic, combined, raw], assignments: [classic.id, classic.id, combined.id, combined.id, raw.id, raw.id] };
}

export function readNetworkInputs(type, car) {
  return type.inputs.map(input => {
    const option = INPUT_OPTIONS.find(candidate => candidate.id === input.id);
    const raw = input.id === "speed" ? car.speed : car.sensor.distances[option.sensorIndex];
    // Normalizar mantiene el sentido de la medida: más distancia sigue siendo más valor.
    const value = input.mode === "raw" ? raw : clamp(raw / option.maximum, 0, 1);
    return { ...option, mode: input.mode, raw, value };
  });
}

export function activeOutputIndexes(outputs, mode) {
  if (mode === "winner") {
    const largest = Math.max(...outputs);
    // ReLU puede devolver todo ceros: en ese caso no hay ninguna acción.
    // En un empate gana la primera salida, según el orden visible en el editor.
    return largest > 0 ? [outputs.indexOf(largest)] : [];
  }
  return outputs.flatMap((value, index) => value > ACTIVATION_THRESHOLD ? [index] : []);
}
