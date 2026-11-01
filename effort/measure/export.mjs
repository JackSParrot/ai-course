// Convierte el resumen de grade.mjs en effort/src/data.js, los datos que muestra el capítulo.
// Uso: node effort/measure/export.mjs <resumen.json>
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const { runs } = JSON.parse(await readFile(process.argv[2], 'utf8'));
const LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'];
const TASKS = ['explicar', 'tabla', 'informe'];
// Lo que hay que mirar en cada encargo: si vio el error de la luz y, en la tabla, cuántas filas cuadran.
const check = (r) => r.task === 'explicar' ? { caught: /213[.,]6/.test(r.grade.answer) }
  : r.task === 'tabla' ? { caught: r.grade.flaggedPowerError, rows: r.grade.correctRows, duplicate: !r.grade.duplicateIncluded, creditNote: r.grade.creditNoteNegative }
  : { caught: r.grade.mentionsPowerError, bytes: r.grade.bytes };
const rows = runs
  .sort((a, b) => TASKS.indexOf(a.task) - TASKS.indexOf(b.task) || LEVELS.indexOf(a.effort) - LEVELS.indexOf(b.effort) || a.rep - b.rep)
  .map((r) => ({ task: r.task, effort: r.effort, rep: r.rep, seconds: r.seconds, usd: Math.round(r.costUsd * 1000) / 1000, turns: r.turns, output: r.outputTokens, thinking: r.thinkingTokens, ...check(r) }));
const lines = rows.map((r) => '  ' + JSON.stringify(r).replace(/"(\w+)":/g, '$1:').replace(/"/g, "'") + ',');
await writeFile(join(here, '..', 'src', 'data.js'), `// Generado por effort/measure/export.mjs: medidas reales, no ilustraciones.
// Claude Opus 5.5 (claude-opus-5-5) en Claude Code 2.1.316, 1 de noviembre de 2026, sin memoria entre ejecuciones.
// usd es el coste a precio de lista de la API que da Claude Code; con una suscripción, ese trabajo gasta del límite de uso.
export const LEVELS = ${JSON.stringify(LEVELS).replace(/"/g, "'")};
export const RUNS = [
${lines.join('\n')}
];
`);
console.log(`${rows.length} ejecuciones en effort/src/data.js`);
