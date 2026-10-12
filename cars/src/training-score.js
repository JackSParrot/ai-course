import { clamp, intersectSegments } from "./geometry.js";

export const CHECKPOINT_COUNT = 32;
export const EPISODE_SECONDS = 22;
export const STALL_SECONDS = 3;

export function checkpointAt(track, pathDistance) {
  const pose = track.poseAt(pathDistance);
  const halfWidth = track.width / 2;
  return { ...pose,
    a: { x: pose.x - Math.sin(pose.angle) * halfWidth, y: pose.y + Math.cos(pose.angle) * halfWidth },
    b: { x: pose.x + Math.sin(pose.angle) * halfWidth, y: pose.y - Math.cos(pose.angle) * halfWidth } };
}

// Los checkpoints son solo del evaluador. La red sigue viendo sus sensores y velocidad.
export class CourseProgress {
  constructor(track, start) {
    this.track = track;
    this.startDistance = track.closestDistance(start);
    this.spacing = track.length / CHECKPOINT_COUNT;
    this.passed = 0;
    this.bestDistance = 0;
    this.nextGate = this.gate(1);
  }

  gate(number) { return checkpointAt(this.track, this.startDistance + number * this.spacing); }

  update(previous, current) {
    if (this.passed >= CHECKPOINT_COUNT) return;
    const forward = (current.x - previous.x) * Math.cos(this.nextGate.angle)
      + (current.y - previous.y) * Math.sin(this.nextGate.angle);
    if (forward > 0 && intersectSegments(previous, current, this.nextGate.a, this.nextGate.b)) {
      this.passed++;
      this.bestDistance = Math.max(this.bestDistance, this.passed * this.spacing);
      this.nextGate = this.gate(this.passed + 1);
    }
    // Un pequeño avance entre checkpoints también recibe puntos, sin permitir saltarlos.
    const projected = this.track.closestDistance(current);
    const offset = (projected - this.startDistance - this.passed * this.spacing + this.track.length * 2) % this.track.length;
    if (offset <= this.spacing) this.bestDistance = Math.max(this.bestDistance, this.passed * this.spacing + offset);
  }

  get fraction() { return clamp(this.bestDistance / this.track.length, 0, 1); }
  get finished() { return this.passed >= CHECKPOINT_COUNT; }
}

export function scoreEpisode({ progress, finished, crashed, stalled, elapsed }) {
  const advance = 1000 * clamp(progress, 0, 1);
  const lap = finished ? 200 : 0;
  const time = finished ? 100 * clamp(1 - elapsed / EPISODE_SECONDS, 0, 1) : 0;
  const collision = crashed ? -25 : 0;
  const inactivity = stalled ? -15 : 0;
  return { advance, lap, time, collision, inactivity, total: advance + lap + time + collision + inactivity };
}

export function aggregateResults(results) {
  if (!results.length) throw new Error("No se puede puntuar una red sin evaluarla.");
  const scores = results.map(result => result.score.total);
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const worst = Math.min(...scores);
  // Así, un único circuito fácil no oculta un resultado malo en los demás.
  return { score: 0.75 * average + 0.25 * worst, average, worst,
    completed: results.filter(result => result.finished).length, attempts: results.length };
}
