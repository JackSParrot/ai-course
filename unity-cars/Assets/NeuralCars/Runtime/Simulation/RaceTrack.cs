using UnityEngine;

namespace NeuralCars
{
    public sealed class RaceTrack
    {
        public readonly Vector2[] Center;
        public readonly Vector2[] Outer;
        public readonly Vector2[] Inner;
        public readonly string Name;
        public readonly float Width;
        public float Length { get; private set; }
        private readonly float[] lengths;

        public RaceTrack(bool reserved = false)
        {
            Name = reserved ? "Circuito reservado / Held-out track" : "Óvalo / Oval";
            Width = reserved ? 104 : 124;
            const int count = 64;
            Center = new Vector2[count]; Outer = new Vector2[count]; Inner = new Vector2[count];
            lengths = new float[count];
            for (int i = 0; i < count; i++)
            {
                float angle = i * Mathf.PI * 2 / count;
                float bend = reserved ? 1 + 0.12f * Mathf.Sin(3 * angle) : 1;
                Center[i] = new Vector2(530 + 350 * Mathf.Cos(angle) * bend, 360 + 220 * Mathf.Sin(angle));
            }
            for (int i = 0; i < count; i++)
            {
                Vector2 tangent = (Center[(i + 1) % count] - Center[(i + count - 1) % count]).normalized;
                Vector2 normal = new Vector2(tangent.y, -tangent.x);
                Outer[i] = Center[i] + normal * Width / 2;
                Inner[i] = Center[i] - normal * Width / 2;
                lengths[i] = Vector2.Distance(Center[i], Center[(i + 1) % count]);
                Length += lengths[i];
            }
        }

        public Vector2 Start => Center[48];
        public float StartAngle => Mathf.Atan2(Center[49].y - Start.y, Center[49].x - Start.x);

        public float Sense(Vector2 origin, Vector2 direction, float range)
        {
            float nearest = range;
            for (int i = 0; i < Center.Length; i++)
            {
                nearest = Mathf.Min(nearest, RaySegment(origin, direction, Outer[i], Outer[(i + 1) % Center.Length], range));
                nearest = Mathf.Min(nearest, RaySegment(origin, direction, Inner[i], Inner[(i + 1) % Center.Length], range));
            }
            return nearest;
        }

        private static float Cross(Vector2 a, Vector2 b) => a.x * b.y - a.y * b.x;

        public static float RaySegment(Vector2 origin, Vector2 direction, Vector2 a, Vector2 b, float range)
        {
            Vector2 edge = b - a;
            float divisor = Cross(direction, edge);
            if (Mathf.Abs(divisor) < 0.00001f) return range;
            float distance = Cross(a - origin, edge) / divisor;
            float offset = Cross(a - origin, direction) / divisor;
            return distance >= 0 && distance <= range && offset >= 0 && offset <= 1 ? distance : range;
        }

        public bool OnRoad(Vector2 point) => Inside(point, Outer) && !Inside(point, Inner);

        private static bool Inside(Vector2 point, Vector2[] polygon)
        {
            bool inside = false;
            for (int i = 0, j = polygon.Length - 1; i < polygon.Length; j = i++)
            {
                Vector2 a = polygon[i], b = polygon[j];
                if ((a.y > point.y) != (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x)
                    inside = !inside;
            }
            return inside;
        }

        // Only the evaluator sees route progress. These coordinates never enter the neural network.
        public float ProgressAt(Vector2 point)
        {
            float best = float.MaxValue, walked = 0, result = 0;
            for (int i = 0; i < Center.Length; i++)
            {
                Vector2 a = Center[i], edge = Center[(i + 1) % Center.Length] - a;
                float t = Mathf.Clamp01(Vector2.Dot(point - a, edge) / edge.sqrMagnitude);
                float distance = (point - a - t * edge).sqrMagnitude;
                if (distance < best) { best = distance; result = walked + t * lengths[i]; }
                walked += lengths[i];
            }
            return result;
        }
    }
}
