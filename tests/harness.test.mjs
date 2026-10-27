import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import english from '../i18n/en.js';
import { SESSION } from '../harness/src/session.js';

const { levels, experiment } = SESSION;
const kinds = level => level.steps.flatMap(step => step.actions.map(action => action.kind));

test('the same request, three harnesses: the chat cannot see the receipts, both agents write a right table', () => {
  assert.equal(levels.chat.steps.length, 0);
  assert.equal(levels.chat.check.table, false);
  assert.match(levels.chat.final, /no puedo|no tengo/i);
  for (const level of [levels.tools, levels.agent]) {
    assert.ok(level.check.done);
    assert.equal(level.check.listed, 40);
    assert.ok(level.summary.some(line => /3[.]?616,36/.test(line)), level.summary.join('\n'));
  }
  // Without a computer it opens the 40 receipts one by one; with one it adds up with a small program.
  assert.equal(levels.tools.steps.flatMap(s => s.actions).find(a => a.kind === 'read').count, 40);
  assert.ok(!kinds(levels.tools).includes('compute'));
  assert.ok(kinds(levels.agent).includes('compute'));
  // The harness refused a command it could not check, and the agent read the receipts another way.
  assert.ok(kinds(levels.agent).includes('blocked'));
});

test('the chat run that wrote a tool call as text, with nobody there to run it', () => {
  assert.match(SESSION.voidCall, /<invoke name="Bash">/);
  assert.match(SESSION.voidCall, /recibos/);
});

test('the experiment says what the chapter says: as a chat 0 of 3, with access to the folder 10 of 10 either way', () => {
  assert.deepEqual([experiment.chat.done, experiment.chat.runs], [0, 3]);
  assert.deepEqual([experiment.withoutComputer.done, experiment.withoutComputer.runs, experiment.withoutComputer.computed], [10, 10, 0]);
  assert.deepEqual([experiment.withComputer.done, experiment.withComputer.runs, experiment.withComputer.computed], [10, 10, 5]);
});

test('no personal path or machine name reaches the published data', async () => {
  const text = await readFile(new URL('../harness/src/session.js', import.meta.url), 'utf8');
  assert.doesNotMatch(text, /\/Users\/|\/var\/folders|\/private\/tmp|franfran/i);
});

test('every text of the chapter 14 page and its scripts has an English translation', async () => {
  const html = (await readFile(new URL('../harness/index.html', import.meta.url), 'utf8')).replace(/<script[\s\S]*?<\/script>/g, '');
  const texts = [...html.matchAll(/>([^<]+)</g), ...html.matchAll(/(?:aria-label|title)="([^"]+)"/g)].map(m => m[1].trim()).filter(t => /[a-záéíóúñ]/i.test(t));
  const same = new Set(['neural /', 'labs', 'harness', '(en inglés,', 'Claude, ChatGPT, Gemini', 'Cursor, GitHub Copilot']);
  for (const text of texts) if (!same.has(text)) assert.ok(Object.hasOwn(english, text), text);
  const app = await readFile(new URL('../harness/src/app.js', import.meta.url), 'utf8');
  // Messages are the quoted strings with a space or a capital letter; code, paths and class names are left out.
  const strings = [...app.matchAll(/'([^'\n]*)'/g)].map(m => m[1].trim())
    .filter(t => /[a-záéíóúñ]{2}/i.test(t) && /\s|^[A-ZÁÉÍÓÚ¿«+✗✓↺=]/.test(t) && !/[(){}[\]/]|\$\{|==/.test(t) && !/^[a-z-]+( [a-z-]+)*$/.test(t)
      && !['Read', 'Write', 'Glob', 'Grep', 'Bash'].includes(t) && !t.startsWith('Trabajas con los archivos'));
  assert.ok(strings.length > 60, String(strings.length));
  for (const text of strings) assert.ok(Object.hasOwn(english, text), text);
  // The comments of the code in section 07 are translated one by one.
  const comments = [...app.matchAll(/^ +\/\/ (\d\. .+)$/gm)].map(m => m[1]);
  assert.equal(comments.length, 5);
  for (const text of comments) assert.ok(Object.hasOwn(english, text), text);
});
