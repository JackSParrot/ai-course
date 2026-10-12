import { intersectSegments } from "./geometry.js";

export const SENSOR_HOURS = [10, 11, 12, 1, 2];
// 12 es el morro del coche. Cada hora del reloj representa 30 grados.
export const SENSOR_ANGLES = [-60, -30, 0, 30, 60].map(degrees => degrees * Math.PI / 180);
export const SENSOR_LENGTH = 220;

export class Sensor {
  constructor() {
    this.rays = [];
    this.distances = Array(5).fill(SENSOR_LENGTH);
  }

  update(car, borders) {
    this.rays = SENSOR_ANGLES.map((relativeAngle, index) => {
      const angle = car.angle + relativeAngle;
      const start = { x: car.x, y: car.y };
      const end = {
        x: start.x + Math.cos(angle) * SENSOR_LENGTH,
        y: start.y + Math.sin(angle) * SENSOR_LENGTH,
      };
      let nearest = null;

      for (const [a, b] of borders) {
        const hit = intersectSegments(start, end, a, b);
        if (hit && (!nearest || hit.offset < nearest.offset)) nearest = hit;
      }

      // Sin intersección, la medida es el alcance completo del rayo.
      const distance = nearest ? nearest.offset * SENSOR_LENGTH : SENSOR_LENGTH;
      return { start, end, hit: nearest, distance, hour: SENSOR_HOURS[index] };
    });

    // La red puede recibir estas distancias tal cual o divididas por el alcance.
    this.distances = this.rays.map(ray => ray.distance);
  }
}
