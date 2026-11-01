// Genera las facturas inventadas de Horno Alto (julio 2025 – junio 2026) y la solución (truth.json).
// Uso: node effort/measure/make-invoices.mjs
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'facturas');
const cents = (x) => Math.round(x * 100) / 100;
const es = (x) => x.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' });
const en = (x) => x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const months = Array.from({ length: 12 }, (_, i) => { const m = (6 + i) % 12; return { y: m < 6 ? 2026 : 2025, m: m + 1 }; });
const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const dmy = (y, m, d) => `${pad(d)}/${pad(m)}/${y}`;
const days = (y, m) => new Date(y, m, 0).getDate();
const CLIENT = 'Horno Alto, S.L. · CIF B-50123456 · C/ Mayor 14, 50001 Zaragoza';

const files = [];
const truth = [];
function add(name, text, row) { files.push({ name, text }); if (row) truth.push({ file: name, ...row }); }
function vatBreakdown(lines) {
  const byRate = {};
  for (const l of lines) byRate[l.vat] = cents((byRate[l.vat] || 0) + l.amount);
  const base = cents(lines.reduce((s, l) => s + l.amount, 0));
  const vat = cents(Object.entries(byRate).reduce((s, [r, b]) => s + cents(b * r / 100), 0));
  return { byRate, base, vat };
}

// 1. Harinas del Moncayo: harina (4 %) y levadura (10 %); el saco sube en enero.
months.forEach(({ y, m }, i) => {
  const sackPrice = y === 2026 ? (m >= 4 ? 17.75 : 17.2) : 15.5;
  const sacks = [44, 30, 42, 46, 50, 62, 56, 44, 45, 50, 46, 44][i];
  const wholePrice = y === 2026 ? 21.4 : 19.9;
  const whole = [8, 5, 8, 8, 9, 10, 9, 8, 8, 9, 8, 8][i];
  const yeast = [12, 8, 12, 13, 14, 17, 15, 12, 12, 13, 12, 12][i];
  const lines = [
    { desc: 'Harina de trigo T55 (saco 25 kg)', qty: sacks, price: sackPrice, vat: 4 },
    { desc: 'Harina integral (saco 25 kg)', qty: whole, price: wholePrice, vat: 4 },
    { desc: 'Levadura fresca (caja 5 kg)', qty: yeast, price: 11.8, vat: 10 },
  ].map((l) => ({ ...l, amount: cents(l.qty * l.price) }));
  const { byRate, base, vat } = vatBreakdown(lines);
  const total = cents(base + vat);
  const d = 3, num = `HM-${y}-${pad(m)}${pad(i + 11)}`;
  const text = `HARINAS DEL MONCAYO, S.A.
CIF A-50998877 · Polígono Malpica, nave 7 · Zaragoza
-----------------------------------------------------------
FACTURA Nº ${num}                Fecha: ${dmy(y, m, d)}
Cliente: ${CLIENT}
-----------------------------------------------------------
Concepto                              Uds.   Precio   Importe
${lines.map((l) => `${l.desc.padEnd(36)} ${String(l.qty).padStart(4)} ${es(l.price).padStart(8)} ${es(l.amount).padStart(9)}`).join('\n')}
-----------------------------------------------------------
${Object.entries(byRate).map(([r, b]) => `Base ${r} %: ${es(b)} €   IVA ${r} %: ${es(cents(b * r / 100))} €`).join('\n')}
TOTAL FACTURA: ${es(total)} €
Forma de pago: domiciliación a 30 días.
`;
  add(`HM-${y}-${pad(m)}.txt`, text, { supplier: 'Harinas del Moncayo', category: 'Materias primas', number: num, date: iso(y, m, d), base, vat, withholding: 0, total });
});

// Abono de Harinas del Moncayo: cuatro sacos llegaron mojados en febrero.
{
  const lines = [{ desc: 'Abono 4 sacos T55 dañados (albarán 2026-0211)', qty: -4, price: 17.2, vat: 4 }].map((l) => ({ ...l, amount: cents(l.qty * l.price) }));
  const { base, vat } = vatBreakdown(lines);
  const total = cents(base + vat), num = 'R-2026-003';
  add('HM-R-2026-003.txt', `HARINAS DEL MONCAYO, S.A.
CIF A-50998877 · Polígono Malpica, nave 7 · Zaragoza
-----------------------------------------------------------
FACTURA RECTIFICATIVA Nº ${num}       Fecha: 09/03/2026
Rectifica a la factura HM-2026-0218 de 03/02/2026
Cliente: ${CLIENT}
-----------------------------------------------------------
${lines[0].desc}        ${lines[0].qty} x ${es(lines[0].price)} = ${es(lines[0].amount)}
Base 4 %: ${es(base)} €   IVA 4 %: ${es(vat)} €
TOTAL A ABONAR: ${es(total)} €
Se descontará en su próximo cargo.
`, { supplier: 'Harinas del Moncayo', category: 'Materias primas', number: num, date: '2026-03-09', base, vat, withholding: 0, total });
}

