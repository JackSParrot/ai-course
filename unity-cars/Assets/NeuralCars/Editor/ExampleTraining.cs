using System;
using System.IO;
using UnityEditor;
using UnityEngine;

namespace NeuralCars.Editor
{
    // Generates a real evolved network; the bundled example is never a hard-coded steering rule.
    public static class ExampleTraining
    {
        private static GeneticTrainer trainer;
        public static string State { get; private set; } = "idle";
        public static int Generation => trainer?.Generation ?? 0;
        public static float Score => trainer?.BestScore ?? 0;

        [MenuItem("Neural Cars/Train bundled example (seed 42)")]
        public static void Start()
        {
            if (trainer != null) return;
            trainer = new GeneticTrainer(42, new RaceTrack());
            State = "training";
            EditorApplication.update += Tick;
        }

        private static void Tick()
        {
            double deadline = EditorApplication.timeSinceStartup + 0.015;
            while (EditorApplication.timeSinceStartup < deadline)
            {
                trainer.Step();
                if (!trainer.Evaluated) continue;
                if (trainer.BestScore >= 1200 || trainer.Generation >= 200)
                {
                    Save(); return;
                }
                trainer.NextGeneration();
            }
        }

        private static void Save()
        {
            const string folder = "Assets/NeuralCars/Resources/Example";
            Directory.CreateDirectory(folder);
            string id = "neural-cars-genetic-seed42-v1";
            File.WriteAllText(folder + "/network.json", ModelFiles.DefinitionJson(trainer.Champion, id));
            File.WriteAllText(folder + "/weights.json", ModelFiles.WeightsJson(trainer.Champion, id));
            File.WriteAllText(folder + "/training-record.json", JsonUtility.ToJson(new TrainingRecord {
                seed = 42, generation = trainer.Generation, population = GeneticTrainer.PopulationSize,
                trainingTrack = "oval", score = trainer.BestScore, method = "selection-and-mutation", fixedStep = NeuralCar.StepSeconds
            }, true));
            State = "saved";
            EditorApplication.update -= Tick;
            trainer = null;
            AssetDatabase.Refresh();
        }

        [Serializable]
        private sealed class TrainingRecord
        {
            public int seed, generation, population;
            public string trainingTrack, method;
            public float score, fixedStep;
        }
    }
}
