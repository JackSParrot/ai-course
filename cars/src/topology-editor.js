import { INPUT_OPTIONS, OUTPUT_OPTIONS, MAX_HIDDEN_LAYERS, MAX_NEURONS, copyTopology, createDefaultTopology, topologySizes, validateTopology } from "./topology.js";
import { copyTopologyState, validateTopologyState } from "./topology-store.js";
import { NeuralNetwork } from "./neural-network.js";
import { drawNetwork } from "./renderer.js";
import { CAR_COLORS } from "./simulation.js";

const field = id => document.getElementById(id);
function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export class TopologyEditor {
  constructor(store, onApply, onOpen) {
    this.store = store;
    this.onApply = onApply;
    this.onOpen = onOpen;
    this.dialog = field("topology-editor");
    this.buildInputOptions();
    this.buildOutputOptions();

    field("open-topology-editor").addEventListener("click", () => this.open());
    field("close-topology-editor").addEventListener("click", () => this.dialog.close());
    field("new-topology").addEventListener("click", () => this.addType(false));
    field("duplicate-topology").addEventListener("click", () => this.addType(true));
    field("delete-topology").addEventListener("click", () => this.deleteType());
    field("topology-name").addEventListener("input", event => {
      this.type.name = event.target.value;
      this.renderTypes();
      this.renderAssignments();
      this.updatePreview();
    });
    field("topology-activation").addEventListener("change", event => {
      this.type.activation = event.target.value;
      this.updatePreview();
    });
    field("topology-output-mode").addEventListener("change", event => {
      this.type.outputMode = event.target.value;
      this.updatePreview();
    });
    field("inputs-raw").addEventListener("click", () => this.setScales("raw"));
    field("inputs-normalized").addEventListener("click", () => this.setScales("normalized"));
    field("add-hidden-layer").addEventListener("click", () => {
      if (this.type.hidden.length >= MAX_HIDDEN_LAYERS) return;
      this.type.hidden.push(6);
      this.renderLayers();
      this.renderTypes();
      this.updatePreview();
    });
    field("topology-form").addEventListener("submit", event => {
      event.preventDefault();
      try {
        this.store.save(this.draft);
        const changed = this.onApply(this.store.state);
        this.renderSummary();
        field("topology-message").textContent = `Tipos guardados. ${changed === 1 ? "1 red reconstruida" : `${changed} redes reconstruidas`}; carrera en la salida. Las demás conservan sus pesos.`;
        this.dialog.close();
      } catch (error) { this.message(error.message, true); }
    });
    window.addEventListener("resize", () => { if (this.dialog.open) this.updatePreview(); });
    this.renderSummary();
    field("topology-message").textContent = store.warning;
  }

  get type() { return this.draft.types.find(type => type.id === this.selectedId); }

  open(typeId) {
    this.onOpen();
    // El borrador es independiente: Cancelar o Escape no modifican las redes.
    this.draft = copyTopologyState(this.store.state);
    this.selectedId = this.draft.types.some(type => type.id === typeId) ? typeId : this.draft.types[0].id;
    this.dialog.showModal();
    this.refresh();
    this.dialog.scrollTop = 0;
  }

  addType(duplicate) {
    if (this.draft.types.length >= 24) return;
    const type = duplicate ? copyTopology(this.type) : createDefaultTopology();
    type.id = `type-${crypto.randomUUID()}`;
    type.name = duplicate ? `${type.name.slice(0, 38)} · copia` : "Mi tipo";
    this.draft.types.push(type);
    this.selectedId = type.id;
    this.refresh();
    field("topology-name").focus();
    field("topology-name").select();
  }

  deleteType() {
    if (this.draft.types.length === 1) return;
    const removed = this.selectedId;
    this.draft.types = this.draft.types.filter(type => type.id !== removed);
    this.selectedId = this.draft.types[0].id;
    this.draft.assignments = this.draft.assignments.map(id => id === removed ? this.selectedId : id);
    this.refresh();
    this.message("Tipo eliminado del borrador. Sus coches pasan al primer tipo; puedes reasignarlos antes de guardar.");
  }

  setScales(mode) {
    this.type.inputs.forEach(input => { input.mode = mode; });
    // Preparar también el selector de las entradas aún no elegidas.
    this.inputRows.forEach(row => { row.select.value = mode; });
    this.refreshOptions();
    this.updatePreview();
  }

  buildInputOptions() {
    this.inputRows = INPUT_OPTIONS.map(option => {
      const row = element("div", "topology-input-row");
      const label = element("label", "topology-choice");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = `input-${option.id}`;
      const order = element("span", "neuron-order");
      order.setAttribute("aria-hidden", "true");
      label.append(checkbox, order, element("span", "", option.label));
      const select = document.createElement("select");
      select.id = `scale-${option.id}`;
      select.setAttribute("aria-label", `Escala de ${option.label.toLowerCase()}`);
      select.add(new Option(`Absoluto · ${option.unit}`, "raw"));
      select.add(new Option("Mapeado 0–1", "normalized"));
      select.value = "normalized";
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) this.type.inputs.push({ id: option.id, mode: select.value });
        else this.type.inputs = this.type.inputs.filter(input => input.id !== option.id);
        this.refreshOptions();
        this.renderTypes();
        this.updatePreview();
      });
      select.addEventListener("change", () => {
        this.type.inputs.find(input => input.id === option.id).mode = select.value;
        this.updatePreview();
      });
      row.append(label, select);
      field("topology-input-options").append(row);
      return { ...option, checkbox, select, order };
    });
  }

  buildOutputOptions() {
    this.outputRows = OUTPUT_OPTIONS.map(option => {
      const label = element("label", "topology-choice topology-output-row");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = `output-${option.id}`;
      const order = element("span", "neuron-order");
      order.setAttribute("aria-hidden", "true");
      label.append(checkbox, order, element("span", "", option.label));
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) this.type.outputs.push(option.id);
        else this.type.outputs = this.type.outputs.filter(id => id !== option.id);
        this.refreshOptions();
        this.renderTypes();
        this.updatePreview();
      });
      field("topology-output-options").append(label);
      return { ...option, checkbox, order };
    });
  }

  refreshOptions() {
    this.inputRows.forEach(row => {
      const index = this.type.inputs.findIndex(input => input.id === row.id);
      row.checkbox.checked = index >= 0;
      row.select.disabled = index < 0;
      row.order.textContent = index >= 0 ? String(index + 1) : "·";
      if (index >= 0) row.select.value = this.type.inputs[index].mode;
    });
    this.outputRows.forEach(row => {
      const index = this.type.outputs.indexOf(row.id);
      row.checkbox.checked = index >= 0;
      row.order.textContent = index >= 0 ? String(index + 1) : "·";
    });
  }

  renderTypes() {
    const list = field("topology-type-list");
    list.replaceChildren();
    this.draft.types.forEach(type => {
      const button = element("button", "topology-type");
      button.type = "button";
      button.setAttribute("aria-pressed", String(type.id === this.selectedId));
      button.append(element("strong", "", type.name || "Sin nombre"), element("small", "", topologySizes(type).join(" → ")));
      button.addEventListener("click", () => { this.selectedId = type.id; this.refresh(); });
      list.append(button);
    });
    field("new-topology").disabled = this.draft.types.length >= 24;
    field("duplicate-topology").disabled = this.draft.types.length >= 24;
    field("delete-topology").disabled = this.draft.types.length <= 1;
  }

  renderLayers() {
    const container = field("topology-layers");
    container.replaceChildren();
    if (this.type.hidden.length === 0) container.append(element("p", "", "Sin capas ocultas · conexión directa"));
    this.type.hidden.forEach((size, index) => {
      const row = element("div", "hidden-layer");
      const label = element("label", "", `Capa ${index + 1}`);
      const input = document.createElement("input");
      input.type = "number";
      input.min = 1;
      input.max = MAX_NEURONS;
      input.step = 1;
      input.value = size;
      input.setAttribute("aria-label", `Neuronas de la capa oculta ${index + 1}`);
      input.addEventListener("input", () => {
        this.type.hidden[index] = input.valueAsNumber;
        this.renderTypes();
        this.updatePreview();
      });
      label.append(input, element("span", "", "neuronas"));
      const remove = element("button", "button button-icon", "×");
      remove.type = "button";
      remove.setAttribute("aria-label", `Quitar capa oculta ${index + 1}`);
      remove.addEventListener("click", () => {
        this.type.hidden.splice(index, 1);
        this.renderLayers();
        this.renderTypes();
        this.updatePreview();
      });
      row.append(label, remove);
      container.append(row);
    });
    field("add-hidden-layer").disabled = this.type.hidden.length >= MAX_HIDDEN_LAYERS;
  }

  renderAssignments() {
    const container = field("topology-assignments");
    container.replaceChildren();
    this.draft.assignments.forEach((typeId, index) => {
      const label = element("label", "car-assignment");
      const dot = element("i", "");
      dot.style.background = CAR_COLORS[index];
      dot.setAttribute("aria-hidden", "true");
      const select = document.createElement("select");
      select.id = `car-type-${index + 1}`;
      select.setAttribute("aria-label", `Tipo del coche ${index + 1}`);
      this.draft.types.forEach(type => select.add(new Option(type.name || "Sin nombre", type.id)));
      select.value = typeId;
      select.addEventListener("change", () => {
        this.draft.assignments[index] = select.value;
        this.updatePreview();
      });
      label.append(dot, element("span", "", `Coche ${String(index + 1).padStart(2, "0")}`), select);
      container.append(label);
    });
  }

  refresh() {
    field("topology-name").value = this.type.name;
    field("topology-activation").value = this.type.activation;
    field("topology-output-mode").value = this.type.outputMode;
    this.inputRows.forEach(row => { row.select.value = "normalized"; });
    this.refreshOptions();
    this.renderTypes();
    this.renderLayers();
    this.renderAssignments();
    this.updatePreview();
  }

  message(text, error = false) {
    const message = field("topology-validation");
    message.textContent = text;
    message.classList.toggle("error", error);
  }

  updatePreview() {
    const type = this.type;
    field("activation-help").textContent = type.activation === "relu"
      ? "ReLU en capas ocultas y salida: máximo(0, suma). Puede superar 1; no son probabilidades."
      : "Sigmoide en capas ocultas y salida: valores entre 0 y 1. Con entradas grandes puede saturarse cerca de 0 o 1.";
    field("output-mode-help").textContent = type.outputMode === "winner"
      ? "Gana el mayor valor positivo. Si todos son 0, no hay acción. En un empate gana la primera salida."
      : "Cada salida > 0,5 activa su acción. Si coinciden pedales, manda el freno; los giros opuestos se cancelan.";
    try {
      validateTopologyState(this.draft);
      this.message("Borrador listo. Puedes editar varios tipos antes de guardar.");
      field("save-topologies").disabled = false;
    } catch (error) {
      const invalid = this.draft.types.find(type => { try { validateTopology(type); return false; } catch { return true; } });
      this.message(`${invalid ? `${invalid.name || "Sin nombre"}: ` : ""}${error.message}`, true);
      field("save-topologies").disabled = true;
    }
    const canvas = field("topology-preview-canvas");
    try {
      validateTopology(type);
      const sizes = topologySizes(type);
      field("topology-shape").textContent = sizes.join(" → ");
      let weights = 0;
      let biases = 0;
      for (let i = 1; i < sizes.length; i++) { weights += sizes[i - 1] * sizes[i]; biases += sizes[i]; }
      field("topology-parameters").textContent = `${weights} pesos + ${biases} sesgos = ${weights + biases} parámetros`;
      canvas.hidden = false;
      // Pesos y activaciones a cero: esta vista muestra la estructura del borrador.
      drawNetwork(canvas, new NeuralNetwork(sizes, () => 0.5, type.activation), type);
    } catch {
      field("topology-shape").textContent = "Completa tu red";
      field("topology-parameters").textContent = "Elige al menos una entrada y una salida, y capas válidas.";
      canvas.hidden = true;
    }
  }

  renderSummary() {
    const container = field("topology-summary");
    container.replaceChildren();
    this.store.state.types.forEach(type => {
      const count = this.store.state.assignments.filter(id => id === type.id).length;
      if (!count) return;
      const chip = element("div", "type-chip");
      chip.append(element("strong", "", type.name), element("span", "", `${topologySizes(type).join("·")} / ${count} ${count === 1 ? "coche" : "coches"}`));
      container.append(chip);
    });
  }
}
