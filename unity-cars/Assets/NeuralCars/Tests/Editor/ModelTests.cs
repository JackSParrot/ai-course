using System;
using System.IO;
using NUnit.Framework;
using UnityEngine;

namespace NeuralCars.Tests
{
    public sealed class ModelTests
    {
        private static NeuralNetwork Network() => new NeuralNetwork(new[] { 5, 6, 4 }, new System.Random(42));

        [Test]
        public void NeuronMultipliesWeightsAddsBiasAndAppliesSigmoid()
        {
            var neuron = new Neuron(2, new System.Random(0)) { weights = new[] { 2f, -1f }, bias = 0.5f };
            Assert.That(neuron.Infer(new[] { 0.25f, 0.5f }), Is.EqualTo(1 / (1 + Math.Exp(-0.5))).Within(0.000001));
        }

        [Test] public void ParameterCountIncludesBiases() => Assert.That(Network().ParameterCount, Is.EqualTo(64));

        [Test]
        public void InferenceDoesNotChangeParameters()
        {
            var net = Network(); string before = ModelFiles.WeightsJson(net, "test");
            for (int i = 0; i < 20; i++) net.Infer(new[] { i / 20f, 0.1f, 0.4f, 0.8f, 1f });
            Assert.That(ModelFiles.WeightsJson(net, "test"), Is.EqualTo(before));
        }

        [TestCase(0f)] [TestCase(0.13f)] [TestCase(1f)]
        public void JsonRoundTripPreservesOutputs(float value)
        {
            var original = Network();
            var loaded = ModelFiles.Parse(ModelFiles.DefinitionJson(original, "test"), ModelFiles.WeightsJson(original, "test"));
            var inputs = new[] { value, 0.2f, 0.9f, 0.3f, 0.6f };
            Assert.That(loaded.Infer(inputs), Is.EqualTo(original.Infer(inputs)).Within(0.000001));
            Assert.That(ModelFiles.WeightsJson(loaded, "test"), Is.EqualTo(ModelFiles.WeightsJson(original, "test")));
        }

        [Test]
        public void CloneMutationLeavesParentUntouched()
        {
            var original = Network(); string before = ModelFiles.WeightsJson(original, "test");
            var child = original.Copy(); GeneticTrainer.Mutate(child, new System.Random(9), 0, 0.2f);
            Assert.That(ModelFiles.WeightsJson(original, "test"), Is.EqualTo(before));
            Assert.That(ModelFiles.WeightsJson(child, "test"), Is.Not.EqualTo(before));
        }

        [Test]
        public void MixedFilesAreRejected()
        {
            var net = Network();
            Assert.Throws<InvalidDataException>(() => ModelFiles.Parse(ModelFiles.DefinitionJson(net, "a"), ModelFiles.WeightsJson(net, "b")));
        }

        [TestCase("inputs")] [TestCase("outputs")] [TestCase("version")] [TestCase("activation")] [TestCase("sensorLength")]
        public void IncompatibleDefinitionIsRejected(string field)
        {
            var net = Network(); var definition = ModelDefinition.Create(net.Sizes); definition.modelId = "test";
            switch (field)
            {
                case "inputs": definition.inputs[0] = "distance-2h/220"; break;
                case "outputs": definition.outputs[0] = "brake"; break;
                case "version": definition.version = 2; break;
                case "activation": definition.activation = "relu"; break;
                case "sensorLength": definition.sensorLength = 440; break;
            }
            Assert.Throws<InvalidDataException>(() => ModelFiles.Parse(JsonUtility.ToJson(definition), ModelFiles.WeightsJson(net, "test")));
        }

        [Test]
        public void MissingWeightsAreRejected()
        {
            var net = Network();
            Assert.Throws<InvalidDataException>(() => ModelFiles.Parse(ModelFiles.DefinitionJson(net, "test"), "{\"version\":1,\"modelId\":\"test\",\"layers\":[]}"));
        }

