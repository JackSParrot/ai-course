import { MapEditor, downloadMap } from "./map-editor.js";
import { parseMap } from "./map-store.js";
import { Track } from "./track.js";
import { drawTrack } from "./track-drawing.js";

const field = id => document.getElementById(id);
const PURPOSES = { training: "Entrenamiento", test: "Prueba reservada", practice: "Libre · explorar" };

export class MapUI {
  constructor(store, onMapChange, onEditorOpen, onLibraryChange = () => {}) {
    this.store = store;
    this.onMapChange = onMapChange;
    this.onEditorOpen = onEditorOpen;
    this.onLibraryChange = onLibraryChange;
    this.editor = new MapEditor((map, purpose) => {
      const saved = this.store.saveMap(map, purpose);
      this.render();
      this.onMapChange(saved);
      this.message(`«${saved.name}» guardado en este navegador. Se han conservado las redes.`);
    });

    field("active-map").addEventListener("change", event => this.select(event.target.value));
    field("new-map-button").addEventListener("click", () => { this.onEditorOpen(); this.editor.open(); });
    field("edit-map-button").addEventListener("click", () => {
      this.onEditorOpen();
      const id = this.store.state.activeId;
      const isTemplate = this.store.isBuiltIn(id);
      this.editor.open(this.store.get(id), isTemplate ? "practice" : this.store.purpose(id), isTemplate);
    });
    field("export-map-button").addEventListener("click", () => {
      try { downloadMap(this.store.get(this.store.state.activeId)); }
      catch (error) { this.message(error.message, true); }
    });
    field("import-map-button").addEventListener("click", () => field("import-map-file").click());
    field("import-map-file").addEventListener("change", async event => {
      const file = event.target.files[0];
      if (!file) return;
      try {
        if (file.size > 200000) throw new Error("El archivo es demasiado grande. El límite es 200 KB.");
        const map = parseMap(await file.text());
        this.onEditorOpen();
        this.editor.open(map);
        this.editor.message("Mapa importado. Revísalo y pulsa Guardar y usar mapa para añadirlo a la biblioteca.");
      } catch (error) { this.message(error.message, true); }
      finally { event.target.value = ""; }
    });
    this.render();
    if (this.store.warning) this.message(this.store.warning, true);
  }

  message(text, error = false) {
    field("map-message").textContent = text;
    field("map-message").classList.toggle("error", error);
  }

  select(id) {
    try {
      this.store.select(id);
      this.onMapChange(this.store.get(id));
      this.render();
      this.message("Circuito cambiado. Los coches vuelven a la salida con las mismas redes.");
    } catch (error) {
      field("active-map").value = this.store.state.activeId;
      this.message(error.message, true);
    }
  }

  render() {
    const maps = this.store.list();
    const activeId = this.store.state.activeId;
    field("active-map").replaceChildren(...maps.map(map => { const option = new Option(map.name, map.id); if (!this.store.isBuiltIn(map.id)) option.dataset.i18nIgnore = ""; return option; }));
    field("active-map").value = activeId;
    const purpose = this.store.purpose(activeId);
    field("active-map-purpose").className = `purpose-tag ${purpose}`;
    field("active-map-purpose").textContent = PURPOSES[purpose];
    field("active-map-label").toggleAttribute("data-i18n-ignore", !this.store.isBuiltIn(activeId));
    field("active-map-label").textContent = this.store.get(activeId).name.toUpperCase();
    const count = this.store.state.trainingIds.length;
    field("map-plan-summary").textContent = `${count}/4 entrenamiento · ${this.store.state.testId ? "1 prueba" : "sin prueba"}`;
    field("map-plan-status").textContent = count >= 3 && this.store.state.testId
      ? "Conjunto preparado: los mapas de entrenamiento y el reservado para prueba son distintos. El entrenador usa solo el primer grupo."
      : "Para completar el experimento, selecciona 3 o 4 mapas de entrenamiento y reserva uno distinto para la prueba.";

    const cards = maps.map(map => {
      const card = document.createElement("article");
      card.className = `map-card${map.id === activeId ? " active" : ""}`;
      const canvas = document.createElement("canvas");
      canvas.width = 265;
      canvas.height = 180;
      canvas.setAttribute("aria-label", `Vista del circuito ${map.name}`);
      const context = canvas.getContext("2d");
      const track = new Track(map);
      context.scale(canvas.width / track.worldWidth, canvas.height / track.worldHeight);
      drawTrack(context, track);
      const heading = document.createElement("h3");
      heading.textContent = map.name;
      if (!this.store.isBuiltIn(map.id)) heading.dataset.i18nIgnore = "";
      const origin = document.createElement("small");
      origin.textContent = this.store.isBuiltIn(map.id) ? "Plantilla · editable como copia" : "Tu mapa · guardado";
      const select = document.createElement("select");
      select.setAttribute("aria-label", `Uso de ${map.name}`);
      select.replaceChildren(...Object.entries(PURPOSES).map(([value, label]) => new Option(label, value)));
      select.value = this.store.purpose(map.id);
      select.addEventListener("change", () => {
        try {
          this.store.setPurpose(map.id, select.value);
          this.render();
          this.message("Distribución guardada. La prueba queda separada del entrenamiento.");
        } catch (error) {
          select.value = this.store.purpose(map.id);
          this.message(error.message, true);
        }
      });
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button button-outline";
      button.textContent = map.id === activeId ? "Circuito actual" : "Usar circuito";
      button.setAttribute("aria-label", `Usar circuito ${map.name}`);
      button.disabled = map.id === activeId;
      button.addEventListener("click", () => this.select(map.id));
      card.append(canvas, heading, origin, select, button);
      return card;
    });
    field("map-cards").replaceChildren(...cards);
    this.onLibraryChange();
  }
}
