using UnityEngine;
using UnityEngine.UIElements;

namespace NeuralCars
{
    public sealed class RaceView : VisualElement
    {
        private readonly LabController lab;
        public RaceView(LabController lab)
        {
            this.lab = lab; AddToClassList("race-view");
            generateVisualContent += Draw;
        }

        private void Draw(MeshGenerationContext context)
        {
            if (lab.Track == null || contentRect.width < 1) return;
            Painter2D p = context.painter2D;
            float scale = Mathf.Min(contentRect.width / 1060, contentRect.height / 720);
            Vector2 offset = new Vector2((contentRect.width - 1060 * scale) / 2, (contentRect.height - 720 * scale) / 2);
            Polygon(p, lab.Track.Outer, scale, offset, new Color(0.25f, 0.31f, 0.36f));
            Polygon(p, lab.Track.Inner, scale, offset, new Color(0.08f, 0.16f, 0.17f));
            LineLoop(p, lab.Track.Outer, scale, offset, new Color(0.63f, 0.77f, 0.79f), 2);
            LineLoop(p, lab.Track.Inner, scale, offset, new Color(0.63f, 0.77f, 0.79f), 2);
            p.strokeColor = new Color(0.65f, 0.73f, 0.65f, 0.5f); p.lineWidth = 1;
            for (int i = 0; i < lab.Track.Center.Length; i += 2)
            {
                p.BeginPath(); p.MoveTo(offset + lab.Track.Center[i] * scale);
                p.LineTo(offset + lab.Track.Center[(i + 1) % lab.Track.Center.Length] * scale); p.Stroke();
            }
            if (lab.Training)
                for (int i = 0; i < lab.Trainer.Cars.Length; i++)
                    DrawCar(p, lab.Trainer.Cars[i], scale, offset, new Color(0.46f, 0.61f, 0.82f, 0.5f));
            NeuralCar car = lab.SelectedCar;
            if (car == null) return;
            p.lineWidth = 1.5f;
            for (int i = 0; i < 5; i++)
            {
                p.strokeColor = Color.Lerp(new Color(1, 0.42f, 0.36f), new Color(0.38f, 0.93f, 0.79f), car.Inputs[i]);
                p.BeginPath(); p.MoveTo(offset + car.Position * scale); p.LineTo(offset + car.SensorEnds[i] * scale); p.Stroke();
            }
            DrawCar(p, car, scale, offset, car.Crashed ? new Color(1, 0.42f, 0.36f) : new Color(1, 0.79f, 0.31f));
        }

        private static void DrawCar(Painter2D p, NeuralCar car, float scale, Vector2 offset, Color color)
        {
            Vector2 a = offset + car.Corner(1, -1) * scale, b = offset + car.Corner(1, 1) * scale;
            p.fillColor = color; p.BeginPath(); p.MoveTo(a); p.LineTo(b);
            p.LineTo(offset + car.Corner(-1, 1) * scale); p.LineTo(offset + car.Corner(-1, -1) * scale); p.ClosePath(); p.Fill();
            p.strokeColor = Color.white; p.lineWidth = 2; p.BeginPath(); p.MoveTo(a); p.LineTo(b); p.Stroke();
        }

        private static void Polygon(Painter2D p, Vector2[] vertices, float scale, Vector2 offset, Color color)
        {
            p.fillColor = color; Path(p, vertices, scale, offset); p.Fill();
        }

        private static void LineLoop(Painter2D p, Vector2[] vertices, float scale, Vector2 offset, Color color, float width)
        {
            p.strokeColor = color; p.lineWidth = width; Path(p, vertices, scale, offset); p.Stroke();
        }

        private static void Path(Painter2D p, Vector2[] vertices, float scale, Vector2 offset)
        {
            p.BeginPath(); p.MoveTo(offset + vertices[0] * scale);
            for (int i = 1; i < vertices.Length; i++) p.LineTo(offset + vertices[i] * scale);
            p.ClosePath();
        }
    }
}
