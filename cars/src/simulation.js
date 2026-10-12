import { Car } from "./car.js";
import { createRandom } from "./geometry.js";
import { NeuralNetwork } from "./neural-network.js";
import { Track } from "./track.js";
import { createDefaultTopologyState, copyTopology, topologyKey, topologySizes } from "./topology.js";
import { copyTopologyState, validateTopologyState } from "./topology-store.js";
import { championForType, validateChampions } from "./trained-models.js";
import { networkFromData } from "./genetics.js";

export const FIXED_STEP = 1 / 60;
export const CAR_COLORS = ["#ff835b", "#68d6cc", "#b4a0ed", "#e7c875", "#8cb9f3", "#e6a7c5"];

export class Simulation {
  constructor(seed = 4, map, topologies = createDefaultTopologyState()) {
    this.track = new Track(map);
    validateTopologyState(topologies);
    this.topologies = copyTopologyState(topologies);
    this.createCars(seed);
  }

  createCars(seed) {
    this.seed = seed;
    this.elapsed = 0;
    this.cars = CAR_COLORS.map((color, index) => {
      const start = this.track.getStart(index);
      const type = this.topologies.types.find(type => type.id === this.topologies.assignments[index]);
      return new Car(index + 1, color, start, this.createBrain(type, index), type);
    });
    for (const car of this.cars) car.think(this.track);
  }

  createBrain(type, index) {
    // Una semilla por coche evita que cambiar una topología afecte a las demás.
    return new NeuralNetwork(topologySizes(type), createRandom(this.seed + index * 1009), type.activation);
  }

  setTopologies(state) {
    validateTopologyState(state);
    const next = copyTopologyState(state);
    let changed = 0;
    this.cars.forEach((car, index) => {
      const type = next.types.find(type => type.id === next.assignments[index]);
      if (topologyKey(type) !== topologyKey(car.topology)) {
        car.brain = this.createBrain(type, index);
        car.trainingInfo = null;
        changed++;
      }
      car.topology = copyTopology(type);
    });
    this.topologies = next;
    this.reset();
    return changed;
  }

  reset() {
    this.elapsed = 0;
    for (const car of this.cars) {
      car.reset();
      car.think(this.track);
    }
  }

  applyChampions(bundle) {
    validateChampions(bundle);
    // Comprobar todos antes de tocar el primero: no mezclar una carga parcial.
    const champions = this.cars.map(car => {
      const champion = championForType(bundle, car.topology);
      if (!champion) throw new Error(`El tipo «${car.topology.name}» no coincide con los campeones. Usa sus topologías originales o inicia otro entrenamiento.`);
      return champion;
    });
    this.cars.forEach((car, index) => {
      const champion = champions[index];
      car.brain = networkFromData(champion.network, car.topology);
      car.trainingInfo = { generation: champion.generation, score: champion.fitness.score };
    });
    this.reset();
  }

  setMap(map) {
    const nextTrack = new Track(map);
    this.track = nextTrack;
    this.cars.forEach((car, index) => { car.start = nextTrack.getStart(index); });
    // Cambia el entorno, pero conserva exactamente los mismos cerebros.
    this.reset();
  }

  step() {
    // Sensores → red → botones → movimiento.
    // Cada paso dura lo mismo, independientemente de los FPS de la pantalla.
    for (const car of this.cars) {
      car.think(this.track);
      car.move(FIXED_STEP, this.track);
      // Preparar las lecturas de la nueva posición para el panel y el siguiente paso.
      car.think(this.track);
    }
    this.elapsed += FIXED_STEP;
  }
}
