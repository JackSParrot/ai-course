// Esta es toda la red neuronal. No utiliza librerías ni conoce el circuito.
// Solo recibe números y devuelve otros números.
export class NeuralNetwork {
  constructor(sizes = [5, 6, 4], random = Math.random, activation = "sigmoid") {
    if (!Array.isArray(sizes) || sizes.length < 2 || sizes.some(size => !Number.isInteger(size) || size < 1)) throw new Error("Cada capa necesita al menos una neurona.");
    if (!["sigmoid", "relu"].includes(activation)) throw new Error("La activación debe ser sigmoid o relu.");
    this.sizes = [...sizes];
    this.activation = activation;
    this.layers = [];
    this.activations = sizes.map(size => Array(size).fill(0));

    for (let layerIndex = 1; layerIndex < sizes.length; layerIndex++) {
      const inputCount = sizes[layerIndex - 1];
      const outputCount = sizes[layerIndex];
      const weights = [];
      const biases = [];

      for (let neuron = 0; neuron < outputCount; neuron++) {
        // Cada neurona tiene un peso por entrada y un sesgo propio.
        const neuronWeights = [];
        for (let input = 0; input < inputCount; input++) {
          neuronWeights.push(random() * 2 - 1);
        }
        weights.push(neuronWeights);
        biases.push(random() * 2 - 1);
      }

      this.layers.push({ weights, biases });
    }
  }

  // Sigmoide: transforma cualquier suma en un valor entre 0 y 1.
  sigmoid(value) {
    return 1 / (1 + Math.exp(-value));
  }

  forward(inputs) {
    if (inputs.length !== this.sizes[0] || inputs.some(value => !Number.isFinite(value))) {
      throw new Error(`La red necesita ${this.sizes[0]} entradas numéricas.`);
    }

    let values = [...inputs];
    this.activations = [values];

    for (const layer of this.layers) {
      const outputs = [];

      for (let neuron = 0; neuron < layer.biases.length; neuron++) {
        let sum = layer.biases[neuron];

        for (let input = 0; input < values.length; input++) {
          sum += values[input] * layer.weights[neuron][input];
        }

        // ReLU deja pasar las sumas positivas, sin limitarlas a 1.
        // La misma función se aplica a las capas ocultas y a la salida.
        outputs.push(this.activation === "relu" ? Math.max(0, sum) : this.sigmoid(sum));
      }

      values = outputs;
      this.activations.push(values);
    }

    return values;
  }
}
