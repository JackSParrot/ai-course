// Corrige los resultados guardados por run.mjs contra truth.json y escribe un resumen.
// Uso: node effort/measure/grade.mjs <carpeta de resultados> [salida.json]
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const { summary, invoices } = JSON.parse(await readFile(join(here, 'truth.json'), 'utf8'));
const results = resolve(process.argv[2]);
const outFile = process.argv[3];
const near = (a, b, tol = 0.011) => Math.abs(a - b) <= tol;
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function parseCsv(text) {
  const sep = (text.split('\n')[0].match(/;/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c; }
    else if (c === '"') quoted = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); if (row.some((x) => x.trim())) rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const head = rows.shift().map((h) => fold(h.trim()));
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}
const num = (s) => { const t = String(s ?? '').replace(/[€\s]/g, ''); return Number(/,\d{1,2}$/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '')); };
// Busca en el texto final de la respuesta un importe cercano al esperado.
const amounts = (text) => [...text.matchAll(/\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{1,2})?/g)].map((m) => num(m[0].replace(/\s/g, '').replace(/^(\d{1,3}(?:\.\d{3})+),(\d{1,2})$/, '$1,$2'))).filter(Number.isFinite);

function gradeTable(dir, out) {
  return readFile(join(dir, 'output', 'gastos.csv'), 'utf8').then((csv) => {
    const rows = parseCsv(csv.replace(/^﻿/, ''));
    const byFile = new Map(rows.map((r) => [r.archivo, r]));
    let correct = 0; const wrong = [];
    for (const inv of invoices) {
      const r = byFile.get(inv.file);
      // El total vale como importe pagado o como base más IVA: las dos lecturas de «total» son razonables.
      const ok = r && (near(num(r.total), inv.total) || near(num(r.total), inv.total + inv.withholding)) && near(num(r.base), inv.base) && near(num(r.iva), inv.vat) && near(Math.abs(num(r.retencion) || 0), inv.withholding) && r.fecha === inv.date;
      if (ok) correct++; else wrong.push(inv.file);
    }
    const duplicateIncluded = summary.duplicates.some((f) => byFile.has(f));
    const text = fold(out.result || '');
    return {
      rows: rows.length, expectedRows: summary.invoices, correctRows: correct, wrongRows: wrong,
      duplicateIncluded, creditNoteNegative: num(byFile.get('HM-R-2026-003.txt')?.total) < 0,
      reportedTotal: amounts(out.result || '').some((a) => [summary.total, summary.total + summary.withholding].some((t) => near(a, t, 0.02))),
      mentionsWithholding: /retenc|irpf/.test(text),
      // Cuenta como aviso dar el consumo real (1.950 kWh) o lo cobrado de más; citar los 2.950 kWh facturados no basta.
      flaggedPowerError: /1\.?950|213[.,]6|176[.,]59/.test(text),
      flaggedDuplicate: /duplic|reenvi|copia/.test(text),
    };
  }).catch((e) => ({ missing: true, error: String(e.message) }));
}

async function gradeReport(dir, out) {
  let html;
  try { html = await readFile(join(dir, 'output', 'informe.html'), 'utf8'); } catch { return { missing: true }; }
  const text = fold(html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ') + ' ' + html);
  return {
    bytes: html.length,
    externalResources: /<(script|link)[^>]+(src|href)=["']https?:/i.test(html),
    // Las cifras de la página suelen pintarse con JavaScript: estas marcas son una primera criba y el informe hay que abrirlo.
    mentionsDuplicate: /duplic|reenvi|copia/.test(text),
    mentionsCreditNote: /abono|rectificativa/.test(text),
    // Solo el importe cobrado de más: 1.950 kWh también es el consumo real de mayo.
    mentionsPowerError: /213[.,]6|176[.,]59/.test(text),
    mentionsOneOffRepair: /averi|resistencia|puntual|extraordinari/.test(text),
    mentionsWithholding: /retenc|irpf/.test(text),
    finalMessage: out.result,
  };
}

const runs = [];
for (const name of (await readdir(results)).sort()) {
  let data;
  try { data = JSON.parse(await readFile(join(results, name, 'result.json'), 'utf8')); } catch { continue; }
  const r = data.result, u = r.usage || {};
  const grade = data.task === 'tabla' ? await gradeTable(join(results, name), r) : data.task === 'informe' ? await gradeReport(join(results, name), r) : { answer: r.result };
  runs.push({ task: data.task, effort: data.effort, rep: data.rep, ok: !r.is_error, seconds: Math.round((r.duration_ms ?? data.wallMs) / 1000), costUsd: r.total_cost_usd, turns: r.num_turns, outputTokens: u.output_tokens, thinkingTokens: u.output_tokens_details?.thinking_tokens, inputTokens: (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0), grade });
}
const json = JSON.stringify({ truth: { invoices: summary.invoices, total: summary.total }, runs }, null, 2);
if (outFile) await writeFile(outFile, json + '\n');
for (const r of runs) console.log(r.task.padEnd(8), r.effort.padEnd(6), r.rep, `${r.seconds}s`.padStart(6), `$${r.costUsd?.toFixed(2)}`.padStart(7), `turns ${r.turns}`, `out ${r.outputTokens} think ${r.thinkingTokens}`, JSON.stringify(r.grade.answer ? { chars: r.grade.answer.length, flagged: /1\.?000|lectura/.test(r.grade.answer) } : { ...r.grade, finalMessage: undefined, wrongRows: r.grade.wrongRows?.length }));
