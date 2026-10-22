// The explorer only reads these genes. Maze distances belong to the evaluator.
export const MOVES = ["up", "down", "left", "right"];
export const ARROWS = { up: "↑", down: "↓", left: "←", right: "→" };
export const DNA_LENGTH = 100;
export const ARCHIVE_LIMIT = 60;
const DELTAS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
export class Random {
  constructor(seed = 42) { this.state = (Number(seed) >>> 0) || 42; }
  next() { this.state = (Math.imul(1664525, this.state) + 1013904223) >>> 0; return this.state / 4294967296; }
  integer(n) { return Math.floor(this.next() * n); }
}
export function generateMaze(size, seed, id, name) {
  const random = new Random(seed);
  const cells = Array.from({ length: size }, (_, y) => Array.from({ length: size }, (_, x) => x === 0 || y === 0 || x === size - 1 || y === size - 1 ? "#" : "."));
  // Separate islands leave broad spaces, alternative routes and U-shaped traps.
  // The three-cell outer margin stays open: both perimeter routes take 70 moves.
  for (let y = 5; y < size - 5; y += 7) for (let x = 5; x < size - 5; x += 7) {
    const width = 3 + random.integer(2), height = 3 + random.integer(2), shape = random.integer(4);
    for (let dy = 0; dy < height; dy++) for (let dx = 0; dx < width; dx++) {
      if (shape === 0 || (shape === 1 && (dx === 0 || dx === width - 1 || dy === height - 1)) || (shape === 2 && (dy === 0 || dy === height - 1 || dx === width - 1)) || (shape === 3 && (dx === 0 || dy === 0))) cells[y + dy][x + dx] = "#";
    }
  }
  return { id, name, width: size, height: size, cells: cells.map(row => row.join("")), start: { x: 1, y: 1 }, goal: { x: size - 2, y: size - 2 } };
}
export const MAZES = [generateMaze(38, 8, "ruins", "El campo de ruinas"), generateMaze(38, 27, "islands", "Las islas de piedra")];
export const copyMaze = maze => ({ ...maze, cells: [...maze.cells], start: { ...maze.start }, goal: { ...maze.goal } });
export function isOpen(maze, x, y) { return x >= 0 && y >= 0 && x < maze.width && y < maze.height && maze.cells[y][x] === "."; }
export function distancesToGoal(maze) {
  const distances = Array(maze.width * maze.height).fill(-1), queue = [maze.goal];
  distances[maze.goal.y * maze.width + maze.goal.x] = 0;
  for (let i = 0; i < queue.length; i++) {
    const { x, y } = queue[i];
    for (const [dx, dy] of Object.values(DELTAS)) {
      const nx = x + dx, ny = y + dy, index = ny * maze.width + nx;
      if (isOpen(maze, nx, ny) && distances[index] === -1) { distances[index] = distances[y * maze.width + x] + 1; queue.push({ x: nx, y: ny }); }
    }
  }
  return distances;
}
export function validateMaze(maze) {
  if (!maze || !Number.isInteger(maze.width) || !Number.isInteger(maze.height) || maze.width < 5 || maze.height < 5 || maze.width > 40 || maze.height > 40 || !Array.isArray(maze.cells) || maze.cells.length !== maze.height || maze.cells.some(row => typeof row !== "string" || row.length !== maze.width || /[^#.]/.test(row))) throw Error("El laberinto no es válido.");
  for (const point of [maze.start, maze.goal]) if (!point || !Number.isInteger(point.x) || !Number.isInteger(point.y) || !isOpen(maze, point.x, point.y)) throw Error("La entrada y el tesoro deben estar en un pasillo.");
  if (maze.start.x === maze.goal.x && maze.start.y === maze.goal.y) throw Error("La entrada y el tesoro deben estar separados.");
  const shortest = distancesToGoal(maze)[maze.start.y * maze.width + maze.start.x];
  if (shortest < 0) throw Error("El tesoro está aislado. Abre un pasillo que lo conecte con la entrada.");
  if (shortest > DNA_LENGTH) throw Error("El tesoro debe poder alcanzarse con los 100 movimientos del ADN.");
}
export function evaluateDNA(maze, dna, distances = distancesToGoal(maze)) {
  if (!Array.isArray(dna) || dna.some(gene => !MOVES.includes(gene))) throw Error("El ADN solo admite arriba, abajo, izquierda y derecha.");
  let { x, y } = maze.start;
  const initialDistance = distances[y * maze.width + x];
  let bestDistance = initialDistance, bestStep = 0, collisions = 0, solved = false;
  const trace = [{ x, y, hit: false }];
  for (const gene of dna) {
    const [dx, dy] = DELTAS[gene], hit = !isOpen(maze, x + dx, y + dy);
    if (hit) collisions++; else { x += dx; y += dy; }
    trace.push({ x, y, hit });
    const remaining = distances[y * maze.width + x];
    if (remaining >= 0 && remaining < bestDistance) { bestDistance = remaining; bestStep = trace.length - 1; }
    if (x === maze.goal.x && y === maze.goal.y) { solved = true; break; }
  }
  return { solved, bestDistance, bestStep, collisions, steps: trace.length - 1, trace,
    quality: solved ? 100 : Math.round(100 * (initialDistance - bestDistance) / (initialDistance + 1)) };
}
export function compareResults(a, b) {
  return Number(b.result.solved) - Number(a.result.solved) || a.result.bestDistance - b.result.bestDistance || a.result.bestStep - b.result.bestStep || a.result.collisions - b.result.collisions || a.id.localeCompare(b.id);
}
export function routeSignature(result) {
  return result.trace.filter((point, i, trace) => !i || point.x !== trace[i - 1].x || point.y !== trace[i - 1].y).map(point => `${point.x},${point.y}`).join(";");
}
const encodeDNA = dna => dna.map(gene => MOVES.indexOf(gene)).join("");
const decodeDNA = packed => [...packed].map(gene => MOVES[Number(gene)]);
export function rankWeights(ranking) {
  const total = ranking.length * (ranking.length + 1) / 2;
  return ranking.map((individual, i) => ({ individual, weight: ranking.length - i, probability: (ranking.length - i) / total }));
}
export function selectParent(ranking, random) {
  const weights = rankWeights(ranking), roll = random.next();
  let cumulative = 0;
  for (const slot of weights) { cumulative += slot.probability; if (roll < cumulative) return { ...slot, roll }; }
  return { ...weights.at(-1), roll };
}
export function crossAndMutate(a, b, random, mutationRate = .05) {
  if (a.dna.length !== b.dna.length || a.dna.length < 2) throw Error("Los padres necesitan ADN de la misma longitud.");
  const cut = 1 + random.integer(a.dna.length - 1);
  const before = [...a.dna.slice(0, cut), ...b.dna.slice(cut)];
  const mutations = [], mutationRolls = [];
  const dna = before.map((gene, index) => {
    const roll = random.next(); mutationRolls.push(roll);
    if (roll >= mutationRate) return gene;
    const alternatives = MOVES.filter(move => move !== gene), after = alternatives[random.integer(3)];
    mutations.push({ index, before: gene, after }); return after;
  });
  return { dna, cut, before, mutations, mutationRolls, mutationRate, parents: [a.id, b.id], parentDNA: [[...a.dna], [...b.dna]] };
}
export class Evolution {
  constructor(maze = MAZES[0], { seed = 42, mutationRate = .01, size = 64, length = DNA_LENGTH } = {}) {
    validateMaze(maze);
    if (!Number.isInteger(seed) || seed < 1 || seed > 2147483647 || !Number.isFinite(mutationRate) || mutationRate < 0 || mutationRate > 1 || ![16, 32, 64].includes(size)) throw Error("La configuración no es válida.");
    this.maze = copyMaze(maze); this.distances = distancesToGoal(maze);
    this.length = length;
    if (this.length !== DNA_LENGTH) throw Error("El ADN de cada explorador debe tener 100 movimientos.");
    this.seed = seed; this.random = new Random(seed); this.mutationRate = mutationRate; this.size = size;
    this.generation = 0; this.phase = "empty"; this.population = []; this.ranking = []; this.history = []; this.archive = []; this.best = null; this.pending = null;
  }
  randomDNA() { return Array.from({ length: this.length }, () => MOVES[this.random.integer(4)]); }
  individual(dna, index, origin = "random", ancestry = null) { return { id: `G${this.generation}-${String(index + 1).padStart(2, "0")}`, dna: [...dna], origin, ancestry }; }
  initialize() {
    if (this.phase !== "empty") throw Error("La primera población ya está creada.");
    this.generation = 1; this.population = Array.from({ length: this.size }, (_, i) => this.individual(this.randomDNA(), i)); this.phase = "ready";
  }
  evaluate() {
    if (this.phase !== "ready") throw Error("Primero crea una generación nueva.");
    this.population.forEach(individual => { individual.result = evaluateDNA(this.maze, individual.dna, this.distances); });
    this.ranking = [...this.population].sort(compareResults);
    const best = this.ranking[0];
    if (!this.best || compareResults(best, this.best) < 0) this.best = structuredClone(best);
    const solved = this.population.filter(p => p.result.solved);
    this.history.push({ generation: this.generation, best: best.result.quality, mean: this.population.reduce((sum, p) => sum + p.result.quality, 0) / this.size, diversity: new Set(this.population.map(p => p.dna.join(","))).size / this.size,
      solved: solved.length, routes: new Set(solved.map(p => routeSignature(p.result))).size, bestSteps: best.result.solved ? best.result.steps : null });
    this.archive.push({ generation: this.generation, population: this.population.map(p => ({ id: p.id, dna: encodeDNA(p.dna), origin: p.origin })) });
    if (this.archive.length > ARCHIVE_LIMIT + 1) this.archive.splice(1, this.archive.length - ARCHIVE_LIMIT - 1);
    this.phase = "evaluated"; return best;
  }
  generationPopulation(generation) {
    if (generation === this.generation) return this.population;
    const snapshot = this.archive.find(entry => entry.generation === generation);
    return snapshot?.population.map(p => { const dna = decodeDNA(p.dna); return { ...p, dna, result: evaluateDNA(this.maze, dna, this.distances) }; }) ?? [];
  }
  chooseParents() {
    if (this.phase !== "evaluated") throw Error("Primero evalúa la población.");
    this.pending = { draws: [selectParent(this.ranking, this.random), selectParent(this.ranking, this.random)] }; this.phase = "parents";
  }
  makeChild() {
    if (this.phase !== "parents") throw Error("Primero sortea los padres.");
    this.pending.child = crossAndMutate(...this.pending.draws.map(draw => draw.individual), this.random, this.mutationRate); this.phase = "birth";
  }
  nextGeneration() {
    if (this.phase !== "birth") throw Error("Primero observa el cruce y la mutación.");
    const previous = this.ranking, example = this.pending.child, eliteCount = Math.max(1, Math.floor(this.size / 16)), freshCount = eliteCount;
    this.generation++;
    const next = previous.slice(0, eliteCount).map((p, i) => this.individual(p.dna, i, "elite", { parents: [p.id] }));
    next.push(this.individual(example.dna, next.length, "child", structuredClone(example)));
    while (next.length < this.size - freshCount) {
      const parents = [selectParent(previous, this.random).individual, selectParent(previous, this.random).individual];
      const child = crossAndMutate(...parents, this.random, this.mutationRate);
      next.push(this.individual(child.dna, next.length, "child", child));
    }
    while (next.length < this.size) next.push(this.individual(this.randomDNA(), next.length));
    this.population = next; this.ranking = []; this.pending = null; this.phase = "ready";
  }
  cycle() { if (this.phase === "empty") this.initialize(); if (this.phase === "ready") this.evaluate(); if (this.phase === "evaluated") this.chooseParents(); if (this.phase === "parents") this.makeChild(); if (this.phase === "birth") this.nextGeneration(); }
}

export function exportExperiment(engine) {
  return { version: 2, maze: copyMaze(engine.maze), seed: engine.seed, size: engine.size, length: engine.length, mutationRate: engine.mutationRate,
    generation: engine.generation, randomState: engine.random.state, evaluated: engine.phase !== "ready" && engine.phase !== "empty",
    population: engine.population.map(({ id, dna, origin, ancestry }) => ({ id, dna, origin, ancestry })),
    history: engine.history, archive: engine.archive, best: engine.best ? { id: engine.best.id, dna: engine.best.dna } : null };
}
export function restoreExperiment(data) {
  if (!data || data.version !== 2 || !Number.isInteger(data.generation) || data.generation < 0 || data.generation > 1000000 || !Number.isInteger(data.randomState) || data.randomState < 0 || data.randomState > 4294967295 || typeof data.evaluated !== "boolean") throw Error("El experimento guardado no es válido.");
  const engine = new Evolution(data.maze, data);
  const validDNA = dna => Array.isArray(dna) && dna.length === engine.length && dna.every(gene => MOVES.includes(gene));
  if (!Array.isArray(data.population) || data.population.length !== (data.generation ? engine.size : 0)) throw Error("La población guardada está incompleta.");
  const ids = new Set();
  engine.population = data.population.map(p => {
    if (!p || typeof p.id !== "string" || !/^G\d+-\d+$/.test(p.id) || p.id.length > 32 || ids.has(p.id) || !validDNA(p.dna) || !["random", "elite", "child"].includes(p.origin)) throw Error("El ADN guardado no es válido.");
    ids.add(p.id);
    // Retain only bounded, displayable ancestry records; never restore executable objects.
    let ancestry = null;
    if (p.ancestry && Array.isArray(p.ancestry.parents) && p.ancestry.parents.length <= 2 && p.ancestry.parents.every(id => typeof id === "string" && /^G\d+-\d+$/.test(id) && id.length < 32)) {
      ancestry = { parents: [...p.ancestry.parents] };
      if (Array.isArray(p.ancestry.parentDNA) && p.ancestry.parentDNA.length === 2 && p.ancestry.parentDNA.every(validDNA) && validDNA(p.ancestry.before) && Number.isInteger(p.ancestry.cut) && p.ancestry.cut > 0 && p.ancestry.cut < engine.length && Array.isArray(p.ancestry.mutations) && p.ancestry.mutations.length <= engine.length && p.ancestry.mutations.every(m => Number.isInteger(m.index) && m.index >= 0 && m.index < engine.length && MOVES.includes(m.before) && MOVES.includes(m.after))) Object.assign(ancestry, { dna: [...p.dna], parentDNA: p.ancestry.parentDNA.map(dna => [...dna]), before: [...p.ancestry.before], cut: p.ancestry.cut, mutations: p.ancestry.mutations.map(({ index, before, after }) => ({ index, before, after })) });
      if (Array.isArray(p.ancestry.mutationRolls) && p.ancestry.mutationRolls.length === engine.length && p.ancestry.mutationRolls.every(n => Number.isFinite(n) && n >= 0 && n < 1) && Number.isFinite(p.ancestry.mutationRate) && p.ancestry.mutationRate >= 0 && p.ancestry.mutationRate <= 1) Object.assign(ancestry, { mutationRolls: [...p.ancestry.mutationRolls], mutationRate: p.ancestry.mutationRate });
    }
    return { id: p.id, dna: [...p.dna], origin: p.origin, ancestry };
  });
  engine.generation = data.generation; engine.random.state = data.randomState;
  if (!Array.isArray(data.history) || data.history.length > data.generation || data.history.some((h, i) => !h || h.generation !== i + 1 || [h.best, h.mean].some(n => !Number.isFinite(n) || n < 0 || n > 100) || !Number.isFinite(h.diversity) || h.diversity < 0 || h.diversity > 1 || !Number.isInteger(h.solved) || h.solved < 0 || h.solved > engine.size || !Number.isInteger(h.routes) || h.routes < 0 || h.routes > h.solved || (h.bestSteps !== null && (!Number.isInteger(h.bestSteps) || h.bestSteps < 1 || h.bestSteps > DNA_LENGTH)))) throw Error("El historial guardado no es válido.");
  engine.history = data.history.map(({ generation, best, mean, diversity, solved, routes, bestSteps }) => ({ generation, best, mean, diversity, solved, routes, bestSteps }));
  if (!Array.isArray(data.archive) || data.archive.length > ARCHIVE_LIMIT + 1 || data.archive.some((entry, i) => !entry || !Number.isInteger(entry.generation) || entry.generation < 1 || entry.generation > engine.history.length || (i > 0 && entry.generation <= data.archive[i - 1].generation) || !Array.isArray(entry.population) || entry.population.length !== engine.size || entry.population.some((p, j) => !p || p.id !== `G${entry.generation}-${String(j + 1).padStart(2, "0")}` || typeof p.dna !== "string" || p.dna.length !== DNA_LENGTH || /[^0-3]/.test(p.dna) || !["random", "elite", "child"].includes(p.origin)))) throw Error("Las generaciones guardadas no son válidas.");
  engine.archive = data.archive.map(entry => ({ generation: entry.generation, population: entry.population.map(({ id, dna, origin }) => ({ id, dna, origin })) }));
  if (data.best) {
    if (!validDNA(data.best.dna) || typeof data.best.id !== "string" || !/^G\d+-\d+$/.test(data.best.id)) throw Error("El campeón guardado no es válido.");
    engine.best = { id: data.best.id, dna: [...data.best.dna], result: evaluateDNA(engine.maze, data.best.dna, engine.distances) };
  }
  engine.phase = data.generation ? "ready" : "empty";
  if (data.generation && data.evaluated) {
    engine.history = engine.history.filter(h => h.generation !== engine.generation);
    engine.archive = engine.archive.filter(h => h.generation !== engine.generation);
    engine.evaluate();
  }
  return engine;
}