// 2. Lácteos La Vega: IVA mixto (leche y huevos 4 %, mantequilla y nata 10 %); fechas en letra.
const dairy = [];
months.forEach(({ y, m }, i) => {
  const k = [1, 0.7, 1, 1.05, 1.15, 1.45, 1.25, 1, 1, 1.1, 1, 0.95][i];
  const lines = [
    { desc: 'Mantequilla 82 % (bloque 1 kg)', qty: Math.round(60 * k), price: y === 2026 ? 9.6 : 9.1, vat: 10 },
    { desc: 'Leche entera (brik 1 l)', qty: Math.round(120 * k), price: 0.98, vat: 4 },
    { desc: 'Huevos L (bandeja 30)', qty: Math.round(40 * k), price: 7.2, vat: 4 },
    { desc: 'Nata 35 % (1 l)', qty: Math.round(24 * k), price: 4.1, vat: 10 },
  ].map((l) => ({ ...l, amount: cents(l.qty * l.price) }));
  const { byRate, base, vat } = vatBreakdown(lines);
  const total = cents(base + vat), d = 6, num = `LV/${String(y).slice(2)}/${pad(m)}${pad(30 + i)}`;
  const body = (copy) => `${copy ? '*** COPIA · REENVÍO DE FACTURA YA EMITIDA ***\n\n' : ''}LÁCTEOS LA VEGA · Cooperativa
Ctra. de Huesca km 3 · Villanueva de Gállego · NIF F-50443322

Factura: ${num}
Emitida el ${d} de ${MES[m - 1]} de ${y}
Para: Horno Alto, S.L. (B-50123456)

| Producto                         | Cant. | € unidad | € total  | IVA |
|----------------------------------|-------|----------|----------|-----|
${lines.map((l) => `| ${l.desc.padEnd(32)} | ${String(l.qty).padStart(5)} | ${es(l.price).padStart(8)} | ${es(l.amount).padStart(8)} | ${String(l.vat).padStart(2)}% |`).join('\n')}

Suma productos: ${es(base)} €
${Object.entries(byRate).map(([r, b]) => `IVA ${r}% sobre ${es(b)} €: ${es(cents(b * r / 100))} €`).join('\n')}
Importe total: ${es(total)} €
`;
  const name = `lacteos_vega_${MES[m - 1].slice(0, 3)}${String(y).slice(2)}.txt`;
  add(name, body(false), { supplier: 'Lácteos La Vega', category: 'Materias primas', number: num, date: iso(y, m, d), base, vat, withholding: 0, total });
  if (y === 2025 && m === 10) dairy.push({ name: `reenvio_${name}`, text: body(true) });
});
for (const f of dairy) add(f.name, f.text, null);

