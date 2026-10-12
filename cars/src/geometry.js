// Funciones pequeñas que comparten los sensores y las colisiones.
export function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function polygonArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

export function closestPointOnSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const offset = lengthSquared === 0 ? 0 : clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared, 0, 1);
  return { x: a.x + dx * offset, y: a.y + dy * offset, offset };
}

// Incluye los segmentos colineales: importa al rechazar pistas solapadas.
export function segmentsTouch(a, b, c, d) {
  if (intersectSegments(a, b, c, d)) return true;
  const epsilon = 0.00001;
  return distance(a, closestPointOnSegment(a, c, d)) < epsilon
    || distance(b, closestPointOnSegment(b, c, d)) < epsilon
    || distance(c, closestPointOnSegment(c, a, b)) < epsilon
    || distance(d, closestPointOnSegment(d, a, b)) < epsilon;
}

// Devuelve dónde se cruzan los segmentos AB y CD, o null si no se cruzan.
// "offset" dice qué parte de AB hemos recorrido: 0 = A, 1 = B.
export function intersectSegments(a, b, c, d) {
  const abX = b.x - a.x;
  const abY = b.y - a.y;
  const cdX = d.x - c.x;
  const cdY = d.y - c.y;
  const denominator = abX * cdY - abY * cdX;

  if (Math.abs(denominator) < 0.000001) return null;

  const acX = c.x - a.x;
  const acY = c.y - a.y;
  const offset = (acX * cdY - acY * cdX) / denominator;
  const otherOffset = (acX * abY - acY * abX) / denominator;

  if (offset < 0 || offset > 1 || otherOffset < 0 || otherOffset > 1) {
    return null;
  }

  return { x: a.x + abX * offset, y: a.y + abY * offset, offset };
}

export function pointInPolygon(point, polygon) {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const crossesY = (a.y > point.y) !== (b.y > point.y);
    const crossesX = point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x;
    if (crossesY && crossesX) inside = !inside;
  }

  return inside;
}

// Una semilla permite repetir exactamente el mismo experimento.
export function createRandom(seed) {
  let state = Math.max(1, Math.floor(seed) % 2147483647);
  return function random() {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}
