import { getLanguage, translateText } from '../../i18n/i18n.js';
import { drawTrack } from "./track-drawing.js";
import { CAR_LENGTH, CAR_WIDTH } from "./car.js";
import { clamp, distance } from "./geometry.js";
import { INPUT_OPTIONS, OUTPUT_OPTIONS } from "./topology.js";
import { WORLD_WIDTH, WORLD_HEIGHT } from "./track.js";

function circle(context, x, y, radius, color) {
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fillStyle = color;
  context.fill();
}

// Mantiene la imagen nítida en pantallas de alta densidad.
export function prepareCanvas(canvas, width, height) {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const actualWidth = Math.round(canvas.clientWidth * pixelRatio);
  const actualHeight = Math.round(actualWidth * height / width);
  if (canvas.width !== actualWidth || canvas.height !== actualHeight) {
    canvas.width = actualWidth;
    canvas.height = actualHeight;
  }
  const context = canvas.getContext("2d");
  context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
  return context;
}

export class Renderer {
  constructor(trackCanvas, networkCanvas, track) {
    this.trackCanvas = trackCanvas;
    this.networkCanvas = networkCanvas;
    // El fondo solo cambia al cargar otro mapa, no en cada fotograma.
    this.background = document.createElement("canvas");
    this.background.width = WORLD_WIDTH;
    this.background.height = WORLD_HEIGHT;
    this.setTrack(track);
  }

  setTrack(track) {
    drawTrack(this.background.getContext("2d"), track);
  }

  drawWorld(cars, selectedId, showSensors) {
    const context = prepareCanvas(this.trackCanvas, WORLD_WIDTH, WORLD_HEIGHT);
    context.drawImage(this.background, 0, 0);
    const selected = cars.find(car => car.id === selectedId);
    if (showSensors) this.drawSensors(context, selected);
    for (const car of cars) if (car.id !== selectedId) this.drawCar(context, car, false);
    this.drawCar(context, selected, true);
  }

  drawSensors(context, car) {
    context.save();
    context.font = "bold 11px Consolas, monospace";
    context.textAlign = "center";
    context.textBaseline = "middle";

    for (const ray of car.sensor.rays) {
      const end = ray.hit || ray.end;
      context.strokeStyle = "#cfeea52c";
      context.lineWidth = 1;
      context.setLineDash([4, 5]);
      context.beginPath();
      context.moveTo(end.x, end.y);
      context.lineTo(ray.end.x, ray.end.y);
      context.stroke();
      context.setLineDash([]);
      context.strokeStyle = "#d2ed93bd";
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(ray.start.x, ray.start.y);
      context.lineTo(end.x, end.y);
      context.stroke();
      circle(context, end.x, end.y, 3, "#e2f1b4");
      // Las etiquetas siguen siendo visibles aunque el alcance total
      // del rayo salga de la pantalla o el coche se acerque mucho al borde.
      const labelDistance = Math.max(64, distance(ray.start, end) + 18);
      const fullLength = distance(ray.start, ray.end);
      const labelX = clamp(ray.start.x + (ray.end.x - ray.start.x) * labelDistance / fullLength, 22, WORLD_WIDTH - 22);
      const labelY = clamp(ray.start.y + (ray.end.y - ray.start.y) * labelDistance / fullLength, 65, WORLD_HEIGHT - 65);
      circle(context, labelX, labelY, 10, "#122b28df");
      context.fillStyle = "#c0d996";
      context.fillText(String(ray.hour), labelX, labelY);
    }
    context.restore();
  }

  drawCar(context, car, selected) {
    context.save();
    context.translate(car.x, car.y);
    if (selected) {
      context.beginPath();
      context.arc(0, 0, 27, 0, Math.PI * 2);
      context.strokeStyle = car.color + "8c";
      context.lineWidth = 1.1;
      context.setLineDash([3, 4]);
      context.stroke();
      context.setLineDash([]);
    }
    context.rotate(car.angle);
    context.globalAlpha = car.crashed ? 0.5 : 1;
    context.fillStyle = "#071d1d";
    context.fillRect(-11, -CAR_WIDTH / 2 - 3, 9, 5);
    context.fillRect(-11, CAR_WIDTH / 2 - 2, 9, 5);
    context.fillRect(7, -CAR_WIDTH / 2 - 3, 7, 5);
    context.fillRect(7, CAR_WIDTH / 2 - 2, 7, 5);
    context.fillStyle = car.color;
    context.beginPath();
    context.roundRect(-CAR_LENGTH / 2, -CAR_WIDTH / 2, CAR_LENGTH, CAR_WIDTH, 5);
    context.fill();
    context.fillStyle = "#1a393b";
    context.beginPath();
    context.roundRect(-7, -6, 15, 12, 3);
    context.fill();
    context.fillStyle = "#96b8b899";
    context.fillRect(4, -5, 3, 10);
    context.fillStyle = "#fff2c9";
    context.fillRect(14, -6, 2, 3);
    context.fillRect(14, 3, 2, 3);
    context.fillStyle = "#3b2223";
    context.fillRect(-16, -6, 2, 3);
    context.fillRect(-16, 3, 2, 3);
    context.restore();

    context.save();
    context.font = "10px Consolas, monospace";
    context.textAlign = "center";
    context.fillStyle = selected ? car.color : car.color + "b3";
    context.fillText(car.crashed ? "×" : String(car.id).padStart(2, "0"), car.x, car.y - 34);
    context.restore();
  }

