import { closestPointOnSegment, distance, intersectSegments, pointInPolygon, polygonArea, segmentsTouch } from "./geometry.js";
import { BUILT_IN_MAPS, copyMap, MAP_VERSION } from "./maps.js";

export const WORLD_WIDTH = 1060;
export const WORLD_HEIGHT = 720;
export const MIN_TRACK_WIDTH = 70;
export const MAX_TRACK_WIDTH = 160;
export const MAX_MAP_POINTS = 64;
export const TRACK_AREA = { left: 18, top: 68, right: WORLD_WIDTH - 18, bottom: WORLD_HEIGHT - 68 };
export function mapDimensions(map) {
  return { width: map.worldWidth ?? WORLD_WIDTH, height: map.worldHeight ?? WORLD_HEIGHT };
}
export function trackArea(map) {
  const { width, height } = mapDimensions(map);
  return { left: 18, top: 68, right: width - 18, bottom: height - 68 };
}

function mapError(message, pointIndices = [], locations = [], preview = null, code = "geometry") {
  return Object.assign(new Error(message), { pointIndices, locations, preview, code });
}

function nearestControls(points, locations) {
  return [...new Set(locations.map(location => points.reduce((best, point, index) =>
    distance(point, location) < distance(points[best], location) ? index : best, 0)))].sort((a, b) => a - b);
}

export function polygonEdges(polygon) {
  return polygon.map((point, index) => [point, polygon[(index + 1) % polygon.length]]);
}

// Redondear una esquina con una curva cuadrática: entrada → punto → salida.
// Los tramos entre curvas son rectas. No hacen falta librerías de geometría.
function roundedPath(points, width) {
  const path = [];
  for (let i = 0; i < points.length; i++) {
    const previous = points[(i + points.length - 1) % points.length];
    const point = points[i];
    const next = points[(i + 1) % points.length];
    const before = distance(point, previous);
    const after = distance(point, next);
    const cut = Math.min(before * 0.45, after * 0.45, width * 3);
    const entry = { x: point.x + (previous.x - point.x) * cut / before, y: point.y + (previous.y - point.y) * cut / before };
    const exit = { x: point.x + (next.x - point.x) * cut / after, y: point.y + (next.y - point.y) * cut / after };
    for (let step = 0; step <= 10; step++) {
      const t = step / 10;
      const u = 1 - t;
      path.push({ x: u * u * entry.x + 2 * u * t * point.x + t * t * exit.x,
        y: u * u * entry.y + 2 * u * t * point.y + t * t * exit.y });
    }
  }
  return path;
}

function offsetPath(points, offset) {
  return points.map((point, index) => {
    const previous = points[(index + points.length - 1) % points.length];
    const next = points[(index + 1) % points.length];
    const before = distance(previous, point);
    const after = distance(point, next);
    const normalA = { x: -(point.y - previous.y) / before, y: (point.x - previous.x) / before };
    const normalB = { x: -(next.y - point.y) / after, y: (next.x - point.x) / after };
    const normal = { x: normalA.x + normalB.x, y: normalA.y + normalB.y };
    const divisor = normal.x * normalB.x + normal.y * normalB.y;
    if (divisor < 0.05) throw mapError("Hay un giro demasiado cerrado. Separa los puntos de esa curva.", [], [point]);
    return { x: point.x + normal.x * offset / divisor, y: point.y + normal.y * offset / divisor };
  });
}

function crossingLocations(polygon) {
  const edges = polygonEdges(polygon);
  const locations = [];
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 2; j < edges.length; j++) {
      if (i === 0 && j === edges.length - 1) continue;
      if (segmentsTouch(...edges[i], ...edges[j])) locations.push(...edges[i], ...edges[j]);
    }
  }
  return [...new Set(locations)];
}

function validateDefinition(map) {
  if (!map || map.version !== MAP_VERSION) throw new Error("Este archivo no es un mapa de la versión 1.");
  if (typeof map.id !== "string" || map.id.length > 100) throw new Error("El identificador del mapa no es válido.");
  if (typeof map.name !== "string" || !map.name.trim() || map.name.length > 48) throw new Error("Escribe un nombre de entre 1 y 48 caracteres.");
  if (!Number.isFinite(map.width) || map.width < MIN_TRACK_WIDTH || map.width > MAX_TRACK_WIDTH) throw new Error("El ancho debe estar entre 70 y 160 unidades.");
  const size = mapDimensions(map);
  if (!Number.isInteger(size.width) || !Number.isInteger(size.height) || size.width < WORLD_WIDTH || size.height < WORLD_HEIGHT || size.width > WORLD_WIDTH * 3 || size.height > WORLD_HEIGHT * 3 || size.width * WORLD_HEIGHT !== size.height * WORLD_WIDTH) throw new Error("El tamaño del terreno no es válido.");
  if (!Array.isArray(map.points) || map.points.length < 3 || map.points.length > MAX_MAP_POINTS) throw new Error("Dibuja entre 3 y 64 puntos para cerrar el circuito.");
  if (!Number.isInteger(map.startIndex) || map.startIndex < 0 || map.startIndex >= map.points.length || typeof map.reversed !== "boolean") throw new Error("La salida o el sentido no son válidos.");
  for (const point of map.points) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x > size.width || point.y < 0 || point.y > size.height) throw new Error("Todos los puntos deben estar dentro del lienzo.");
  }
  for (const [index, [a, b]] of polygonEdges(map.points).entries()) {
    if (distance(a, b) < 35) throw mapError("Hay dos puntos demasiado juntos. Sepáralos al menos 35 unidades.", [index, (index + 1) % map.points.length], [a, b]);
  }
  const crossings = crossingLocations(map.points);
  if (crossings.length) throw mapError("El recorrido se cruza. Mueve los extremos de los tramos marcados para deshacer el cruce.", nearestControls(map.points, crossings), crossings);
}

