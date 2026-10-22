import { translateText } from '../../i18n/i18n.js';
import { clamp, closestPointOnSegment, distance } from "./geometry.js";
import { BUILT_IN_MAPS, copyMap, MAP_VERSION } from "./maps.js";
import { serializeMap } from "./map-store.js";
import { MAX_MAP_POINTS, mapDimensions, trackArea, validateMap, WORLD_HEIGHT, WORLD_WIDTH } from "./track.js";
import { drawGrid, drawTrack, polygonPath } from "./track-drawing.js";
import { prepareCanvas } from "./renderer.js";

const field = id => document.getElementById(id);
const HELP = {
  pan: "Arrastra el terreno para recorrer la vista ampliada. Usa Vista completa para ver todo el circuito.",
  add: "Haz clic para añadir puntos en orden. El recorrido se cierra solo. Cerca de un tramo se inserta un punto entre sus extremos; el máximo es 64.",
  move: "Arrastra un punto para modificar el circuito. Las curvas y los bordes se actualizan al moverlo.",
  start: "Haz clic en un punto para colocar la salida cerca de él. Los seis coches se sitúan detrás de la línea.",
  remove: "Haz clic en el punto que quieras quitar. Puedes recuperar cualquier cambio con Deshacer.",
};

export function downloadMap(map) {
  const blob = new Blob([serializeMap(map)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${map.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "circuito"}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export class MapEditor {
  constructor(onSave) {
    this.onSave = onSave;
    this.dialog = field("map-editor");
    this.canvas = field("editor-canvas");
    this.pointer = null;
    field("editor-zoom").addEventListener("change", event => {
      this.zoom = Number(event.target.value);
      this.canvas.style.width = `${this.zoom * 100}%`;
      if (this.zoom === 1) {
        this.canvas.parentElement.scrollLeft = 0;
        this.canvas.parentElement.scrollTop = 0;
      }
      this.draw();
    });
    field("editor-expand").addEventListener("click", () => this.change(() => {
      const dx = (WORLD_WIDTH * 3 - this.size.width) / 2;
      const dy = (WORLD_HEIGHT * 3 - this.size.height) / 2;
      this.draft.points = this.draft.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
      this.draft.worldWidth = WORLD_WIDTH * 3;
      this.draft.worldHeight = WORLD_HEIGHT * 3;
    }));

    field("close-editor-button").addEventListener("click", () => this.dialog.close());
    this.dialog.addEventListener("close", () => { this.stopPreview(); this.cancelPointer(); });
    field("editor-preview").addEventListener("click", () => {
      if (this.previewing) this.refresh();
      else if (this.validation.valid) {
        this.previewing = true;
        this.previewTime = 0;
        this.previewLast = null;
        field("editor-preview").textContent = "Volver a editar";
        field("editor-preview").setAttribute("aria-pressed", "true");
        field("editor-tool-help").textContent = "Vista previa en movimiento. Pulsa Volver a editar para modificar los puntos.";
        const frame = now => {
          if (!this.previewing || !this.dialog.open) return;
          if (this.previewLast !== null) this.previewTime += Math.min((now - this.previewLast) / 1000, 0.05);
          this.previewLast = now;
          this.draw();
          this.previewFrame = requestAnimationFrame(frame);
        };
        this.previewFrame = requestAnimationFrame(frame);
      }
    });
    field("editor-show-error").addEventListener("click", () => {
      this.selected = this.validation.pointIndices[0];
      this.tool = "move";
      this.refresh();
      this.canvas.focus({ preventScroll: true });
      this.canvas.scrollIntoView({ block: "center", behavior: "smooth" });
    });
    field("editor-fit").addEventListener("click", () => this.change(() => {
      // Fit the actual road edges, recalculating after each change to the centre line.
      for (let attempt = 0; attempt < 12; attempt++) {
        const result = validateMap(this.draft);
        if (result.code !== "bounds" || !result.preview) break;
        const area = trackArea(this.draft);
        const edges = [...result.preview.outer, ...result.preview.inner];
        const left = Math.min(...edges.map(p => p.x)), right = Math.max(...edges.map(p => p.x));
        const top = Math.min(...edges.map(p => p.y)), bottom = Math.max(...edges.map(p => p.y));
        const scale = Math.min(1, (area.right - area.left - 12) / (right - left), (area.bottom - area.top - 12) / (bottom - top));
        this.draft.points = this.draft.points.map(p => ({ x: this.size.width / 2 + (p.x - (left + right) / 2) * scale, y: this.size.height / 2 + (p.y - (top + bottom) / 2) * scale }));
      }
    }));
    field("editor-template").addEventListener("click", () => this.change(() => {
      Object.assign(this.draft, { points: BUILT_IN_MAPS[0].points.map(p => ({ x: p.x * this.size.width / WORLD_WIDTH, y: p.y * this.size.height / WORLD_HEIGHT })), width: BUILT_IN_MAPS[0].width, startIndex: 0 });
      this.selected = -1;
      this.tool = "move";
    }));
    document.querySelectorAll(".editor-tool").forEach(button => button.addEventListener("click", () => {
      this.tool = button.dataset.tool;
      this.refresh();
    }));
    field("editor-map-name").addEventListener("input", event => this.change(() => { this.draft.name = event.target.value; }));
    field("editor-width").addEventListener("input", event => this.change(() => { this.draft.width = Number(event.target.value); }));
    field("editor-reversed").addEventListener("change", event => this.change(() => { this.draft.reversed = event.target.checked; }));
    field("editor-undo").addEventListener("click", () => this.undo());
    field("editor-redo").addEventListener("click", () => this.redo());
    field("editor-point").addEventListener("change", event => { this.selected = Number(event.target.value); this.refresh(); });
    field("editor-add-coordinate").addEventListener("click", () => this.addPoint(this.coordinates(), false));
    field("editor-move-coordinate").addEventListener("click", () => {
      if (this.selected >= 0) this.change(() => { this.draft.points[this.selected] = this.coordinates(); });
    });
    field("export-draft-button").addEventListener("click", () => {
      try { downloadMap(this.draft); } catch (error) { this.message(error.message, true); }
    });
    field("editor-form").addEventListener("submit", event => {
      event.preventDefault();
      if (!this.validation.valid) return;
      try {
        this.onSave(copyMap(this.draft), field("editor-purpose").value);
        this.dialog.close();
      } catch (error) { this.message(error.message, true); }
    });
    this.canvas.addEventListener("pointerdown", event => this.pointerDown(event));
    this.canvas.addEventListener("pointermove", event => this.pointerMove(event));
    this.canvas.addEventListener("pointerup", event => this.pointerUp(event));
    this.canvas.addEventListener("pointercancel", () => this.cancelPointer());
    this.canvas.addEventListener("lostpointercapture", () => this.cancelPointer());
    this.canvas.addEventListener("keydown", event => this.keyDown(event));
    window.addEventListener("resize", () => { if (this.dialog.open) this.draw(); });
    document.addEventListener("languagechange", () => { if (this.dialog.open) this.draw(); });
  }

  open(map = null, purpose = "practice", asCopy = false) {
    this.draft = map ? copyMap(map) : { version: MAP_VERSION, id: "", name: "Mi circuito", worldWidth: WORLD_WIDTH * 3, worldHeight: WORLD_HEIGHT * 3, width: 110, points: [], startIndex: 0, reversed: false };
    if (asCopy) {
      this.draft.id = "";
      this.draft.name = `${map.name.slice(0, 40)} · copia`;
    }
    this.zoom = 1;
    this.canvas.style.width = "100%";
    this.canvas.parentElement.scrollLeft = 0;
    this.canvas.parentElement.scrollTop = 0;
    field("editor-zoom").value = "1";
    this.tool = map ? "move" : "add";
    this.selected = -1;
    this.past = [];
    this.future = [];
    field("editor-purpose").value = purpose;
    field("editor-x").value = mapDimensions(this.draft).width / 2;
    field("editor-y").value = mapDimensions(this.draft).height / 2;
    this.dialog.showModal();
    this.refresh();
    this.dialog.scrollTop = 0;
  }

  snapshot() { return { draft: copyMap(this.draft), selected: this.selected }; }
  restore(snapshot) { this.draft = snapshot.draft; this.selected = snapshot.selected; }
  remember(snapshot) { this.past.push(snapshot); if (this.past.length > 50) this.past.shift(); this.future = []; }

  change(action) {
    this.stopPreview();
    this.remember(this.snapshot());
    action();
    this.refresh();
  }

  undo() {
    if (!this.past.length) return;
    this.future.push(this.snapshot());
    this.restore(this.past.pop());
    this.refresh();
  }

  redo() {
    if (!this.future.length) return;
    this.past.push(this.snapshot());
    this.restore(this.future.pop());
    this.refresh();
  }

  coordinates() {
    return { x: Number(field("editor-x").value), y: Number(field("editor-y").value) };
  }

  eventPoint(event) {
    const bounds = this.canvas.getBoundingClientRect();
    const grid = field("editor-snap").checked ? 20 : 1;
    return {
      x: clamp(Math.round((event.clientX - bounds.left) * this.size.width / bounds.width / grid) * grid, 0, this.size.width),
      y: clamp(Math.round((event.clientY - bounds.top) * this.size.height / bounds.height / grid) * grid, 0, this.size.height),
    };
  }

  nearestPoint(point) {
    const radius = Math.max(22, this.size.width / this.canvas.clientWidth * 13);
    let nearest = -1;
    let best = radius;
    this.draft.points.forEach((candidate, index) => {
      if (distance(candidate, point) < best) { nearest = index; best = distance(candidate, point); }
    });
    return nearest;
  }

  addPoint(point, insertNearSegment = true) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x > this.size.width || point.y < 0 || point.y > this.size.height) return this.message(`Escribe coordenadas dentro del lienzo: X entre 0 y ${this.size.width}, Y entre 0 y ${this.size.height}.`, true);
    if (this.draft.points.length >= MAX_MAP_POINTS) return this.message("El máximo es 64 puntos. Mueve o quita alguno para continuar.", true);
    let at = this.draft.points.length;
    let best = 35;
    if (insertNearSegment && this.draft.points.length >= 3) {
      this.draft.points.forEach((a, index) => {
        const b = this.draft.points[(index + 1) % this.draft.points.length];
        const proximity = distance(point, closestPointOnSegment(point, a, b));
        if (proximity < best) { best = proximity; at = index + 1; }
      });
    }
    this.change(() => {
      if (at <= this.draft.startIndex && this.draft.points.length) this.draft.startIndex++;
      this.draft.points.splice(at, 0, point);
      this.selected = at;
    });
  }

  removePoint(index) {
    if (index < 0) return;
    this.change(() => {
      this.draft.points.splice(index, 1);
      if (index < this.draft.startIndex) this.draft.startIndex--;
      this.draft.startIndex = Math.max(0, Math.min(this.draft.startIndex, this.draft.points.length - 1));
      this.selected = -1;
    });
  }

  pointerDown(event) {
    if (this.previewing) return;
    if (!event.isPrimary) { this.cancelPointer(); return; }
    if (event.button !== 0 || this.pointer) return;
    const point = this.eventPoint(event);
    this.pointer = { id: event.pointerId, point, index: this.nearestPoint(point), snapshot: this.snapshot(), moved: false, clientX: event.clientX, clientY: event.clientY, scrollLeft: this.canvas.parentElement.scrollLeft, scrollTop: this.canvas.parentElement.scrollTop };
    this.canvas.setPointerCapture(event.pointerId);
    this.canvas.focus({ preventScroll: true });
  }

  pointerMove(event) {
    if (!this.pointer || event.pointerId !== this.pointer.id) return;
    if (Math.hypot(event.clientX - this.pointer.clientX, event.clientY - this.pointer.clientY) > 4) this.pointer.moved = true;
    if (this.tool === "pan") {
      this.canvas.parentElement.scrollLeft = this.pointer.scrollLeft - (event.clientX - this.pointer.clientX);
      this.canvas.parentElement.scrollTop = this.pointer.scrollTop - (event.clientY - this.pointer.clientY);
      return;
    }
    if (this.tool === "move" && this.pointer.index >= 0 && this.pointer.moved) {
      this.selected = this.pointer.index;
      this.draft.points[this.selected] = this.eventPoint(event);
      this.refresh();
    }
  }

  pointerUp(event) {
    if (!this.pointer || event.pointerId !== this.pointer.id) return;
    const pointer = this.pointer;
    this.pointer = null;
    this.canvas.releasePointerCapture(event.pointerId);
    if (pointer.moved) {
      if (this.tool === "move" && pointer.index >= 0) this.remember(pointer.snapshot);
      this.refresh();
      return;
    }
    this.selected = pointer.index;
    if (this.tool === "add" && pointer.index < 0) this.addPoint(this.eventPoint(event));
    else if (this.tool === "remove") this.removePoint(pointer.index);
    else if (this.tool === "start" && pointer.index >= 0) this.change(() => { this.draft.startIndex = pointer.index; });
    else this.refresh();
  }

  cancelPointer() {
    if (!this.pointer) return;
    this.restore(this.pointer.snapshot);
    this.pointer = null;
    if (this.dialog.open) this.refresh();
  }

  keyDown(event) {
    if (this.previewing) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault(); event.shiftKey ? this.redo() : this.undo(); return;
    }
    if (this.selected < 0) return;
    if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); this.removePoint(this.selected); return; }
    const directions = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] };
    if (!directions[event.key]) return;
    event.preventDefault();
    const [dx, dy] = directions[event.key];
    this.change(() => {
      const point = this.draft.points[this.selected];
      point.x = clamp(point.x + dx, 0, this.size.width);
      point.y = clamp(point.y + dy, 0, this.size.height);
    });
  }

  message(text, invalid = false) {
    field("editor-validation").textContent = text;
    field("editor-validation").classList.toggle("invalid", invalid);
  }

  refresh() {
    this.stopPreview();
    this.size = mapDimensions(this.draft);
    field("editor-x").max = this.size.width;
    field("editor-y").max = this.size.height;
    field("editor-area-size").textContent = `${this.size.width} × ${this.size.height} · hasta ${MAX_MAP_POINTS} puntos`;
    field("editor-expand").disabled = this.size.width >= WORLD_WIDTH * 3;
    this.validation = validateMap(this.draft);
    this.message(`${this.draft.points.length} / ${MAX_MAP_POINTS} puntos · ${this.validation.message}`, !this.validation.valid);
    field("editor-map-name").value = this.draft.name;
    field("editor-width").value = this.draft.width;
    field("editor-width-value").value = `${this.draft.width} u`;
    field("editor-reversed").checked = this.draft.reversed;
    field("editor-start-label").textContent = this.draft.points.length ? `Punto ${this.draft.startIndex + 1}` : "Sin definir";
    field("editor-tool-help").textContent = HELP[this.tool];
    field("editor-undo").disabled = !this.past.length;
    field("editor-redo").disabled = !this.future.length;
    field("save-map-button").disabled = !this.validation.valid;
    field("export-draft-button").disabled = !this.validation.valid;
    field("editor-preview").disabled = !this.validation.valid;
    field("editor-show-error").hidden = !this.validation.pointIndices?.length;
    field("editor-fit").hidden = this.validation.code !== "bounds";
    field("editor-move-coordinate").disabled = this.selected < 0;
    field("editor-point").replaceChildren(new Option("Ninguno", "-1"), ...this.draft.points.map((point, index) => new Option(`Punto ${index + 1}`, index)));
    field("editor-point").value = this.selected;
    if (this.selected >= 0) {
      field("editor-x").value = this.draft.points[this.selected].x;
      field("editor-y").value = this.draft.points[this.selected].y;
    }
    document.querySelectorAll(".editor-tool").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.tool === this.tool)));
    this.canvas.dataset.tool = this.tool;
    this.draw();
  }

  draw() {
    const { width, height } = this.size;
    const context = prepareCanvas(this.canvas, width, height);
    if (this.validation.track) drawTrack(context, this.validation.track);
    else {
      drawGrid(context, width, height);
      if (this.validation.preview) {
        polygonPath(context, this.validation.preview.outer);
        context.fillStyle = "#52605a"; context.fill();
        polygonPath(context, this.validation.preview.inner);
        context.fillStyle = "#1c3630"; context.fill();
      } else if (this.draft.points.length > 1) {
        polygonPath(context, this.draft.points);
        context.strokeStyle = "#52605a80"; context.lineWidth = this.draft.width;
        context.lineJoin = "round"; context.stroke();
      }
    }
    if (this.previewing) { this.drawPreviewCars(context); return; }
    const area = trackArea(this.draft);
    context.fillStyle = "#f05c5540";
    context.fillRect(0, 0, width, area.top);
    context.fillRect(0, area.bottom, width, height - area.bottom);
    context.fillRect(0, area.top, area.left, area.bottom - area.top);
    context.fillRect(area.right, area.top, width - area.right, area.bottom - area.top);
    context.strokeStyle = "#71e8d0"; context.lineWidth = 2; context.setLineDash([10, 6]);
    context.strokeRect(area.left, area.top, area.right - area.left, area.bottom - area.top);
    context.setLineDash([]);
    context.fillStyle = "#b5f4e6"; context.font = "14px 'Segoe UI', sans-serif"; context.textAlign = "left";
    context.fillText(translateText("ÁREA ÚTIL · toda la carretera debe quedar dentro"), 32, 54);
    // A faint inset suggests a safe position for the centre points at the current width.
    context.strokeStyle = "#71e8d040";
    context.strokeRect(area.left + this.draft.width / 2, area.top + this.draft.width / 2,
      area.right - area.left - this.draft.width, area.bottom - area.top - this.draft.width);
    context.strokeStyle = "#ff6868"; context.lineWidth = 5;
    for (const location of this.validation.locations || []) {
      context.beginPath(); context.arc(location.x, location.y, 5, 0, Math.PI * 2); context.stroke();
    }
    context.strokeStyle = this.validation.valid ? "#c7dfa583" : "#e6a881";
    context.lineWidth = 2;
    context.setLineDash([6, 6]);
    context.beginPath();
    this.draft.points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
    if (this.draft.points.length >= 3) context.closePath();
    context.stroke();
    context.setLineDash([]);
    this.draft.points.forEach((point, index) => {
      const problem = this.validation.pointIndices?.includes(index);
      if (problem) {
        context.beginPath(); context.arc(point.x, point.y, 20, 0, Math.PI * 2);
        context.strokeStyle = "#ff6868"; context.lineWidth = 4; context.stroke();
      }
      context.beginPath(); context.arc(point.x, point.y, index === this.selected ? 13 : 10, 0, Math.PI * 2);
      context.fillStyle = index === this.selected ? "#ff9468" : problem ? "#ff8b8b" : "#e7ead2";
      context.fill();
      context.strokeStyle = "#213f31"; context.lineWidth = 2; context.stroke();
      context.textAlign = "center"; context.textBaseline = "middle";
      context.fillStyle = "#20352d"; context.font = "bold 11px Consolas, monospace";
      context.fillText(String(index + 1), point.x, point.y);
      if (index === this.draft.startIndex) {
        context.fillStyle = "#c9e398"; context.font = "12px Consolas, monospace";
        context.fillText(translateText("SALIDA"), point.x, point.y - 26);
      }
    });
    if (!this.draft.points.length) {
      context.fillStyle = "#a9c2aa"; context.textAlign = "center"; context.font = "23px 'Segoe UI', sans-serif";
      context.fillText(translateText("Tu circuito empieza con un punto."), width / 2, height / 2 - 22);
      context.font = "15px 'Segoe UI', sans-serif";
      context.fillText(translateText("Haz clic y dibuja un recorrido amplio, sin cruces."), width / 2, height / 2 + 15);
    }
  }

  stopPreview() {
    this.previewing = false;
    cancelAnimationFrame(this.previewFrame);
    field("editor-preview").textContent = "Previsualizar carrera";
    field("editor-preview").setAttribute("aria-pressed", "false");
  }

  drawPreviewCars(context) {
    const track = this.validation.track;
    const colors = ["#ff9468", "#71e8d0", "#f0db76", "#a9afff", "#ef98ce", "#ffffff"];
    colors.forEach((color, index) => {
      // Hold the real grid briefly, then follow the track in its configured direction.
      const travelled = Math.max(0, this.previewTime - 1.2) * (130 + index * 3);
      const pose = travelled ? track.poseAt(track.startDistance - 40 - Math.floor(index / 2) * 48 + travelled) : track.getStart(index);
      const lane = travelled ? (index % 2 === 0 ? -1 : 1) * track.width * 0.18 : 0;
      context.save();
      context.translate(pose.x - Math.sin(pose.angle) * lane, pose.y + Math.cos(pose.angle) * lane);
      context.rotate(pose.angle);
      context.fillStyle = color; context.fillRect(-17, -9, 34, 18);
      context.fillStyle = "#142a29"; context.fillRect(3, -6, 6, 12);
      context.restore();
    });
  }
}