  drawNetwork(brain, topology) {
    drawNetwork(this.networkCanvas, brain, topology);
  }
}

// Lo comparten el inspector en vivo y la vista previa del editor.
export function drawNetwork(canvas, brain, topology) {
    const width = Math.max(340, brain.sizes.length * 85);
    const height = Math.max(210, Math.max(...brain.sizes) * 26 + 45);
    canvas.style.aspectRatio = `${width} / ${height}`;
    canvas.style.minWidth = brain.sizes.length > 4 ? `${width}px` : "0";
    canvas.setAttribute("aria-label", `Red ${brain.sizes.join(" → ")}. Activación ${brain.activation === "relu" ? "ReLU" : "sigmoide"}.`);
    const context = prepareCanvas(canvas, width, height);
    context.clearRect(0, 0, width, height);
    const positions = brain.sizes.map((size, layer) => {
      return Array.from({ length: size }, (_, neuron) => ({
        x: 46 + layer * (width - 92) / (brain.sizes.length - 1),
        y: height / 2 + 10 + (neuron - (size - 1) / 2) * 26,
      }));
    });

    brain.layers.forEach((layer, layerIndex) => {
      layer.weights.forEach((weights, neuron) => {
        weights.forEach((weight, input) => {
          const start = positions[layerIndex][input];
          const end = positions[layerIndex + 1][neuron];
          context.strokeStyle = weight >= 0 ? "#718c5e" : "#c78f70";
          context.globalAlpha = clamp(0.12 + Math.abs(weight) * 0.32, 0, 1);
          context.lineWidth = 0.5 + Math.abs(weight) * 0.8;
          context.setLineDash(weight < 0 ? [3, 3] : []);
          context.beginPath();
          context.moveTo(start.x, start.y);
          context.lineTo(end.x, end.y);
          context.stroke();
        });
      });
    });
    context.globalAlpha = 1;
    context.setLineDash([]);

    positions.forEach((neurons, layerIndex) => {
      context.fillStyle = "#839079";
      context.font = "10px Consolas, monospace";
      context.textAlign = "center";
      const english = getLanguage() === "en";
      const title = layerIndex === 0 ? (english ? "I" : "E") : layerIndex === brain.sizes.length - 1 ? (english ? "O" : "S") : `${english ? "H" : "C"}${layerIndex}`;
      context.fillText(`${title} · ${neurons.length}`, neurons[0].x, 15);
      neurons.forEach((position, neuronIndex) => {
        const value = brain.activations[layerIndex][neuronIndex];
        // Solo el color se limita. Los valores de ReLU y las entradas absolutas
        // conservan su valor real, que también aparece en las tablas del inspector.
        const intensity = clamp(value, 0, 1);
        circle(context, position.x, position.y, 10, "#fdfdf9");
        circle(context, position.x, position.y, 10, `rgba(112, 143, 83, ${0.08 + intensity * 0.8})`);
        context.strokeStyle = value > 0.5 ? "#829b6b" : "#bfc9b2";
        context.lineWidth = 1;
        context.stroke();
        context.fillStyle = value > 0.65 ? "#fff" : "#4b623b";
        context.font = "8px Consolas, monospace";
        context.textAlign = "center";
        context.textBaseline = "middle";
        const label = value < 10 ? value.toFixed(1) : value < 1000 ? String(Math.round(value)) : value.toExponential(0);
        context.fillText(label, position.x, position.y + 0.5);
        context.fillStyle = "#839079";
        context.font = "9px Consolas, monospace";
        if (layerIndex === 0) context.fillText(translateText(INPUT_OPTIONS.find(input => input.id === topology.inputs[neuronIndex].id).short), 16, position.y);
        if (layerIndex === brain.sizes.length - 1) context.fillText(OUTPUT_OPTIONS.find(output => output.id === topology.outputs[neuronIndex]).short, width - 16, position.y);
      });
    });
}
