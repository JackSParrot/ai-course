// Lanza un encargo con Claude Code a un nivel de esfuerzo y guarda la medida y lo que produjo.
// Uso: node effort/measure/run.mjs <explicar|tabla|informe> <low|medium|high|xhigh|max> <repetición> <carpeta de trabajo> <carpeta de resultados>
// La carpeta de trabajo se vacía antes de cada ejecución y es siempre la misma, para que la caché de prompts sirva igual a todas.
import { spawn } from 'node:child_process';
import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TASKS } from './tasks.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const [taskKey, effort, rep, workArg, resultsArg] = process.argv.slice(2);
const task = TASKS[taskKey];
if (!task || !effort || !rep || !workArg || !resultsArg) throw new Error('Uso: run.mjs <tarea> <esfuerzo> <repetición> <trabajo> <resultados>');
const work = resolve(workArg), dest = join(resolve(resultsArg), `${taskKey}-${effort}-${rep}`);

await rm(work, { recursive: true, force: true });
await mkdir(work, { recursive: true });
for (const file of task.files) await cp(join(here, 'facturas', file), join(work, 'facturas', file));
if (!task.files.length) await cp(join(here, 'facturas'), join(work, 'facturas'), { recursive: true });

const args = ['-p', task.prompt, '--model', process.env.EFFORT_MODEL || 'claude-opus-5-5', '--effort', effort, '--output-format', 'json', '--max-budget-usd', process.env.EFFORT_BUDGET || '20',
  '--setting-sources', 'project', '--strict-mcp-config', '--disable-slash-commands', '--no-session-persistence',
  '--permission-mode', 'acceptEdits', '--allowedTools', 'Read,Write,Edit,Glob,Grep',
  '--disallowedTools', 'Bash,WebFetch,WebSearch,Agent,Task,NotebookEdit'];
const started = Date.now();
// Sin memoria automática: si no, cada ejecución lee lo que apuntaron las anteriores y deja de empezar de cero.
const child = spawn(process.env.CLAUDE_BIN || 'claude', args, { cwd: work, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1' } });
let stdout = '', stderr = '';
child.stdout.on('data', (d) => { stdout += d; });
child.stderr.on('data', (d) => { stderr += d; });
const code = await new Promise((ok) => child.on('close', ok));
const wall = Date.now() - started;

await rm(dest, { recursive: true, force: true });
await mkdir(dest, { recursive: true });
for (const name of await readdir(work)) if (name !== 'facturas') await cp(join(work, name), join(dest, 'output', name), { recursive: true });
let result;
try { result = JSON.parse(stdout); } catch { result = { parseError: true, stdout, stderr }; }
await writeFile(join(dest, 'result.json'), JSON.stringify({ task: taskKey, effort, rep: Number(rep), exitCode: code, wallMs: wall, at: new Date().toISOString(), result }, null, 2));
const u = result.usage || {};
console.log(`${taskKey} ${effort} #${rep}: ${(wall / 1000).toFixed(0)} s, $${result.total_cost_usd?.toFixed(3)}, turns ${result.num_turns}, out ${u.output_tokens} (thinking ${u.output_tokens_details?.thinking_tokens})${code ? ' EXIT ' + code : ''}`);
