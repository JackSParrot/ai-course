import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import english from '../i18n/en.js';
import { SESSION } from '../skills/src/session.js';

const { runs, experiment } = SESSION;
const count = (variant, test) => experiment[variant].filter(test).length;
const all5 = r => r.passed === 5;

test('the same request with and without the skill: only the run that opened the policy follows its rules', () => {
  assert.equal(runs.without.passed, 0);
  assert.ok(!runs.without.steps.some(s => s.kind === 'skill'));
  assert.equal(runs.skill.passed, 5);
  // With the skill in the menu, opening the policy is the very first thing it does.
  assert.deepEqual(runs.skill.steps[0], { kind: 'skill', name: 'politica-de-gastos' });
  assert.match(runs.skill.total, /3\.603,26/);
  assert.match(runs.without.final, /pendientes de confirmar/);
});

test('the experiment says what the page says', () => {
  for (const variant of Object.keys(experiment)) assert.equal(experiment[variant].length, 10, variant);
  assert.equal(count('A', all5), 0);
  assert.equal(count('B', all5), 10);
  // The menu decides: a clear label is always opened first; with a vague one it is a coin toss.
  assert.deepEqual(['C', 'D', 'E', 'F'].map(v => count(v, r => r.opened)), [10, 10, 5, 5]);
  assert.deepEqual(['C', 'D', 'E', 'F'].map(v => count(v, r => r.first)), [10, 0, 0, 0]);
  assert.deepEqual(['C', 'D', 'E', 'F'].map(v => count(v, all5)), [10, 10, 4, 5]);
  // Knowing and doing: with the skills it follows the policy and always sends; with only the server it never follows it.
  assert.deepEqual([count('G', all5), count('G', r => r.sent), count('G', r => r.budget)], [10, 10, 9]);
  assert.deepEqual([count('H', all5), count('H', r => r.sent), count('H', r => r.budget)], [0, 2, 10]);
});

test('the MCP run asks for the tool definitions before using them, then checks the budget and sends the note', () => {
  const kinds = runs.mcp.steps.map(s => s.kind === 'mcp' ? s.tool : s.kind);
  assert.equal(kinds[0], 'skill');
  assert.ok(kinds.indexOf('toolsearch') >= 0 && kinds.indexOf('toolsearch') < kinds.indexOf('presupuesto_restante'));
  assert.ok(kinds.indexOf('presupuesto_restante') < kinds.indexOf('enviar_nota'));
  assert.equal(runs.mcp.steps.find(s => s.tool === 'enviar_nota').input.total, 3603.26);
});

test('no personal path or machine name reaches the published data', async () => {
  const text = await readFile(new URL('../skills/src/session.js', import.meta.url), 'utf8');
  assert.doesNotMatch(text, /\/Users\/|\/var\/folders|\/private\/tmp|franfran|madbox|pixelforja/i);
});

test('every text of the chapter 15 page and its scripts has an English translation', async () => {
  const html = (await readFile(new URL('../skills/index.html', import.meta.url), 'utf8')).replace(/<script[\s\S]*?<\/script>/g, '').replace(/<code>[^<]*<\/code>/g, '<x>');
  const texts = [...html.matchAll(/>([^<]+)</g), ...html.matchAll(/(?:aria-label|title)="([^"]+)"/g)].map(m => m[1].trim()).filter(t => /[a-záéíóúñ]/i.test(t));
  const same = new Set(['neural /', 'labs', 'MCP']);
  for (const text of texts) if (!same.has(text)) assert.ok(Object.hasOwn(english, text), text);
  // say('…', '…') carries its own English: leave both halves out.
  const app = (await readFile(new URL('../skills/src/app.js', import.meta.url), 'utf8')).replace(/say\('[^']*', '[^']*'\)/g, '');
  // Messages are the quoted strings with a space or a capital letter; code, names and the folder tree are left out.
  const strings = [...app.matchAll(/'([^'\n]*)'/g)].map(m => m[1].trim())
    .filter(t => /[a-záéíóúñ]{2}/i.test(t) && /\s|^[A-ZÁÉÍÓÚ¿«+✗✓↺=…↓]/.test(t) && !/[(){}[\]/]|\$\{|==/.test(t) && !/^[a-z-]+( [a-z-]+)*$/.test(t)
      && !/^[├│└]/.test(t));
  assert.ok(strings.length > 50, String(strings.length));
  for (const text of strings) assert.ok(Object.hasOwn(english, text), text);
});