export class Track {
  constructor(definition = BUILT_IN_MAPS[0]) {
    validateDefinition(definition);
    this.definition = copyMap(definition);
    this.name = definition.name;
    this.width = definition.width;
    this.worldWidth = mapDimensions(definition).width;
    this.worldHeight = mapDimensions(definition).height;
    const area = trackArea(definition);
    this.center = roundedPath(definition.points, definition.width);
    if (definition.reversed) this.center.reverse();
    let sideA, sideB;
    try {
      sideA = offsetPath(this.center, definition.width / 2);
      sideB = offsetPath(this.center, -definition.width / 2);
    } catch (error) {
      error.pointIndices = nearestControls(definition.points, error.locations || []);
      throw error;
    }
    this.outer = Math.abs(polygonArea(sideA)) > Math.abs(polygonArea(sideB)) ? sideA : sideB;
    this.inner = this.outer === sideA ? sideB : sideA;
    this.borders = [...polygonEdges(this.outer), ...polygonEdges(this.inner)];

    const fail = (message, locations, code) => { throw mapError(message, nearestControls(definition.points, locations), locations, this, code); };
    const outside = [...this.outer, ...this.inner].filter(point => point.x < area.left || point.x > area.right || point.y < area.top || point.y > area.bottom);
    if (outside.length) fail("La carretera sale del área útil. Mueve los puntos marcados hacia el centro, reduce el ancho o pulsa Encajar pista.", outside, "bounds");
    const crossings = [...crossingLocations(this.outer), ...crossingLocations(this.inner)];
    if (crossings.length || Math.abs(polygonArea(this.inner)) < 2500 || polygonArea(this.inner) * polygonArea(this.outer) <= 0) fail("La carretera se solapa o tiene una curva demasiado cerrada. Separa los puntos marcados para ampliar la curva o reduce el ancho de pista.", crossings.length ? crossings : this.inner);
    const overlapping = this.inner.filter(point => !pointInPolygon(point, this.outer));
    if (overlapping.length) fail("Los bordes de la carretera se solapan. Separa los tramos marcados o reduce el ancho.", overlapping);
    for (const a of polygonEdges(this.outer)) {
      for (const b of polygonEdges(this.inner)) {
        if (segmentsTouch(...a, ...b)) fail("Los bordes de la carretera se tocan. Separa los tramos marcados o reduce el ancho.", [...a, ...b]);
      }
    }

    this.segmentLengths = polygonEdges(this.center).map(([a, b]) => distance(a, b));
    this.length = this.segmentLengths.reduce((sum, value) => sum + value, 0);
    this.startDistance = this.closestDistance(definition.points[definition.startIndex]);
    this.start = this.poseAt(this.startDistance);
    for (let i = 0; i < 6; i++) {
      if (this.touchesCar(this.carCornersAt(this.getStart(i)))) throw mapError("No caben los coches en esa salida. Usa Salida para elegir un punto en una recta o amplía la curva.", [definition.startIndex], [this.getStart(i)], this, "start");
    }
  }

  closestDistance(point) {
    let closest = Infinity;
    let result = 0;
    let walked = 0;
    polygonEdges(this.center).forEach(([a, b], index) => {
      const projected = closestPointOnSegment(point, a, b);
      if (distance(point, projected) < closest) {
        closest = distance(point, projected);
        result = walked + this.segmentLengths[index] * projected.offset;
      }
      walked += this.segmentLengths[index];
    });
    return result;
  }

  poseAt(pathDistance) {
    let remaining = ((pathDistance % this.length) + this.length) % this.length;
    for (let i = 0; i < this.center.length; i++) {
      const a = this.center[i];
      const b = this.center[(i + 1) % this.center.length];
      const length = this.segmentLengths[i];
      if (remaining <= length || i === this.center.length - 1) {
        const t = remaining / length;
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle: Math.atan2(b.y - a.y, b.x - a.x) };
      }
      remaining -= length;
    }
  }

  getStart(index) {
    const pose = this.poseAt(this.startDistance - 40 - Math.floor(index / 2) * 48);
    const lane = (index % 2 === 0 ? -1 : 1) * this.width * 0.18;
    return { x: pose.x - Math.sin(pose.angle) * lane, y: pose.y + Math.cos(pose.angle) * lane, angle: pose.angle };
  }

  carCornersAt(pose) {
    // La carrocería de 34 × 18, sin depender de la clase Car.
    return [[-17, -9], [17, -9], [17, 9], [-17, 9]].map(([x, y]) => ({
      x: pose.x + x * Math.cos(pose.angle) - y * Math.sin(pose.angle),
      y: pose.y + x * Math.sin(pose.angle) + y * Math.cos(pose.angle),
    }));
  }

  contains(point) {
    return pointInPolygon(point, this.outer) && !pointInPolygon(point, this.inner);
  }

  touchesCar(corners) {
    if (corners.some(corner => !this.contains(corner))) return true;
    for (const [a, b] of polygonEdges(corners)) {
      for (const [c, d] of this.borders) {
        if (intersectSegments(a, b, c, d)) return true;
      }
    }
    return false;
  }
}

export function validateMap(map) {
  try { return { valid: true, track: new Track(map), message: "Circuito válido. Listo para guardar y conducir." }; }
  catch (error) {
    const pointIndices = error.pointIndices || [];
    const label = pointIndices.length ? ` Puntos: ${pointIndices.map(index => index + 1).join(", ")}.` : "";
    return { valid: false, track: null, preview: error.preview || null, message: error.message + label,
      pointIndices, locations: error.locations || [], code: error.code || "definition" };
  }
}
