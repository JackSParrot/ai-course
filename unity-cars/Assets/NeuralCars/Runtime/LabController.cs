using System;
using System.IO;
using UnityEngine;
using UnityEngine.UIElements;

namespace NeuralCars
{
    [RequireComponent(typeof(UIDocument))]
    public sealed class LabController : MonoBehaviour
    {
        public RaceTrack Track { get; private set; }
        public GeneticTrainer Trainer { get; private set; }
        public NeuralCar Car { get; private set; }
        public bool Training { get; private set; }
        public bool Paused { get; private set; } = true;
        public bool Automatic { get; set; }
        public int SpeedMultiplier { get; set; } = 1;
        public string Status { get; private set; } = "";
        public string ModelFolder { get; set; }
        public string Source { get; private set; }
        public NeuralCar SelectedCar => Training ? Trainer.Leader : Car;
        public bool English { get; private set; }
        private LabUi ui;
        private float accumulator;
        private int seed = 4;
        private float nextUi;
        public string Text(string es, string en) => English ? en : es;

        private void Start()
        {
            Application.runInBackground = true;
            Application.targetFrameRate = 60;
            var document = GetComponent<UIDocument>();
            if (document.panelSettings == null) document.panelSettings = Resources.Load<PanelSettings>("LabPanel");
            if (Application.isMobilePlatform)
            {
                document.panelSettings.referenceResolution = new Vector2Int(1100, 650);
                document.panelSettings.match = 1;
            }
            Track = new RaceTrack();
            ModelFolder = PlayerPrefs.GetString("neural-cars.last-model", Path.Combine(Application.persistentDataPath, "Models"));
            NewRandom();
            ui = new LabUi(this, document.rootVisualElement);
        }

        private void Update()
        {
            if (ui == null) return;
            if (!Paused)
            {
                accumulator += Mathf.Min(Time.unscaledDeltaTime, 0.1f) * SpeedMultiplier;
                double deadline = Time.realtimeSinceStartupAsDouble + 0.008;
                int steps = 0;
                while (accumulator >= NeuralCar.StepSeconds && steps++ < 240 && Time.realtimeSinceStartupAsDouble < deadline)
                { Step(); accumulator -= NeuralCar.StepSeconds; if (Paused) break; }
                accumulator = Mathf.Min(accumulator, 0.25f);
            }
            if (Time.unscaledTime >= nextUi) { ui.Refresh(); nextUi = Time.unscaledTime + 0.1f; }
        }

        public void TogglePause() { Paused = !Paused; accumulator = 0; }
        public void Pause() { Paused = true; accumulator = 0; }
        public void ToggleLanguage()
        {
            English = !English;
            Status = Text("Idioma: español. Los pesos y la simulación se conservan.", "Language: English. Weights and simulation state are preserved.");
        }

        public void Step()
        {
            if (Training)
            {
                if (Trainer.Evaluated)
                {
                    if (Automatic) Trainer.NextGeneration();
                    else { Pause(); return; }
                }
                Trainer.Step();
                if (Trainer.Evaluated && !Automatic) Pause();
            }
            else { Car.Step(); if (Car.Finished) Pause(); }
        }

        public void NewRandom()
        {
            Pause(); Training = false;
            Car = new NeuralCar(new NeuralNetwork(new[] { 5, 6, 4 }, new System.Random(seed++)), Track);
            Source = "Random / Aleatoria";
            Status = Text("Pesos nuevos al azar. Puedes guardar esta red también.", "New random weights. This network can also be saved.");
        }

        public void Restart()
        {
            if (Training) { Status = Text("Pausa o continúa la población; usa «Nueva población» para empezar de cero.", "Pause or resume the population; use New population to start over."); return; }
            Car = new NeuralCar(Car.Brain, Track); Pause();
        }

