import { OUTPUT_OPTIONS, activeOutputIndexes } from "./topology.js";

// Siempre hay cuatro botones físicos, aunque la red tenga otras salidas.
export const CONTROL_NAMES = ["accelerate", "brake", "left", "right"];
export const CONTROL_LABELS = ["Acelerar", "Frenar", "Izquierda", "Derecha"];
export { ACTIVATION_THRESHOLD } from "./topology.js";

export class Controls {
  constructor() {
    this.clear();
  }

  clear() {
    for (const name of CONTROL_NAMES) this[name] = false;
  }

  // La topología elige las acciones; cada acción se traduce a sus botones.
  setFromNetwork(outputs, actions = ["forward", "brake", "left", "right"], mode = "threshold") {
    this.clear();
    for (const index of activeOutputIndexes(outputs, mode)) {
      const action = OUTPUT_OPTIONS.find(option => option.id === actions[index]);
      for (const button of action.controls) this[button] = true;
    }
  }
}