// 3. Eléctrica Sierra: estacional; la de febrero de 2026 factura 1.000 kWh de más (lecturas 1.950, facturado 2.950).
let reading = 41_380;
const ELEC_TAX = 5.11269632;
months.forEach(({ y, m }, i) => {
  const kwh = [2100, 1500, 2000, 2150, 2300, 2700, 2400, 1950, 2100, 2150, 2000, 1950][i];
  const billed = y === 2026 && m === 2 ? kwh + 1000 : kwh;
  const price = [0.142, 0.142, 0.145, 0.149, 0.155, 0.162, 0.166, 0.168, 0.161, 0.153, 0.148, 0.146][i];
  const prev = reading; reading += kwh;
  // Periodo: el mes anterior al de emisión.
  const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1, n = days(py, pm);
  const power = cents(6.9 * n * 0.1135), energy = cents(billed * price);
  const tax = cents((power + energy) * ELEC_TAX / 100), meter = cents(n * 0.0266);
  const base = cents(power + energy + tax + meter), vat = cents(base * 0.21), total = cents(base + vat);
  const num = `ES-${y}${pad(m)}-${700 + i * 13}`, d = 8;
  const text = `ELÉCTRICA SIERRA, S.L.U. — Factura de electricidad
Nº de factura: ${num}         Fecha de emisión: ${iso(y, m, d)}
Titular: Horno Alto, S.L. · Suministro: C/ Mayor 14, Zaragoza
Tarifa 2.0TD · Potencia contratada: 6,9 kW
Periodo de facturación: 01/${pad(pm)}/${py} a ${n}/${pad(pm)}/${py} (${n} días)

LECTURAS DEL CONTADOR
  Lectura anterior (real): ${prev.toLocaleString('es-ES', { useGrouping: 'always' })} kWh
  Lectura actual (real):   ${reading.toLocaleString('es-ES', { useGrouping: 'always' })} kWh

DETALLE
  Término de potencia     6,9 kW x ${n} días x 0,113500 €/kW día   ${es(power)} €
  Término de energía      ${billed.toLocaleString('es-ES', { useGrouping: 'always' })} kWh x ${price.toFixed(6).replace('.', ',')} €/kWh   ${es(energy)} €
  Impuesto eléctrico      5,11269632 % s/ ${es(cents(power + energy))} €      ${es(tax)} €
  Alquiler equipo medida  ${n} días x 0,026600 €/día           ${es(meter)} €
  -----------------------------------------------------------------
  Base imponible                                          ${es(base)} €
  IVA 21 %                                                ${es(vat)} €
  TOTAL                                                   ${es(total)} €

Cargo en cuenta el ${iso(y, m, 20)}.
`;
  add(`factura_luz_${y}_${pad(m)}.txt`, text, { supplier: 'Eléctrica Sierra', category: 'Suministros', number: num, date: iso(y, m, d), base, vat, withholding: 0, total, ...(billed !== kwh ? { error: { billedKwh: billed, readKwh: kwh, overchargeTotal: cents(cents(cents(1000 * price) * (1 + ELEC_TAX / 100)) * 1.21) } } : {}) });
});

// 4. Alquiler del local: retención de IRPF del 19 %; sube un 2,8 % en enero.
months.forEach(({ y, m }) => {
  const base = y === 2026 ? 1233.6 : 1200, vat = cents(base * 0.21), wh = cents(base * 0.19), total = cents(base + vat - wh);
  const num = `${y}/${pad(m)}`;
  add(`recibo alquiler ${MES[m - 1]} ${y}.txt`, `INMUEBLES ARCOS, S.L.  ·  CIF B-50777111
Paseo de la Independencia 22, Zaragoza

RECIBO-FACTURA DE ALQUILER Nº ${num}
Zaragoza, a 1 de ${MES[m - 1]} de ${y}

Arrendatario: Horno Alto, S.L.
Inmueble: local comercial en C/ Mayor 14, bajo.
Concepto: renta de ${MES[m - 1]} de ${y}${y === 2026 && m === 1 ? ' (actualizada según IPC: +2,8 %)' : ''}.

  Renta mensual ............................ ${es(base)} €
  IVA (21 %) ............................... ${es(vat)} €
  Retención IRPF (19 %) .................... -${es(wh)} €
  LÍQUIDO A PAGAR .......................... ${es(total)} €

El arrendatario ingresará la retención en Hacienda (modelo 115).
`, { supplier: 'Inmuebles Arcos', category: 'Local', number: num, date: iso(y, m, 1), base, vat, withholding: wh, total });
});

// 5. Gestoría: trimestral, profesional con retención del 15 %.
[[2025, 7, '2T 2025'], [2025, 10, '3T 2025'], [2026, 1, '4T 2025'], [2026, 4, '1T 2026']].forEach(([y, m, q], i) => {
  const base = 180, vat = cents(base * 0.21), wh = cents(base * 0.15), total = cents(base + vat - wh), num = `${y}-0${41 + i}`;
  add(`Gestoria Ruiz ${q}.txt`, `Marta Ruiz Lahoz — Asesoría fiscal y contable
NIF 25123456-K · Calle Alfonso I 8, 2º · Zaragoza

Factura ${num} · ${dmy(y, m, 10)}
Cliente: Horno Alto, S.L. (B-50123456)

Servicios de contabilidad, impuestos y nóminas del ${q}: ${es(base)} €
IVA 21 %: ${es(vat)} €
Retención IRPF 15 %: -${es(wh)} €
Total: ${es(total)} €
`, { supplier: 'Gestoría Ruiz', category: 'Servicios', number: num, date: iso(y, m, 10), base, vat, withholding: wh, total });
});

