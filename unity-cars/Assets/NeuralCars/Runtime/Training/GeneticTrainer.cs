using System;
using UnityEngine;

namespace NeuralCars
{
    public sealed class GeneticTrainer
    {
        public const int PopulationSize = 24;
        public NeuralCar[] Cars { get; private set; }
        public NeuralNetwork Champion { get; private set; }
        public int Generation { get; private set; } = 1;
        public float BestScore { get; private set; } = float.NegativeInfinity;
        public float MeanScore { get; private set; }
        public string LastMutation { get; private set; } = "—";
        public bool Evaluated { get; private set; }
        private readonly System.Random random;
        private readonly RaceTrack track;
        private readonly int[] ranking = new int[PopulationSize];
        private readonly Comparison<int> compare;

        public GeneticTrainer(int seed, RaceTrack track)
        {
            random = new System.Random(seed); this.track = track;
            compare = CompareScores;
            Cars = new NeuralCar[PopulationSize];
            for (int i = 0; i < Cars.Length; i++) Cars[i] = new NeuralCar(new NeuralNetwork(new[] { 5, 6, 4 }, random), track);
        }

        private int CompareScores(int a, int b)
        {
            int result = Cars[b].Score.CompareTo(Cars[a].Score);
            return result == 0 ? a.CompareTo(b) : result;
        }

        public void Step()
        {
            if (Evaluated) return;
            bool done = true;
            for (int i = 0; i < Cars.Length; i++) { Cars[i].Step(); if (!Cars[i].Finished) done = false; }
            if (!done) return;
            MeanScore = 0;
            for (int i = 0; i < Cars.Length; i++) { ranking[i] = i; MeanScore += Cars[i].Score / Cars.Length; }
            Array.Sort(ranking, compare);
            if (Cars[ranking[0]].Score > BestScore)
            {
                BestScore = Cars[ranking[0]].Score;
                Champion = Cars[ranking[0]].Brain.Copy();
            }
            Evaluated = true;
        }

        public void NextGeneration()
        {
            if (!Evaluated) throw new InvalidOperationException("Evaluate the population first.");
            var next = new NeuralCar[PopulationSize];
            for (int i = 0; i < next.Length; i++)
            {
                NeuralNetwork brain;
                if (i < 2) brain = Cars[ranking[i]].Brain.Copy();
                else if (i >= 22) brain = new NeuralNetwork(new[] { 5, 6, 4 }, random);
                else
                {
                    brain = Cars[ranking[random.Next(6)]].Brain.Copy();
                    LastMutation = Mutate(brain, random, 0.12f, 0.2f);
                }
                next[i] = new NeuralCar(brain, track);
            }
            Cars = next; Generation++; Evaluated = false;
        }

        public NeuralCar Leader
        {
            get
            {
                NeuralCar best = Cars[0];
                for (int i = 1; i < Cars.Length; i++) if (Cars[i].Score > best.Score) best = Cars[i];
                return best;
            }
        }

        public static string Mutate(NeuralNetwork network, System.Random random, float probability, float amount)
        {
            string first = null;
            for (int l = 0; l < network.Layers.Length; l++)
                for (int n = 0; n < network.Layers[l].Length; n++)
                {
                    Neuron neuron = network.Layers[l][n];
                    for (int w = 0; w < neuron.weights.Length; w++)
                        if (random.NextDouble() < probability)
                        {
                            float before = neuron.weights[w];
                            neuron.weights[w] += Delta(random, amount);
                            if (first == null) first = $"L{l + 1} N{n + 1} W{w + 1}: {before:F3} → {neuron.weights[w]:F3}";
                        }
                    if (random.NextDouble() < probability) neuron.bias += Delta(random, amount);
                }
            // Force a visible changed weight, including when chance only changed biases.
            if (first == null)
            {
                float before = network.Layers[0][0].weights[0];
                network.Layers[0][0].weights[0] += Delta(random, amount);
                first = $"L1 N1 W1: {before:F3} → {network.Layers[0][0].weights[0]:F3}";
            }
            return first;
        }

        private static float Delta(System.Random random, float amount)
        {
            float delta = (float)(random.NextDouble() * 2 - 1) * amount;
            return delta == 0 ? amount / 2 : delta;
        }
    }
}
