// Bilingual teaching corpus built from templates: no downloads and no copyrighted text.
// Short, regular sentences let a tiny model learn visible patterns in seconds.
export function random(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const pick = (rng, list) => list[Math.floor(rng() * list.length)];
const capital = text => text[0].toUpperCase() + text.slice(1);

const ES = {
  colors: ['rojo', 'azul', 'verde', 'amarillo', 'blanco', 'negro'],
  car: ['gira a la izquierda', 'gira a la derecha', 'acelera en la recta', 'frena antes de la curva', 'choca contra la pared', 'llega a la meta', 'sale de la pista', 'adelanta al coche {color2}'],
  neuron: ['suma sus entradas', 'multiplica cada entrada por su peso', 'se activa si la suma es positiva', 'añade el sesgo a la suma', 'envía su salida a la siguiente capa', 'no cambia sus pesos al conducir'],
  player: ['encuentra', 'recoge', 'pierde', 'guarda', 'compra', 'usa'],
  item: ['una espada', 'la llave dorada', 'el mapa del tesoro', 'tres monedas', 'una poción', 'el escudo'],
  explorer: ['camina hacia el norte', 'busca el tesoro', 'evita las trampas', 'se pierde en la oscuridad', 'encuentra la salida', 'vuelve a la entrada'],
  characters: ['la princesa', 'el dragón', 'el robot', 'el mago', 'la reina', 'el caballero'],
  social: ['saluda', 'ayuda', 'persigue', 'busca', 'encuentra'],
  places: ['castillo', 'bosque', 'puerto', 'desierto', 'laboratorio'],
  tasks: ['leer números', 'conducir', 'reconocer letras', 'ampliar imágenes', 'encontrar caminos'],
  counts: ['diez', 'cien', 'mil', 'dos mil'],
  react: ['frena', 'gira', 'reduce la velocidad'],
};
const EN = {
  colors: ['red', 'blue', 'green', 'yellow', 'white', 'black'],
  car: ['turns left', 'turns right', 'speeds up on the straight', 'brakes before the bend', 'crashes into the wall', 'reaches the finish line', 'leaves the track', 'overtakes the {color2} car'],
  neuron: ['adds up its inputs', 'multiplies each input by its weight', 'fires if the sum is positive', 'adds the bias to the sum', 'sends its output to the next layer', 'keeps its weights while driving'],
  player: ['finds', 'picks up', 'loses', 'keeps', 'buys', 'uses'],
  item: ['a sword', 'the golden key', 'the treasure map', 'three coins', 'a potion', 'the shield'],
  explorer: ['walks to the north', 'looks for the treasure', 'avoids the traps', 'gets lost in the dark', 'finds the exit', 'returns to the entrance'],
  characters: ['the princess', 'the dragon', 'the robot', 'the wizard', 'the queen', 'the knight'],
  social: ['greets', 'helps', 'chases', 'looks for', 'finds'],
  places: ['castle', 'forest', 'harbour', 'desert', 'laboratory'],
  tasks: ['read numbers', 'drive', 'recognise letters', 'upscale images', 'find paths'],
  counts: ['ten', 'a hundred', 'a thousand', 'two thousand'],
  react: ['brakes', 'turns', 'slows down'],
};

function sentence(language, rng) {
  const w = language === 'es' ? ES : EN, kind = Math.floor(rng() * 8);
  const score = Math.floor(rng() ** 2 * 5000);
  const color = pick(rng, w.colors), other = pick(rng, w.colors.filter(c => c !== color));
  if (language === 'es') switch (kind) {
    case 0: return `El coche ${color} ${pick(rng, w.car).replace('{color2}', other)}.`;
    case 1: return `La neurona ${pick(rng, w.neuron)}.`;
    case 2: return `El jugador ${pick(rng, w.player)} ${pick(rng, w.item)}.`;
    case 3: return `El explorador ${pick(rng, w.explorer)}.`;
    case 4: { const a = pick(rng, w.characters), b = pick(rng, w.characters.filter(c => c !== a)); return `${capital(a)} ${pick(rng, w.social)} ${b.startsWith('el ') ? 'al ' + b.slice(3) : 'a ' + b} en el ${pick(rng, w.places)}.`; }
    case 5: return `La red aprende a ${pick(rng, w.tasks)} con ${pick(rng, w.counts)} ejemplos.`;
    case 6: return `El jugador tiene ${score} puntos.`;
    default: return `Si el sensor ve una pared cerca, el coche ${pick(rng, w.react)}.`;
  }
  switch (kind) {
    case 0: return `The ${color} car ${pick(rng, w.car).replace('{color2}', other)}.`;
    case 1: return `The neuron ${pick(rng, w.neuron)}.`;
    case 2: return `The player ${pick(rng, w.player)} ${pick(rng, w.item)}.`;
    case 3: return `The explorer ${pick(rng, w.explorer)}.`;
    case 4: { const a = pick(rng, w.characters), b = pick(rng, w.characters.filter(c => c !== a)); return `${capital(a)} ${pick(rng, w.social)} ${b} in the ${pick(rng, w.places)}.`; }
    case 5: return `The network learns to ${pick(rng, w.tasks)} with ${pick(rng, w.counts)} examples.`;
    case 6: return `The player has ${score} points.`;
    default: return `If the sensor sees a wall nearby, the car ${pick(rng, w.react)}.`;
  }
}

// Validation sentences never appear in training, so its error measures generalisation.
export function buildCorpus({ languages = ['es', 'en'], train = 700, validation = 120, seed = 7 } = {}) {
  const rng = random(seed), seen = new Set(), result = { train: [], validation: [] };
  for (const language of languages) {
    for (const [split, count] of [['validation', validation], ['train', train]]) {
      let attempts = 0, added = 0;
      while (added < count && attempts++ < count * 50) {
        const text = sentence(language, rng);
        if (seen.has(text)) continue;
        seen.add(text); result[split].push({ language, text }); added++;
      }
    }
  }
  const order = random(seed + 1);
  for (const list of Object.values(result)) for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(order() * (i + 1)); [list[i], list[j]] = [list[j], list[i]];
  }
  return result;
}
// One sentence per line: the line break becomes a token that separates sentences.
export const joinText = sentences => sentences.map(s => s.text).join('\n');

// A small, readable corpus for building a tokenizer by hand on screen.
export const DEMO_CORPUS = 'el gato come. el gato bebe. la gata come. los gatos comen. el perro come. los perros beben. la gata bebe. el gato juega. los gatos juegan. el perro juega.';

// Word groups used to colour the embedding map; a group shares a role in the templates.
export const CATEGORIES = {
  colors: [...ES.colors, ...EN.colors],
  characters: [...ES.characters, ...EN.characters].map(text => text.split(' ').at(-1)),
  places: [...ES.places, ...EN.places],
};