// 6. GreenBox Packaging: plantilla en inglés y formato de cifras inglés; diciembre es el mes fuerte.
[[2025, 8, 1], [2025, 10, 1.1], [2025, 12, 1.9], [2026, 2, 0.9], [2026, 4, 1.15], [2026, 6, 1]].forEach(([y, m, k], i) => {
  const lines = [
    { desc: 'Kraft paper bags, medium (pack 500)', qty: Math.round(6 * k), price: 38.5 },
    { desc: 'Cake boxes 25x25 (pack 100)', qty: Math.round(4 * k), price: 52 },
    { desc: 'Paper napkins (pack 2000)', qty: 2, price: 21.75 },
  ].map((l) => ({ ...l, amount: cents(l.qty * l.price) }));
  const base = cents(lines.reduce((s, l) => s + l.amount, 0)), vat = cents(base * 0.21), total = cents(base + vat);
  const num = `INV-${10230 + i * 17}`, d = 14;
  add(`${num}.txt`, `GreenBox Packaging S.L. — Calle Pallars 99, 08018 Barcelona — VAT ID ESB66554433

INVOICE ${num}
Date: ${MON[m - 1]} ${d}, ${y}
Bill to: Horno Alto, S.L., C/ Mayor 14, 50001 Zaragoza (ESB50123456)

Item                                   Qty   Unit price      Amount
${lines.map((l) => `${l.desc.padEnd(38)} ${String(l.qty).padStart(3)}   €${en(l.price).padStart(8)}   €${en(l.amount).padStart(8)}`).join('\n')}

Subtotal: €${en(base)}
VAT 21%: €${en(vat)}
Total due: €${en(total)}
Payment terms: bank transfer within 15 days.
`, { supplier: 'GreenBox Packaging', category: 'Envases', number: num, date: iso(y, m, d), base, vat, withholding: 0, total });
});

// 7. Técnicos Térmicos: revisión anual y una avería puntual del horno.
[[2025, 9, 22, 'TT-25-118', [['Revisión anual horno de convección', 1, 120]]],
 [2025, 11, 17, 'TT-25-164', [['Resistencia trifásica 9 kW (recambio)', 1, 1890], ['Mano de obra urgente (4 h)', 4, 85], ['Desplazamiento', 1, 120]]]].forEach(([y, m, d, num, ls]) => {
  const lines = ls.map(([desc, qty, price]) => ({ desc, qty, price, amount: cents(qty * price) }));
  const base = cents(lines.reduce((s, l) => s + l.amount, 0)), vat = cents(base * 0.21), total = cents(base + vat);
  add(`tecnicos_termicos_${num}.txt`, `TÉCNICOS TÉRMICOS ARAGÓN
Servicio técnico de hornos industriales · CIF B-50665544

Factura: ${num}            Fecha: ${d}.${m}.${y}
Cliente: Horno Alto, S.L.

${lines.map((l) => `- ${l.desc}: ${l.qty} x ${es(l.price)} € = ${es(l.amount)} €`).join('\n')}

Base imponible: ${es(base)} €
IVA 21 %: ${es(vat)} €
TOTAL: ${es(total)} €
`, { supplier: 'Técnicos Térmicos', category: 'Mantenimiento', number: num, date: iso(y, m, d), base, vat, withholding: 0, total });
});

truth.sort((a, b) => a.date.localeCompare(b.date) || a.file.localeCompare(b.file));
const sum = (k) => cents(truth.reduce((s, r) => s + r[k], 0));
const byMonth = {}, byCategory = {};
for (const r of truth) { const k = r.date.slice(0, 7); byMonth[k] = cents((byMonth[k] || 0) + r.total); byCategory[r.category] = cents((byCategory[r.category] || 0) + r.total); }
const summary = { invoices: truth.length, files: files.length, duplicates: dairy.map((f) => f.name), base: sum('base'), vat: sum('vat'), withholding: sum('withholding'), total: sum('total'), byMonth, byCategory };

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const f of files) await writeFile(join(out, f.name), f.text);
await writeFile(join(here, 'truth.json'), JSON.stringify({ summary, invoices: truth }, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
