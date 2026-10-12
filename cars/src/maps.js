// Un mapa es solo datos. Los puntos describen el centro de la carretera.
// Las curvas, los bordes y la salida se calculan en track.js.
export const MAP_VERSION = 1;

function map(id, name, width, coordinates, startIndex = 0) {
  return { version: MAP_VERSION, id, name, width, startIndex, reversed: false,
    points: coordinates.map(([x, y]) => ({ x, y })) };
}

export const BUILT_IN_MAPS = [
  map("oval", "Óvalo", 124, [[500, 162], [750, 162], [917, 265], [917, 460], [750, 558], [312, 558], [145, 460], [145, 265], [312, 162]]),
  map("triangle", "Tres curvas", 90, [[530, 135], [890, 552], [170, 552]], 1),
  map("sweep", "Curvas enlazadas", 98, [[330, 156], [670, 156], [900, 250], [900, 540], [655, 555], [530, 418], [190, 530], [160, 280]]),
  map("rectangle", "Cuatro esquinas", 112, [[460, 160], [875, 160], [895, 550], [165, 550], [165, 160]]),
  map("reserve", "Circuito sorpresa", 98, [[365, 160], [670, 160], [865, 295], [840, 510], [580, 550], [240, 510], [175, 265]]),
];

export function copyMap(map) {
  return { ...map, points: map.points.map(point => ({ ...point })) };
}

// Una copia con otro nombre, salida o sentido sigue siendo el mismo entorno.
export function mapGeometryKey(map) {
  const coordinates = map.points.map(point => `${point.x},${point.y}`);
  const variants = [];
  for (const order of [coordinates, [...coordinates].reverse()]) {
    for (let i = 0; i < order.length; i++) variants.push([...order.slice(i), ...order.slice(0, i)].join(";"));
  }
  return `${map.width}|${variants.sort()[0]}`;
}
