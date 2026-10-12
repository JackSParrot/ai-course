import { clamp, distance } from "./geometry.js";
import { Controls } from "./controls.js";
import { Sensor } from "./sensor.js";
import { CAR_LENGTH, CAR_WIDTH, MAX_SPEED } from "./car-settings.js";
import { copyTopology, createDefaultTopology, readNetworkInputs } from "./topology.js";

export { CAR_LENGTH, CAR_WIDTH, MAX_SPEED } from "./car-settings.js";

export class Car {
  constructor(id, color, start, brain, topology = createDefaultTopology()) {
    this.id = id;
    this.color = color;
    this.start = start;
    this.brain = brain;
    this.topology = copyTopology(topology);
    this.controls = new Controls();
    this.sensor = new Sensor();
    this.reset();
  }

  reset() {
    this.x = this.start.x;
    this.y = this.start.y;
    this.angle = this.start.angle;
    this.speed = 0;
    this.distance = 0;
    this.crashed = false;
    this.inputs = [];
    this.outputs = Array(this.topology.outputs.length).fill(0);
    this.controls.clear();
  }

  getCorners() {
    const localCorners = [
      [-CAR_LENGTH / 2, -CAR_WIDTH / 2], [CAR_LENGTH / 2, -CAR_WIDTH / 2],
      [CAR_LENGTH / 2, CAR_WIDTH / 2], [-CAR_LENGTH / 2, CAR_WIDTH / 2],
    ];
    return localCorners.map(([x, y]) => ({
      x: this.x + x * Math.cos(this.angle) - y * Math.sin(this.angle),
      y: this.y + x * Math.sin(this.angle) + y * Math.cos(this.angle),
    }));
  }

  think(track) {
    this.sensor.update(this, track.borders);
    this.inputs = readNetworkInputs(this.topology, this);
    this.outputs = this.brain.forward(this.inputs.map(input => input.value));
    if (this.crashed) this.controls.clear();
    else this.controls.setFromNetwork(this.outputs, this.topology.outputs, this.topology.outputMode);
  }

  move(seconds, track) {
    if (this.crashed) return;
    const previous = { x: this.x, y: this.y };

    // El freno tiene prioridad si ambos pedales están pulsados.
    if (this.controls.brake) this.speed -= 200 * seconds;
    else if (this.controls.accelerate) this.speed += 95 * seconds;
    else this.speed -= 28 * seconds; // Rozamiento al soltar el acelerador.
    this.speed = clamp(this.speed, 0, MAX_SPEED);

    // Izquierda y derecha a la vez se cancelan. Parado no se gira.
    const steering = Number(this.controls.right) - Number(this.controls.left);
    this.angle += steering * 2.1 * (this.speed / MAX_SPEED) * seconds;
    this.x += Math.cos(this.angle) * this.speed * seconds;
    this.y += Math.sin(this.angle) * this.speed * seconds;
    this.distance += distance(previous, this);

    if (track.touchesCar(this.getCorners())) {
      this.crashed = true;
      this.speed = 0;
      this.controls.clear();
    }
  }
}
