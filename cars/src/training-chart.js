import { prepareCanvas } from "./renderer.js";

// Dos curvas sencillas: el mejor individuo y la media de toda la población.
// La escala se calcula con los resultados reales; una generación es un punto.
export function drawTrainingChart(canvas, history) {
  const width = 600;
  const height = 330;
  const context = prepareCanvas(canvas, width, height);
  context.clearRect(0, 0, width, height);
  context.font = "16px 'Segoe UI', sans-serif";
  if (!history.length) {
    context.textAlign = "center";
    context.fillStyle = "#8a947e";
    context.fillText("Evalúa y selecciona para dibujar la curva.", width / 2, height / 2);
    return;
  }
  const left = 65, right = width - 22, top = 24, bottom = height - 44;
  const values = history.flatMap(item => [item.best, item.average]);
  const minimum = Math.min(0, ...values);
  const maximum = Math.max(50, ...values);
  const span = Math.max(50, maximum - minimum);
  const x = index => history.length === 1 ? left : left + index / (history.length - 1) * (right - left);
  const y = value => bottom - (value - minimum) / span * (bottom - top);
  context.lineWidth = 1;
  for (let tick = 0; tick <= 4; tick++) {
    const value = minimum + span * tick / 4;
    context.strokeStyle = "#e1e7d7";
    context.beginPath(); context.moveTo(left, y(value)); context.lineTo(right, y(value)); context.stroke();
    context.textAlign = "right";
    context.fillStyle = "#89947d";
    context.fillText(Math.round(value).toLocaleString("es-ES"), left - 10, y(value) + 5);
  }
  for (const [key, color, dash] of [["average", "#aba68d", [7, 5]], ["best", "#638448", []]]) {
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = 3;
    context.setLineDash(dash);
    context.beginPath();
    history.forEach((item, index) => {
      if (index === 0) context.moveTo(x(index), y(item[key]));
      else context.lineTo(x(index), y(item[key]));
    });
    context.stroke();
    context.setLineDash([]);
    if (history.length <= 30) history.forEach((item, index) => {
      context.beginPath(); context.arc(x(index), y(item[key]), 4, 0, Math.PI * 2); context.fill();
    });
  }
  context.fillStyle = "#89947d";
  context.textAlign = "left";
  context.fillText(`G${history[0].generation}`, left, height - 13);
  context.textAlign = "center";
  context.fillText("Generación", (left + right) / 2, height - 13);
  if (history.length > 1) {
    context.textAlign = "right";
    context.fillText(`G${history.at(-1).generation}`, right, height - 13);
  }
}
