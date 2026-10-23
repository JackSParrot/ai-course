using System;

namespace NeuralCars
{
    [Serializable]
    public sealed class Neuron
    {
        public float[] weights;
        public float bias;
        [NonSerialized] public float LastSum;
        [NonSerialized] public float LastOutput;

        public Neuron(int inputCount, Random random)
        {
            weights = new float[inputCount];
            for (int i = 0; i < inputCount; i++) weights[i] = (float)(random.NextDouble() * 2 - 1);
            bias = (float)(random.NextDouble() * 2 - 1);
        }

        public float Infer(float[] inputs)
        {
            float sum = bias;
            for (int i = 0; i < weights.Length; i++) sum += inputs[i] * weights[i];
            LastSum = sum;
            LastOutput = (float)(1 / (1 + Math.Exp(-sum)));
            return LastOutput;
        }

        public Neuron Copy()
        {
            return new Neuron(weights.Length, new Random(0)) { weights = (float[])weights.Clone(), bias = bias };
        }
    }
}