        public void StartTraining()
        {
            Pause(); Track = new RaceTrack(); Trainer = new GeneticTrainer(42, Track); Training = true;
            Status = Text("24 redes nuevas · 2 élites · 20 copias mutadas · 2 nuevas. Semilla 42.", "24 new networks · 2 elites · 20 mutated copies · 2 newcomers. Seed 42.");
        }

        public void NextGeneration()
        {
            if (!Training || !Trainer.Evaluated) { Status = Text("Primero termina de evaluar la población.", "Finish evaluating the population first."); return; }
            Trainer.NextGeneration(); Pause();
        }

        public void UseChampion()
        {
            if (Trainer?.Champion == null) { Status = Text("Todavía no hay campeón. Evalúa una generación.", "No champion yet. Evaluate one generation."); return; }
            Training = false; Pause(); Car = new NeuralCar(Trainer.Champion.Copy(), Track);
            Source = "Champion / Campeón";
            Status = Text("Campeón copiado al coche. Conducir no entrena.", "Champion copied to the car. Driving does not train.");
        }

        public void ChangeTrack()
        {
            if (Training) { Status = Text("Pasa el campeón a inferencia antes de cambiar de circuito.", "Use the champion for inference before switching tracks."); return; }
            Track = new RaceTrack(Track.Name.StartsWith("Óvalo")); Restart();
            Status = Text("Mismos pesos, otro entorno. Este circuito no entra en el entrenamiento.", "Same weights, another environment. This track is excluded from training.");
        }

        public void LoadExample()
        {
            var definition = Resources.Load<TextAsset>("Example/network");
            var weights = Resources.Load<TextAsset>("Example/weights");
            if (definition == null || weights == null) throw new FileNotFoundException("Bundled example is missing.");
            Apply(ModelFiles.Parse(definition.text, weights.text), "Example / Ejemplo");
        }

        private void Apply(NeuralNetwork brain, string source)
        {
            // Build and validate before swapping: a failed load keeps the current car and trainer.
            var next = new NeuralCar(brain, Track);
            Pause(); Training = false; Car = next; Source = source;
            Status = Text("Red cargada. Solo se ejecuta inferencia en C# local.", "Network loaded. Only local C# inference runs.");
        }

        public void Save()
        {
            NeuralNetwork brain = Training ? Trainer.Champion : Car.Brain;
            if (brain == null) throw new InvalidOperationException("Evaluate a generation before saving its champion.");
            ModelFolder = ModelFiles.Save(Path.Combine(Application.persistentDataPath, "Models"), brain);
            PlayerPrefs.SetString("neural-cars.last-model", ModelFolder);
            PlayerPrefs.Save();
            Status = Text("Guardados network.json y weights.json en una carpeta nueva.", "Saved network.json and weights.json in a new folder.");
            ui.SyncFolder();
        }

        public void Load() => Apply(ModelFiles.Load(ModelFolder), "File / Archivo");

        public void VerifyRoundTrip()
        {
            NeuralNetwork source = SelectedCar.Brain;
            string id = Guid.NewGuid().ToString("N");
            NeuralNetwork loaded = ModelFiles.Parse(ModelFiles.DefinitionJson(source, id), ModelFiles.WeightsJson(source, id));
            float[] inputs = (float[])SelectedCar.Inputs.Clone();
            float[] a = source.Infer(inputs), b = loaded.Infer(inputs);
            float difference = 0;
            for (int i = 0; i < a.Length; i++) difference = Mathf.Max(difference, Mathf.Abs(a[i] - b[i]));
            Status = Text("Mismas entradas → red original y recargada. Diferencia máxima: ", "Same inputs → original and reloaded network. Maximum difference: ") + difference.ToString("G6");
        }

        public void Perform(Action operation)
        {
            try { operation(); }
            catch (Exception exception)
            {
                Status = Text("No se pudo completar. Comprueba la carpeta y los dos JSON: ", "Could not complete. Check the folder and both JSON files: ") + exception.Message;
                Debug.LogWarning(Status);
            }
            ui.Refresh();
        }
    }
}
