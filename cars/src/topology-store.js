import { copyTopology, createDefaultTopologyState, validateTopology } from "./topology.js";

export const TOPOLOGY_STORAGE_KEY = "neural-racing.topologies.v1";

export function copyTopologyState(state) {
  return { version: state.version, types: state.types.map(copyTopology), assignments: [...state.assignments] };
}

export function validateTopologyState(state) {
  if (!state || state.version !== 1 || !Array.isArray(state.types) || state.types.length < 1 || state.types.length > 24) throw new Error("La biblioteca debe tener entre 1 y 24 tipos de coche.");
  const ids = new Set();
  for (const type of state.types) {
    validateTopology(type);
    if (ids.has(type.id)) throw new Error("Hay identificadores de tipo repetidos.");
    ids.add(type.id);
  }
  if (!Array.isArray(state.assignments) || state.assignments.length !== 6 || state.assignments.some(id => !ids.has(id))) throw new Error("Asigna un tipo válido a cada uno de los seis coches.");
}

export class TopologyStore {
  constructor(storage) {
    this.storage = storage;
    this.state = createDefaultTopologyState();
    this.warning = "";
    this.readOnly = false;
    try {
      const saved = storage?.getItem(TOPOLOGY_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        validateTopologyState(parsed);
        this.state = copyTopologyState(parsed);
      }
    } catch {
      this.readOnly = true;
      this.warning = "No se pudieron leer los tipos guardados. Se conservan los datos originales y se muestran los ejemplos.";
    }
    if (!storage) this.warning = "El navegador no permite guardar los tipos de coche.";
  }

  save(state) {
    validateTopologyState(state);
    const next = copyTopologyState(state);
    next.types.forEach(type => { type.name = type.name.trim(); });
    if (!this.storage || this.readOnly) throw new Error("No se pueden guardar los tipos en este navegador. El borrador sigue abierto.");
    try { this.storage.setItem(TOPOLOGY_STORAGE_KEY, JSON.stringify(next)); }
    catch { throw new Error("No hay espacio o permiso para guardar los tipos. El borrador sigue abierto."); }
    // Solo actualizar el estado después de haber guardado correctamente.
    this.state = next;
  }
}