        [Test]
        public void NonFiniteParametersAreRejected()
        {
            var net = Network(); net.Layers[0][0].bias = float.PositiveInfinity;
            Assert.Throws<InvalidDataException>(() => ModelFiles.Parse(ModelFiles.DefinitionJson(net, "test"), ModelFiles.WeightsJson(net, "test")));
        }

        [Test]
        public void InputsAreChecked()
        {
            var net = Network();
            Assert.Throws<ArgumentException>(() => net.Infer(new[] { 1f }));
            Assert.Throws<ArgumentException>(() => net.Infer(new[] { float.NaN, 0, 0, 0, 0 }));
        }

        [Test]
        public void DiskSaveCreatesTwoFilesAndDoesNotOverwriteEarlierExport()
        {
            string root = Path.Combine(Path.GetTempPath(), "neural-cars-test-" + Guid.NewGuid().ToString("N"));
            try
            {
                var net = Network(); string first = ModelFiles.Save(root, net);
                string before = File.ReadAllText(Path.Combine(first, "weights.json"));
                string second = ModelFiles.Save(root, net);
                Assert.That(second, Is.Not.EqualTo(first));
                Assert.That(File.ReadAllText(Path.Combine(first, "weights.json")), Is.EqualTo(before));
                Assert.That(ModelFiles.Load(first).Infer(new float[5]), Is.EqualTo(net.Infer(new float[5])).Within(0.000001));
            }
            finally { if (Directory.Exists(root)) Directory.Delete(root, true); }
        }

        [Test]
        public void FailedSaveLeavesExistingFileIntact()
        {
            string file = Path.Combine(Path.GetTempPath(), "neural-cars-" + Guid.NewGuid().ToString("N"));
            try
            {
                File.WriteAllText(file, "keep");
                Assert.Catch<IOException>(() => ModelFiles.Save(file, Network()));
                Assert.That(File.ReadAllText(file), Is.EqualTo("keep"));
            }
            finally { File.Delete(file); }
        }

        [Test]
        public void IdenticalWeightsAndStepsProduceIdenticalDriving()
        {
            var a = new NeuralCar(Network(), new RaceTrack());
            var b = new NeuralCar(Network(), new RaceTrack());
            for (int i = 0; i < 600; i++) { a.Step(); b.Step(); }
            Assert.That(a.Position, Is.EqualTo(b.Position)); Assert.That(a.Score, Is.EqualTo(b.Score));
        }

        [Test]
        public void RayDetectsNearestWallAndMissUsesFullRange()
        {
            Assert.That(RaceTrack.RaySegment(Vector2.zero, Vector2.right, new Vector2(10, -2), new Vector2(10, 2), 220), Is.EqualTo(10));
            Assert.That(RaceTrack.RaySegment(Vector2.zero, Vector2.left, new Vector2(10, -2), new Vector2(10, 2), 220), Is.EqualTo(220));
        }

        [Test]
        public void BundledExampleCompletesOvalWithoutChangingItsParameters()
        {
            var net = ModelFiles.Parse(Resources.Load<TextAsset>("Example/network").text, Resources.Load<TextAsset>("Example/weights").text);
            string before = ModelFiles.WeightsJson(net, "test");
            var car = new NeuralCar(net, new RaceTrack());
            for (int i = 0; i < 1400; i++) car.Step();
            Assert.That(car.Crashed, Is.False);
            Assert.That(car.Score, Is.GreaterThan(1200));
            Assert.That(ModelFiles.WeightsJson(net, "test"), Is.EqualTo(before));
        }

        [Test]
        public void EliteKeepsBestEvaluationAcrossGenerations()
        {
            var trainer = new GeneticTrainer(42, new RaceTrack());
            while (!trainer.Evaluated) trainer.Step();
            float best = trainer.BestScore;
            string champion = ModelFiles.WeightsJson(trainer.Champion, "test");
            trainer.NextGeneration();
            Assert.That(ModelFiles.WeightsJson(trainer.Cars[0].Brain, "test"), Is.EqualTo(champion));
            while (!trainer.Evaluated) trainer.Step();
            Assert.That(trainer.BestScore, Is.GreaterThanOrEqualTo(best));
        }
    }
}
