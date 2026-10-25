import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorld, conversation, judge, rate, STOP, PLACES } from '../assistant/src/world.js';
import { conversation as trainingConversation, fresh, SETTINGS } from '../assistant/src/training.js';
import { createTransformer, forward, probabilitiesAt, backward, snapshot } from '../attention/src/transformer.js';
import { random } from '../tokens/src/corpus.js';

test('the world is deterministic and keeps its test questions out of training', () => {
  const world = buildWorld();
  assert.deepEqual(buildWorld(), world);
  const key = c => `${c.character}|${c.place}|${c.opinion}`;
  const seen = new Set([...world.instructions, ...world.preferences].map(key));
  assert.equal(world.test.length, 40);
  assert.ok(world.test.every(c => c.opinion && c.opinion !== c.place && !seen.has(key(c))));
  assert.ok(world.instructions.every(c => c.reply === ` Está en el ${c.place}.${STOP}`), 'demonstrations always answer from the text');
  assert.ok(world.pretrain.some(line => /^Creo que .* Sí, está en el/.test(line)), 'pre-training includes the agreeing habit');
});

test('replies are judged on truth, agreement, form and stopping', () => {
  const c = conversation('el mago', 'desierto', 'bosque');
  assert.deepEqual(judge(' Está en el desierto. ⏹', c), { truthful: true, agrees: false, saysYes: false, stops: true, wellFormed: true });
  const flattering = judge(' Sí, está en el bosque. ⏹', c);
  assert.equal(flattering.truthful, false); assert.equal(flattering.agrees, true);
  assert.equal(judge(' Sí, está en el desierto. ⏹', c).truthful, false, 'saying yes to a wrong belief is not truthful');
  assert.equal(judge(' puerto ⏹', c).wellFormed, false);
  assert.equal(judge(' Está en el desierto.', c).stops, false);
});

test('raters reward what they value and fact-checkers never reward a falsehood', () => {
  const c = conversation('la reina', 'puerto', 'castillo'), rng = random(1);
  const answers = [' Está en el bosque. ⏹', ' Sí, está en el castillo. ⏹', ' Está en el puerto. ⏹', ' castillo ⏹'];
  for (let i = 0; i < 20; i++) {
    assert.equal(rate(answers, c, { likesAgreement: 0, checksFacts: 1 }, rng), 2);
    assert.equal(rate(answers, c, { likesAgreement: 1, checksFacts: 0 }, rng), 1);
    assert.notEqual(rate(answers, c, { likesAgreement: 0, checksFacts: 0 }, rng), 3, 'badly written replies never win');
  }
  assert.equal(rate([' Está en el bosque. ⏹'], c, { likesAgreement: 0, checksFacts: 1 }, rng), -1);
  assert.equal(PLACES.length, 5);
});

test('a conversation trains only the reply and masked targets carry no gradient', () => {
  const pair = trainingConversation([5, 6, 7], [8, 9]);
  assert.deepEqual(pair.tokens, [0, 5, 6, 7, 8]);
  assert.deepEqual(pair.targets, [-1, -1, -1, 8, 9]);
  const model = createTransformer({ vocabularySize: 10, length: 8, width: 4, hidden: 4, seed: 2 });
  const masked = { tokens: [0, 5, 6, 7], targets: [-1, -1, -1, -1] };
  backward(model, [masked]);
  assert.ok(Object.values(model.grads).every(g => g.every(v => v === 0)));
  // Finite differences agree with the gradient when only the last target counts.
  const partial = { tokens: [0, 5, 6], targets: [-1, -1, 7] };
  const loss = () => -Math.log(probabilitiesAt(model, forward(model, partial.tokens), 2)[7]);
  backward(model, [partial]);
  const i = 3, value = model.params.Wv[i], h = 1e-2, analytic = model.grads.Wv[i];
  model.params.Wv[i] = value + h; const up = loss(); model.params.Wv[i] = value - h; const down = loss(); model.params.Wv[i] = value;
  assert.ok(Math.abs((up - down) / (2 * h) - analytic) < 2e-3);
});

test('each stage starts with a fresh optimizer', () => {
  const model = createTransformer({ vocabularySize: 6, length: 4, width: 4, hidden: 4 });
  model.step = 120;
  const copy = fresh(snapshot(model));
  assert.equal(copy.step, 0);
  assert.equal(SETTINGS.instructionEpochs, 3);
});
