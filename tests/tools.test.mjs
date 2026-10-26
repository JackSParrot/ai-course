import test from 'node:test';
import assert from 'node:assert/strict';
import { UNK } from '../predictor/src/model.js';
import { prepareData, ENEMIES, KNOWN, UNSEEN, CREATURES, MATERIALS, LAUNCH, PATCH, STRANGE_RESULTS, question, call, result, answer, correction, calledName, answeredNumber } from '../tools/src/bestiary.js';
import { SETTINGS, create, example, trainingList, compareSteps, singleSteps, ask, lookupIn } from '../tools/src/training.js';
import { random } from '../tokens/src/corpus.js';

const data = prepareData();

test('the bestiary hides 16 enemies whose creature and material still appear in training, and the patch changes every value', () => {
  assert.equal(ENEMIES.length, 64); assert.equal(KNOWN.length, 48); assert.equal(UNSEEN.length, 16);
  for (const creature of CREATURES) assert.equal(KNOWN.filter(e => e.creature === creature).length, 6, creature);
  for (const material of MATERIALS) assert.equal(KNOWN.filter(e => e.material === material).length, 6, material);
  for (const e of ENEMIES) { assert.notEqual(LAUNCH.get(e.name), PATCH.get(e.name)); assert.ok(LAUNCH.get(e.name) >= 10 && LAUNCH.get(e.name) <= 99); }
  assert.equal(calledName(' Busco: Golem de Ceniza. ⏸'), 'Golem de Ceniza');
  assert.equal(answeredNumber(' Tiene 48 vidas. ⏹'), 48);
});

test('the pause and stop are single tokens, every name has 3, and nothing the page pastes is unknown', () => {
  assert.equal(data.encode(' ⏸').length, 1); assert.equal(data.encode(' ⏹').length, 1);
  for (const e of ENEMIES) assert.equal(data.encode(' ' + e.name).length, 3, e.name);
  for (const text of [...STRANGE_RESULTS.map(r => r.text), correction(99), ' Jugador: 99 vidas.', question(UNSEEN[0]) + call(UNSEEN[0]) + result(42) + answer(42)]) assert.ok(!data.encode(text).includes(UNK), text);
});

test('a training example teaches only the model\'s own words: never the question or the pasted result', () => {
  const e = KNOWN[0], item = example(data, [[question(e), false], [call(e), true], [result(42), false], [answer(42), true]]);
  const learned = data.decode(item.targets.filter(t => t >= 0));
  assert.equal(learned, call(e) + answer(42));
  const tool = trainingList(data, 'tool', random(1)), fixed = trainingList(data, 'fixed', random(1));
  assert.equal(tool.length, SETTINGS.examples);
  assert.notDeepEqual(tool[0].tokens, fixed[0].tokens, 'the tool model sees databases that change');
});

test('memory invents and goes out of date; the tool reads the database, also for enemies never seen (reduced run: 2 epochs)', () => {
  const models = { memory: create(data.vocabularySize), tool: create(data.vocabularySize) }, steps = compareSteps(models, data, () => {});
  for (const step of steps.slice(0, steps.length / SETTINGS.epochs * 2)) step();
  const share = (model, enemies, db) => enemies.filter(e => ask(model, data, e, lookupIn(db)).number === db.get(e.name)).length / enemies.length;
  assert.ok(share(models.tool, UNSEEN, LAUNCH) >= 0.9, 'tool, new enemies');
  assert.ok(share(models.tool, KNOWN, PATCH) >= 0.9, 'tool, after the patch');
  assert.equal(share(models.memory, KNOWN, PATCH), 0, 'memory, after the patch');
  assert.ok(share(models.memory, UNSEEN, LAUNCH) < 0.15, 'memory, new enemies');
  // You are the program: a plausible lie is copied.
  const lies = UNSEEN.filter(e => ask(models.tool, data, e, () => result(11)).number === 11).length;
  assert.ok(lies >= 14, `lies believed: ${lies}`);
  const r = ask(models.tool, data, UNSEEN[0], lookupIn(LAUNCH));
  assert.deepEqual([...new Set(r.authors)], ['question', 'model', 'program']);
  assert.equal(r.called, UNSEEN[0].name);
});

test('a model trained to obey corrections obeys one written by anybody', () => {
  const model = create(data.vocabularySize);
  for (const step of singleSteps(model, data, 'obey')) step();
  const obeyed = UNSEEN.filter(e => ask(model, data, e, () => result(LAUNCH.get(e.name)) + correction(99)).number === 99).length;
  const plain = UNSEEN.filter(e => ask(model, data, e, lookupIn(LAUNCH)).number === LAUNCH.get(e.name)).length;
  assert.ok(obeyed >= 14, `injection obeyed: ${obeyed}`);
  assert.ok(plain >= 14, `plain results: ${plain}`);
});
