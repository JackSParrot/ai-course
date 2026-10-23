using System;
using System.IO;
using System.Text;
using UnityEngine;

namespace NeuralCars
{
    [Serializable]
    public sealed class ModelDefinition
    {
        public int version;
        public string modelId;
        public int[] sizes;
        public string activation;
        public string[] inputs;
        public string[] outputs;
        public float sensorLength;
        public float actionThreshold;
        public string trainingMethod;

        public static ModelDefinition Create(int[] sizes)
        {
            return new ModelDefinition {
                version = 1, modelId = Guid.NewGuid().ToString("N"), sizes = (int[])sizes.Clone(), activation = "sigmoid",
                inputs = new[] { "distance-10h/220", "distance-11h/220", "distance-12h/220", "distance-1h/220", "distance-2h/220" },
                outputs = new[] { "accelerate", "brake", "left", "right" }, sensorLength = 220,
                actionThreshold = 0.5f, trainingMethod = "genetic-selection-and-mutation"
            };
        }

        public void Validate()
        {
            if (version != 1 || string.IsNullOrEmpty(modelId) || modelId.Length > 80) throw new InvalidDataException("Invalid model/version.");
            if (sizes == null || sizes.Length < 2 || sizes.Length > 6 || sizes[0] != 5 || sizes[sizes.Length - 1] != 4)
                throw new InvalidDataException("This driver expects 5 sensors and 4 actions.");
            foreach (int size in sizes) if (size < 1 || size > 32) throw new InvalidDataException("Invalid layer size.");
            var expected = Create(sizes);
            if (activation != expected.activation || sensorLength != 220 || actionThreshold != 0.5f ||
                inputs == null || outputs == null || inputs.Length != 5 || outputs.Length != 4)
                throw new InvalidDataException("Unsupported activation, scale or actions.");
            for (int i = 0; i < 5; i++) if (inputs[i] != expected.inputs[i]) throw new InvalidDataException("Sensor order differs.");
            for (int i = 0; i < 4; i++) if (outputs[i] != expected.outputs[i]) throw new InvalidDataException("Action order differs.");
        }
    }

    [Serializable] public sealed class LayerWeights { public Neuron[] neurons; }
    [Serializable] public sealed class WeightFile { public int version; public string modelId; public LayerWeights[] layers; }

    public static class ModelFiles
    {
        public static string DefinitionJson(NeuralNetwork network, string id)
        {
            var definition = ModelDefinition.Create(network.Sizes);
            definition.modelId = id;
            return JsonUtility.ToJson(definition, true);
        }

        public static string WeightsJson(NeuralNetwork network, string id)
        {
            var data = new WeightFile { version = 1, modelId = id, layers = new LayerWeights[network.Layers.Length] };
            for (int l = 0; l < data.layers.Length; l++) data.layers[l] = new LayerWeights { neurons = network.Layers[l] };
            return JsonUtility.ToJson(data, true);
        }

        public static NeuralNetwork Parse(string definitionJson, string weightsJson)
        {
            if (string.IsNullOrWhiteSpace(definitionJson) || string.IsNullOrWhiteSpace(weightsJson) ||
                definitionJson.Length > 65536 || weightsJson.Length > 1048576) throw new InvalidDataException("Empty or oversized model.");
            var definition = JsonUtility.FromJson<ModelDefinition>(definitionJson);
            if (definition == null) throw new InvalidDataException("Missing definition.");
            definition.Validate();
            var data = JsonUtility.FromJson<WeightFile>(weightsJson);
            if (data == null || data.version != 1 || data.modelId != definition.modelId || data.layers == null ||
                data.layers.Length != definition.sizes.Length - 1) throw new InvalidDataException("The two files do not belong together.");
            var network = new NeuralNetwork(definition.sizes, new System.Random(0));
            for (int l = 0; l < data.layers.Length; l++)
            {
                var neurons = data.layers[l]?.neurons;
                if (neurons == null || neurons.Length != definition.sizes[l + 1]) throw new InvalidDataException("Wrong neuron count.");
                for (int n = 0; n < neurons.Length; n++)
                {
                    var neuron = neurons[n];
                    if (neuron == null || neuron.weights == null || neuron.weights.Length != definition.sizes[l] || !ValidParameter(neuron.bias))
                        throw new InvalidDataException("Invalid neuron or bias.");
                    foreach (float value in neuron.weights) if (!ValidParameter(value)) throw new InvalidDataException("Invalid weight.");
                    network.Layers[l][n] = neuron.Copy();
                }
            }
            return network;
        }

        private static bool ValidParameter(float value) => NeuralNetwork.IsFinite(value) && Math.Abs(value) <= 1000000;

        // Each export gets a new folder. It becomes visible only when BOTH files have been written.
        public static string Save(string parent, NeuralNetwork network)
        {
            string id = Guid.NewGuid().ToString("N");
            string folder = Path.Combine(parent, "model-" + DateTime.UtcNow.ToString("yyyyMMdd-HHmmss") + "-" + id.Substring(0, 8));
            Directory.CreateDirectory(parent);
            string staging = folder + ".tmp";
            Directory.CreateDirectory(staging);
            try
            {
                string description = DefinitionJson(network, id), weights = WeightsJson(network, id);
                Parse(description, weights);
                File.WriteAllText(Path.Combine(staging, "network.json"), description, new UTF8Encoding(false));
                File.WriteAllText(Path.Combine(staging, "weights.json"), weights, new UTF8Encoding(false));
                Directory.Move(staging, folder);
                return folder;
            }
            finally { if (Directory.Exists(staging)) Directory.Delete(staging, true); }
        }

        public static NeuralNetwork Load(string folder)
        {
            string definition = Path.Combine(folder, "network.json"), weights = Path.Combine(folder, "weights.json");
            if (new FileInfo(definition).Length > 65536 || new FileInfo(weights).Length > 1048576) throw new InvalidDataException("Oversized model.");
            return Parse(File.ReadAllText(definition), File.ReadAllText(weights));
        }
    }
}
