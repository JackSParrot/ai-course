using System;

namespace NeuralCars
{
    public sealed class NeuralNetwork
    {
        public int[] Sizes { get; }
        public Neuron[][] Layers { get; }
        public float[][] Activations { get; }
        public int ParameterCount { get; }

        public NeuralNetwork(int[] sizes, Random random)
        {
            if (sizes == null || sizes.Length < 2 || sizes.Length > 6) throw new ArgumentException("Invalid layer count.");
            Sizes = (int[])sizes.Clone();
            Layers = new Neuron[sizes.Length - 1][];
            Activations = new float[sizes.Length][];
            for (int i = 0; i < sizes.Length; i++)
            {
                if (sizes[i] < 1 || sizes[i] > 32) throw new ArgumentException("Each layer needs 1–32 neurons.");
                Activations[i] = new float[sizes[i]];
            }
            for (int layer = 0; layer < Layers.Length; layer++)
            {
                Layers[layer] = new Neuron[sizes[layer + 1]];
                for (int n = 0; n < Layers[layer].Length; n++)
                {
                    Layers[layer][n] = new Neuron(sizes[layer], random);
                    ParameterCount += sizes[layer] + 1;
                }
            }
        }

        // Infer only changes the scratch values shown in the inspector, never weights or biases.
        // The returned buffer belongs to this network and is reused on the next call.
        public float[] Infer(float[] inputs)
        {
            if (inputs == null || inputs.Length != Sizes[0]) throw new ArgumentException("Wrong input count.");
            for (int i = 0; i < inputs.Length; i++)
            {
                if (!IsFinite(inputs[i])) throw new ArgumentException("Inputs must be finite.");
                Activations[0][i] = inputs[i];
            }
            for (int layer = 0; layer < Layers.Length; layer++)
                for (int n = 0; n < Layers[layer].Length; n++)
                    Activations[layer + 1][n] = Layers[layer][n].Infer(Activations[layer]);
            return Activations[Activations.Length - 1];
        }

        public NeuralNetwork Copy()
        {
            var result = new NeuralNetwork(Sizes, new Random(0));
            for (int l = 0; l < Layers.Length; l++)
                for (int n = 0; n < Layers[l].Length; n++) result.Layers[l][n] = Layers[l][n].Copy();
            return result;
        }

        public static bool IsFinite(float value) => !float.IsNaN(value) && !float.IsInfinity(value);
    }
}
