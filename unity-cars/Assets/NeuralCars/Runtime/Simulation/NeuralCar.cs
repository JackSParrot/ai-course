using UnityEngine;

namespace NeuralCars
{
    public sealed class NeuralCar
    {
        public const float StepSeconds = 1f / 60;
        public const float SensorRange = 220;
        public const float MaximumSpeed = 165;
        public const float Length = 34, Width = 18;
        public NeuralNetwork Brain { get; }
        public Vector2 Position { get; private set; }
        public float Angle { get; private set; }
        public float Speed { get; private set; }
        public bool Crashed { get; private set; }
        public bool Finished => Crashed || Elapsed >= 22 || idleTime >= 3 || BestProgress >= track.Length;
        public float Elapsed { get; private set; }
        public float BestProgress { get; private set; }
        public float Score => 1000 * BestProgress / track.Length + (BestProgress >= track.Length ? 200 + 100 * (1 - Elapsed / 22) : 0) - (Crashed ? 25 : 0) - (idleTime >= 3 ? 15 : 0);
        public readonly float[] Inputs = new float[5];
        public readonly float[] Outputs = new float[4];
        public readonly Vector2[] SensorEnds = new Vector2[5];
        public readonly bool[] Actions = new bool[4];
        private readonly RaceTrack track;
        private float lastProgress, progress, idleTime;

        public NeuralCar(NeuralNetwork brain, RaceTrack track)
        {
            if (brain.Sizes[0] != 5 || brain.Sizes[brain.Sizes.Length - 1] != 4) throw new System.ArgumentException("Driver needs 5 inputs and 4 outputs.");
            Brain = brain; this.track = track;
            Position = track.Start; Angle = track.StartAngle;
            lastProgress = track.ProgressAt(Position);
            Think();
        }

        private void Think()
        {
            for (int i = 0; i < Inputs.Length; i++)
            {
                float angle = Angle + (i - 2) * 30 * Mathf.Deg2Rad;
                Vector2 direction = new Vector2(Mathf.Cos(angle), Mathf.Sin(angle));
                float distance = track.Sense(Position, direction, SensorRange);
                Inputs[i] = distance / SensorRange;
                SensorEnds[i] = Position + direction * distance;
            }
            float[] output = Brain.Infer(Inputs);
            for (int i = 0; i < 4; i++) { Outputs[i] = output[i]; Actions[i] = !Finished && output[i] > 0.5f; }
        }

        public void Step()
        {
            if (Finished) return;
            Think();
            if (Actions[1]) Speed -= 200 * StepSeconds;
            else if (Actions[0]) Speed += 95 * StepSeconds;
            else Speed -= 28 * StepSeconds;
            Speed = Mathf.Clamp(Speed, 0, MaximumSpeed);
            Angle += ((Actions[3] ? 1 : 0) - (Actions[2] ? 1 : 0)) * 2.1f * (Speed / MaximumSpeed) * StepSeconds;
            Position += new Vector2(Mathf.Cos(Angle), Mathf.Sin(Angle)) * Speed * StepSeconds;
            for (int x = -1; x <= 1; x += 2)
                for (int y = -1; y <= 1; y += 2)
                    if (!track.OnRoad(Corner(x, y))) Crashed = true;

            float now = track.ProgressAt(Position), delta = now - lastProgress;
            if (delta > track.Length / 2) delta -= track.Length;
            if (delta < -track.Length / 2) delta += track.Length;
            progress += delta; lastProgress = now;
            if (progress > BestProgress + 0.05f) { BestProgress = progress; idleTime = 0; }
            else idleTime += StepSeconds;
            Elapsed += StepSeconds;
            if (Finished) System.Array.Clear(Actions, 0, Actions.Length);
        }

        public Vector2 Corner(int x, int y)
        {
            Vector2 front = new Vector2(Mathf.Cos(Angle), Mathf.Sin(Angle));
            return Position + front * (x * Length / 2) + new Vector2(-front.y, front.x) * (y * Width / 2);
        }
    }
}
