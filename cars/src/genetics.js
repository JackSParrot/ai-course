import { NeuralNetwork } from "./neural-network.js";
import { topologySizes } from "./topology.js";

// El genoma son TODOS los pesos y sesgos. No cambiamos las capas ni las entradas.
export function networkData(brain) {
  return { sizes: [...brain.sizes], activation: brain.activation,
    layers: brain.layers.map(layer => ({ weights: layer.weights.map(row => [...row]), biases: [...layer.biases] })) };
}

export function networkFromData(data, type) {
  const sizes = topologySizes(type);
  if (!data || JSON.stringify(data.sizes) !== JSON.stringify(sizes) || data.activation !== type.activation
    || !Array.isArray(data.layers) || data.layers.length !== sizes.length - 1) throw new Error(`La red no coincide con el tipo «${type.name}».`);
  const isNumber = value => Number.isFinite(value) && Math.abs(value) <= 1000000;
  data.layers.forEach((layer, index) => {
    if (!Array.isArray(layer.weights) || layer.weights.length !== sizes[index + 1]
      || layer.weights.some(row => !Array.isArray(row) || row.length !== sizes[index] || !row.every(isNumber))
      || !Array.isArray(layer.biases) || layer.biases.length !== sizes[index + 1] || !layer.biases.every(isNumber)) throw new Error("Los pesos o sesgos guardados no son válidos.");
  });
  const brain = new NeuralNetwork(sizes, () => 0.5, type.activation);
  brain.layers = data.layers.map(layer => ({ weights: layer.weights.map(row => [...row]), biases: [...layer.biases] }));
  return brain;
}

export function cloneNetwork(brain, type) {
  return networkFromData(networkData(brain), type);
}

// Una mutación es sumar un número pequeño a algunos parámetros de una COPIA.
// El padre y las élites nunca se modifican. Guardamos un cambio para explicarlo en pantalla.
export function mutateNetwork(parent, type, random, probability, amount) {
  const brain = cloneNetwork(parent, type);
  const genes = [];
  brain.layers.forEach((layer, layerIndex) => {
    layer.weights.forEach((row, neuron) => row.forEach((value, input) => {
      genes.push({ array: row, index: input, label: `Capa ${layerIndex + 1}, neurona ${neuron + 1}, peso ${input + 1}` });
    }));
    layer.biases.forEach((value, neuron) => {
      genes.push({ array: layer.biases, index: neuron, label: `Capa ${layerIndex + 1}, neurona ${neuron + 1}, sesgo` });
    });
  });
  let changes = 0;
  let example = null;
  function change(gene) {
    const before = gene.array[gene.index];
    const delta = (random() * 2 - 1) * amount || amount / 2;
    gene.array[gene.index] += delta;
    changes++;
    if (!example) example = { label: gene.label, before, after: gene.array[gene.index], delta };
  }
  for (const gene of genes) if (random() < probability) change(gene);
  // Incluso una red muy pequeña debe tener al menos un parámetro mutado.
  if (changes === 0) change(genes[Math.floor(random() * genes.length)]);
  return { brain, changes, example };
}

export function populationPlan(size) {
  return { elite: Math.max(1, Math.floor(size * 0.1)), fresh: Math.max(1, Math.floor(size * 0.1)), parents: Math.max(2, Math.ceil(size * 0.25)) };
}
