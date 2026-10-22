import { WORLD_WIDTH, WORLD_HEIGHT } from "./track.js";

export function polygonPath(context, points) {
  context.beginPath();
  points.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  context.closePath();
}

export function drawGrid(context, width = WORLD_WIDTH, height = WORLD_HEIGHT) {
  context.fillStyle = "#142a29";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#a9c4b016";
  for (let x = 20; x < width; x += 20) {
    for (let y = 20; y < height; y += 20) context.fillRect(x, y, 1, 1);
  }
}

// El editor y la simulación dibujan exactamente los mismos bordes.
export function drawTrack(context, track) {
  context.save();
  drawGrid(context, track.worldWidth, track.worldHeight);
  polygonPath(context, track.outer);
  context.lineWidth = 26;
  context.strokeStyle = "#0d2020";
  context.stroke();
  context.fillStyle = "#2c3e3c";
  context.fill();
  polygonPath(context, track.inner);
  context.fillStyle = "#1c3630";
  context.fill();

  context.save();
  polygonPath(context, track.inner);
  context.clip();
  context.strokeStyle = "#aac89205";
  context.lineWidth = 40;
  for (let x = 0; x < track.worldWidth + track.worldHeight; x += 80) {
    context.beginPath(); context.moveTo(x, 0); context.lineTo(x - track.worldHeight, track.worldHeight); context.stroke();
  }
  context.textAlign = "center";
  context.fillStyle = "#b8c5a959";
  context.font = "600 44px 'Segoe UI', sans-serif";
  context.fillText("NEURAL", track.worldWidth / 2, track.worldHeight / 2 - 5);
  context.fillStyle = "#8aab8577";
  context.font = "12px Consolas, monospace";
  context.fillText("R A C I N G   L A B", track.worldWidth / 2, track.worldHeight / 2 + 25);
  context.restore();

  for (const boundary of [track.outer, track.inner]) {
    polygonPath(context, boundary);
    context.strokeStyle = "#bec4a9";
    context.lineWidth = 8;
    context.stroke();
    context.strokeStyle = "#b16954";
    context.setLineDash([15, 15]);
    context.stroke();
    context.setLineDash([]);
    context.strokeStyle = "#e9e6cc";
    context.lineWidth = 1;
    context.stroke();
  }
  polygonPath(context, track.center);
  context.strokeStyle = "#afc5a530";
  context.lineWidth = 1.5;
  context.setLineDash([9, 14]);
  context.stroke();
  context.setLineDash([]);

  // La salida se orienta con la carretera, incluso en mapas nuevos.
  context.save();
  context.translate(track.start.x, track.start.y);
  context.rotate(track.start.angle);
  const cell = track.width / 14;
  for (let row = 0; row < 14; row++) {
    for (let column = 0; column < 2; column++) {
      context.fillStyle = (row + column) % 2 ? "#17302d" : "#d2d4bbbf";
      context.fillRect((column - 1) * cell, -track.width / 2 + row * cell, cell, cell);
    }
  }
  context.restore();

  for (const fraction of [0.08, 0.4, 0.75]) {
    const pose = track.poseAt(track.startDistance + track.length * fraction);
    context.save();
    context.translate(pose.x, pose.y);
    context.rotate(pose.angle);
    context.beginPath(); context.moveTo(-12, -8); context.lineTo(0, 0); context.lineTo(-12, 8);
    context.strokeStyle = "#c3d3b578";
    context.lineWidth = 2;
    context.stroke();
    context.restore();
  }
  context.restore();
}
