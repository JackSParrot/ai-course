using System;
using System.IO;
using System.Text;
using UnityEngine;
using UnityEngine.UIElements;

namespace NeuralCars
{
    public sealed class LabUi
    {
        private readonly LabController lab;
        private readonly VisualElement root;
        private readonly RaceView race;
        private readonly NetworkView network;
        private readonly TextField folder;
        private readonly Button play, next, champion, save;
        private readonly StringBuilder text = new StringBuilder(640);
        private bool showingFiles;

        public LabUi(LabController lab, VisualElement root)
        {
            this.lab = lab; this.root = root;
            root.Clear(); Resources.Load<VisualTreeAsset>("Lab").CloneTree(root);
            root.style.position = Position.Absolute;
            root.style.left = 0; root.style.right = 0; root.style.top = 0; root.style.bottom = 0;
            root.style.height = Length.Percent(100);
            root.Q("lab").style.height = Length.Percent(100);
            root.style.unityFontDefinition = FontDefinition.FromFont(Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf"));
            race = new RaceView(lab); root.Q("race-host").Add(race);
            network = new NetworkView(lab); root.Q("network-host").Add(network);
            folder = root.Q<TextField>("folder"); folder.multiline = true;
            folder.RegisterValueChangedCallback(evt => lab.ModelFolder = evt.newValue);
            SyncFolder();
            play = Button("controls", "play", lab.TogglePause); play.AddToClassList("primary");
            Button("controls", "step", () => { lab.Pause(); lab.Step(); });
            Button("controls", "restart", lab.Restart);
            Button("controls", "random", lab.NewRandom);
            Button("controls", "example", lab.LoadExample);
            Button("controls", "track", lab.ChangeTrack);
            Button("controls", "speed", () => lab.SpeedMultiplier = lab.SpeedMultiplier == 1 ? 8 : lab.SpeedMultiplier == 8 ? 64 : 1);
            Button("training-controls", "new-population", lab.StartTraining);
            next = Button("training-controls", "next", lab.NextGeneration);
            champion = Button("training-controls", "champion", lab.UseChampion);
            Button("training-controls", "automatic", () => lab.Automatic = !lab.Automatic);
            save = Button("save-controls", "save", lab.Save);
            Button("save-controls", "load", lab.Load);
            Button("file-controls", "open", ShowFiles);
            Button("file-controls", "verify", lab.VerifyRoundTrip);
            root.Q<Button>("language").clicked += () => { lab.ToggleLanguage(); Translate(); Refresh(); root.MarkDirtyRepaint(); };
            if (Application.isMobilePlatform) ConfigureMobile();
            Translate(); Refresh();
#if UNITY_ANDROID && !UNITY_EDITOR
            root.schedule.Execute(() => Debug.Log($"NeuralCars UI: root={root.layout}, page={root.Q("lab").layout}, workspace={root.Q(className: "workspace").layout}" )).StartingIn(1000);
#endif
        }

        private void ConfigureMobile()
        {
            VisualElement page = root.Q("lab"), driving = root.Q(className: "driving"), inspector = root.Q(className: "inspector");
            page.AddToClassList("mobile");
            var scroll = new ScrollView { name = "mobile-driving-scroll" };
            scroll.style.flexGrow = 1;
            scroll.verticalScrollerVisibility = ScrollerVisibility.Hidden;
            scroll.horizontalScrollerVisibility = ScrollerVisibility.Hidden;
            scroll.contentContainer.style.width = Length.Percent(100);
            ((ScrollView)inspector).horizontalScrollerVisibility = ScrollerVisibility.Hidden;
            ((ScrollView)inspector).contentContainer.style.width = Length.Percent(100);
            while (driving.childCount > 0) scroll.Add(driving[0]);
            driving.Add(scroll);
            var tabs = new VisualElement { name = "mobile-tabs" };
            tabs.AddToClassList("toolbar");
            page.Insert(1, tabs);
            Button("mobile-tabs", "driving-tab", () => { driving.style.display = DisplayStyle.Flex; inspector.style.display = DisplayStyle.None; });
            Button("mobile-tabs", "inspector-tab", () => { driving.style.display = DisplayStyle.None; inspector.style.display = DisplayStyle.Flex; });
            inspector.style.display = DisplayStyle.None;
        }

        private void ShowFiles()
        {
            if (Application.isMobilePlatform)
            {
                ModelFiles.Load(lab.ModelFolder);
                root.Q<Label>("file-preview").text = "network.json\n" + File.ReadAllText(Path.Combine(lab.ModelFolder, "network.json"))
                    + "\n\nweights.json\n" + File.ReadAllText(Path.Combine(lab.ModelFolder, "weights.json"));
                showingFiles = true;
                return;
            }
            string path = Directory.Exists(lab.ModelFolder) ? lab.ModelFolder : Path.Combine(Application.persistentDataPath, "Models");
            Directory.CreateDirectory(path); Application.OpenURL(new Uri(path + Path.DirectorySeparatorChar).AbsoluteUri);
        }

        private Button Button(string parent, string name, Action action)
        {
            var button = new Button(() => lab.Perform(action)) { name = name };
            root.Q(parent).Add(button); return button;
        }

        public void SyncFolder() => folder.SetValueWithoutNotify(lab.ModelFolder);
        private void Set(string name, string es, string en) => root.Q<TextElement>(name).text = lab.Text(es, en);

        private void Translate()
        {
            Set("eyebrow", "NEURAL LABS / UNITY · LABORATORIO EN C#", "NEURAL LABS / UNITY · C# LABORATORY");
            Set("title", "¿Dónde vive lo que aprende el coche?", "Where does the car's learning live?");
            Set("subtitle", "Sensores → código de la red → acciones. Los pesos son números que puedes guardar y volver a usar.", "Sensors → neural network code → actions. Weights are numbers you can save and reuse.");
            if (Application.isMobilePlatform)
            {
                Set("driving-tab", "Conducir y entrenar", "Drive and train");
                Set("inspector-tab", "Red y archivos", "Network and files");
            }
            Set("step", "Un paso · 1/60 s", "One step · 1/60 s"); Set("restart", "Repetir salida", "Restart car");
            Set("random", "Pesos al azar", "Random weights"); Set("example", "Cargar ejemplo", "Load example");
            Set("track", "Cambiar circuito", "Switch track");
            Set("training-title", "1. Entrenar: buscar mejores pesos", "1. Train: search for better weights");
            Set("training-explanation", "Evaluar → seleccionar → mutar copias. La red solo ve sus sensores. El entrenador usa el avance por la pista para puntuar.", "Evaluate → select → mutate copies. The network only sees its sensors. The trainer scores progress along the track.");
            Set("new-population", "Nueva población", "New population"); Set("next", "Siguiente generación", "Next generation");
            Set("champion", "Usar campeón", "Use champion");
            Set("network-title", "2. Inferencia: ejecutar la red", "2. Inference: execute the network");
            Set("legend", "Entradas: 10, 11, 12, 1 y 2 h. Salidas: acelerar, frenar, izquierda, derecha. Pulsa una neurona para ver sus pesos. Verde: peso positivo; coral: negativo.", "Inputs: 10, 11, 12, 1 and 2 o'clock. Outputs: accelerate, brake, left, right. Click a neuron to inspect its weights. Green: positive; coral: negative.");
            Set("save-title", "3. Guardar y cargar: código + datos", "3. Save and load: code + data");
            Set("save-explanation", "network.json describe las capas y qué significa cada número. weights.json guarda los pesos y sesgos. El código C# interpreta ambos. Este formato es propio del ejemplo.", "network.json describes layers and what each number means. weights.json stores weights and biases. C# code interprets both. This format belongs to this example.");
            Set("save", "Guardar red", "Save network"); Set("load", "Cargar carpeta", "Load folder");
            Set("open", "Ver archivos", "Open files"); Set("verify", "Comparar original y recargada", "Compare original and reloaded");
            folder.label = lab.Text("Carpeta del modelo", "Model folder");
            if (!showingFiles) Set("file-preview", "network.json\n{ sizes: [5, 6, 4], activation: sigmoid,\n  inputs: […], outputs: […] }\n\nweights.json\n{ layers: [ { neurons: [\n  { weights: [0.2, …], bias: -0.1 }, … ] }, … ] }\n\nEsquema abreviado. «Ver archivos» permite ver los JSON completos.", "network.json\n{ sizes: [5, 6, 4], activation: sigmoid,\n  inputs: […], outputs: […] }\n\nweights.json\n{ layers: [ { neurons: [\n  { weights: [0.2, …], bias: -0.1 }, … ] }, … ] }\n\nAbbreviated schema. Open files shows the complete JSON.");
            Set("inside-title", "¿Hace falta un plugin de IA?", "Do I need an AI plugin?");
            Set("inside", "Aquí no: Neuron.Infer multiplica entradas por pesos, suma el sesgo y aplica la sigmoide. NeuralNetwork.Infer encadena capas. NeuralCar.Step convierte las salidas en movimiento.\n\nJSON es el contenedor, no un formato universal de redes. ONNX es un formato de intercambio para modelos compatibles; un runtime debe soportar sus operaciones. Aquí no se usa ONNX.\n\nGuardar no guarda el programa ni toda la experiencia: guarda parámetros. El entrenamiento de este ejemplo usa selección y mutación, no corrección por gradiente.", "Here, no: Neuron.Infer multiplies inputs by weights, adds the bias and applies sigmoid. NeuralNetwork.Infer connects layers. NeuralCar.Step turns outputs into movement.\n\nJSON is the container, not a universal network format. ONNX is an exchange format for compatible models; a runtime must support its operations. This example does not use ONNX.\n\nSaving stores parameters, not program code or all experience. This example trains by selection and mutation, not gradient correction.");
        }

        public void Refresh()
        {
            NeuralCar car = lab.SelectedCar;
            play.text = lab.Paused ? lab.Text("Ejecutar", "Run") : lab.Text("Pausar", "Pause");
            Set("automatic", "Automático: " + (lab.Automatic ? "sí" : "no"), "Automatic: " + (lab.Automatic ? "on" : "off"));
            root.Q<Button>("automatic").EnableInClassList("primary", lab.Automatic);
            Set("speed", "Ritmo ×" + lab.SpeedMultiplier, "Speed ×" + lab.SpeedMultiplier);
            Set("mode", lab.Training ? "POBLACIÓN · se evalúan 24 redes" : "INFERENCIA · pesos fijos", lab.Training ? "POPULATION · evaluating 24 networks" : "INFERENCE · fixed weights");
            Set("race-info", $"{lab.Track.Name} · {car.Elapsed:F1} s · {car.Speed:F0} u/s · avance {100 * car.BestProgress / lab.Track.Length:F1}% · {(car.Crashed ? "choque" : car.Finished ? "intento terminado" : "en pista")}",
                $"{lab.Track.Name} · {car.Elapsed:F1} s · {car.Speed:F0} u/s · progress {100 * car.BestProgress / lab.Track.Length:F1}% · {(car.Crashed ? "crash" : car.Finished ? "attempt ended" : "on track")}");
            next.SetEnabled(lab.Training && lab.Trainer.Evaluated);
            champion.SetEnabled(lab.Trainer?.Champion != null);
            save.SetEnabled(!lab.Training || lab.Trainer.Champion != null);
            if (lab.Trainer != null)
            {
                var t = lab.Trainer;
                string score = float.IsNegativeInfinity(t.BestScore) ? "—" : t.BestScore.ToString("F1");
                Set("training-info", $"Generación {t.Generation} · mejor {score} · media {t.MeanScore:F1} · {(t.Evaluated ? "selección lista" : "evaluando")}\nÚltima mutación: {t.LastMutation}",
                    $"Generation {t.Generation} · best {score} · mean {t.MeanScore:F1} · {(t.Evaluated ? "selection ready" : "evaluating")}\nLatest mutation: {t.LastMutation}");
            }
            else Set("training-info", "Empieza con «Nueva población», pulsa «Ejecutar» y observa una evaluación.", "Choose New population, press Run and watch one evaluation.");
            text.Clear(); text.Append(lab.Text("Distancias / 220: ", "Distances / 220: "));
            for (int i = 0; i < 5; i++) text.Append(car.Inputs[i].ToString("F2")).Append(i < 4 ? " · " : "\n");
            string[] es = { "Acelerar", "Frenar", "Izquierda", "Derecha" }, en = { "Accelerate", "Brake", "Left", "Right" };
            for (int i = 0; i < 4; i++) text.Append(lab.Text(es[i], en[i])).Append(' ').Append(car.Outputs[i].ToString("F2")).Append(car.Actions[i] ? " ●  " : " ○  ");
            text.Append('\n').Append(car.Brain.ParameterCount).Append(lab.Text(" parámetros · umbral > 0,5", " parameters · threshold > 0.5"));
            root.Q<Label>("io").text = text.ToString();
            Neuron neuron = network.Selected;
            text.Clear(); text.Append(lab.Text("Capa ", "Layer ")).Append(network.SelectedLayer).Append(lab.Text(" · neurona ", " · neuron ")).Append(network.SelectedNeuron + 1).Append('\n');
            text.Append("w = [");
            for (int i = 0; i < neuron.weights.Length; i++) text.Append(neuron.weights[i].ToString("F3")).Append(i == neuron.weights.Length - 1 ? "]\n" : ", ");
            text.Append("bias = ").Append(neuron.bias.ToString("F3")).Append(" · sum = ").Append(neuron.LastSum.ToString("F3"));
            text.Append("\nsigmoid(sum) = ").Append(neuron.LastOutput.ToString("F4"));
            root.Q<Label>("neuron").text = text.ToString();
            root.Q<Label>("status").text = lab.Status;
            race.MarkDirtyRepaint(); network.MarkDirtyRepaint();
        }
    }
}
