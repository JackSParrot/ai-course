using UnityEngine;
using UnityEngine.UIElements;

namespace NeuralCars
{
    public sealed class NetworkView : VisualElement
    {
        private readonly LabController lab;
        public int SelectedLayer { get; private set; } = 1;
        public int SelectedNeuron { get; private set; }

        public NetworkView(LabController lab)
        {
            this.lab = lab; AddToClassList("network-view");
            generateVisualContent += Draw;
            RegisterCallback<PointerDownEvent>(Pick);
        }

        private Vector2 Node(int layer, int neuron, NeuralNetwork brain)
        {
            return new Vector2(35 + (contentRect.width - 70) * layer / (brain.Sizes.Length - 1),
                22 + (contentRect.height - 44) * (neuron + 0.5f) / brain.Sizes[layer]);
        }

        private void Pick(PointerDownEvent evt)
        {
            NeuralNetwork brain = lab.SelectedCar?.Brain;
            if (brain == null) return;
            for (int l = 1; l < brain.Sizes.Length; l++)
                for (int n = 0; n < brain.Sizes[l]; n++)
                    if (Vector2.Distance(evt.localPosition, Node(l, n, brain)) < 19)
                    { SelectedLayer = l; SelectedNeuron = n; MarkDirtyRepaint(); return; }
        }

        public Neuron Selected
        {
            get
            {
                NeuralNetwork brain = lab.SelectedCar?.Brain;
                if (brain == null) return null;
                SelectedLayer = Mathf.Clamp(SelectedLayer, 1, brain.Sizes.Length - 1);
                SelectedNeuron = Mathf.Clamp(SelectedNeuron, 0, brain.Sizes[SelectedLayer] - 1);
                return brain.Layers[SelectedLayer - 1][SelectedNeuron];
            }
        }

        private void Draw(MeshGenerationContext context)
        {
            NeuralNetwork brain = lab.SelectedCar?.Brain;
            if (brain == null || contentRect.width < 1) return;
            Painter2D p = context.painter2D;
            for (int l = 1; l < brain.Sizes.Length; l++)
                for (int n = 0; n < brain.Sizes[l]; n++)
                    for (int i = 0; i < brain.Sizes[l - 1]; i++)
                    {
                        float weight = brain.Layers[l - 1][n].weights[i];
                        bool selected = l == SelectedLayer && n == SelectedNeuron;
                        p.strokeColor = weight >= 0 ? new Color(0.30f, 0.88f, 0.77f, selected ? 0.85f : 0.17f) : new Color(1, 0.47f, 0.39f, selected ? 0.85f : 0.17f);
                        p.lineWidth = selected ? 1 + Mathf.Min(Mathf.Abs(weight), 2) : 1;
                        p.BeginPath(); p.MoveTo(Node(l - 1, i, brain)); p.LineTo(Node(l, n, brain)); p.Stroke();
                    }
            for (int l = 0; l < brain.Sizes.Length; l++)
                for (int n = 0; n < brain.Sizes[l]; n++)
                {
                    Vector2 pos = Node(l, n, brain);
                    p.fillColor = Color.Lerp(new Color(0.11f, 0.19f, 0.25f), new Color(0.18f, 0.66f, 0.56f), brain.Activations[l][n]);
                    p.strokeColor = l == SelectedLayer && n == SelectedNeuron ? new Color(1, 0.79f, 0.31f) : new Color(0.5f, 0.68f, 0.72f);
                    p.lineWidth = 2; p.BeginPath(); p.Arc(pos, 17, Angle.Degrees(0), Angle.Degrees(360)); p.Fill(); p.Stroke();
                    context.DrawText(brain.Activations[l][n].ToString("F2"), pos + new Vector2(-12, -7), 11, Color.white, null);
                }
        }
    }
}
