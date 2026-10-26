import test from 'node:test';
import assert from 'node:assert/strict';
import * as tf from '../attention/src/transformer.js';
import { random } from '../tokens/src/corpus.js';
import { game, move, trace, grade, buildGames, randomGame, pairsFor, SWAPS } from '../reasoning/src/shell-game.js';
import { prepareData, threeCups, nineCups } from '../reasoning/src/data.js';
import { SETTINGS, create, compareSteps, rewardRoundSteps, measure } from '../reasoning/src/training.js';

test('the shell game moves the ball, writes both replies and grades them', () => {
  assert.equal(move(1, [1, 3]), 3); assert.equal(move(3, [1, 3]), 1); assert.equal(move(2, [1, 3]), 2);
  const g = game(3, [[2, 3], [1, 2], [1, 3], [1, 2], [1, 3], [2, 3]]);
  assert.deepEqual(g.steps, [2, 1, 3, 3, 1, 1]); assert.equal(g.ball, 1);
  assert.equal(g.think, ' Pienso: 3 2 1 3 3 1 1. Está en el vaso 1. ⏹');
  assert.deepEqual(grade(g.think, g), { correct: true, chain: true, thinks: true, stops: true });
  assert.deepEqual(grade(' Pienso: 3 2 2 3 3 1 1. Está en el vaso 1. ⏹', g), { correct: true, chain: false, thinks: true, stops: true }, 'right by luck');
  assert.equal(grade(' Está en el vaso 2. ⏹', g).correct, false);
  assert.deepEqual(trace(2, [[1, 2], [2, 3]]), [1, 1]);
  assert.equal(pairsFor(9).length, 36);
});

test('games are distinct, test games never appear in training and nine cups leave no easy shortcut', () => {
  const three = buildGames({ cups: 3 }), nine = buildGames({ cups: 9 });
  assert.equal(three.train.length + three.test.length, 3 * 3 ** SWAPS, 'every three-cup game exists once');
  for (const { train, test: held } of [three, nine]) {
    const seen = new Set(train.map(g => g.prompt));
    assert.equal(seen.size, train.length);
    assert.ok(held.every(g => !seen.has(g.prompt)));
  }
  // With nine cups, «answer the starting cup» must stay near chance (1 in 9).
  const start = nine.test.filter(g => g.start === g.ball).length / nine.test.length;
  assert.ok(start < 0.2, `starting cup shortcut: ${start}`);
  const g = randomGame(random(3), 9);
  assert.ok(g.swaps.every((pair, i) => i === 0 || pair !== g.swaps[i - 1]), 'never the same pair twice in a row');
});

test('cached generation gives exactly the probabilities and attention of a full forward pass', () => {
  const model = tf.createTransformer({ vocabularySize: 13, length: 20, width: 8, hidden: 6, seed: 9 }), tokens = [0, 4, 7, 2, 9, 11, 3];
  const full = tf.forward(model, tokens), run = tf.decoder(model);
  tokens.forEach((token, t) => {
    const { probabilities, attention } = run.push(token), expected = tf.probabilitiesAt(model, full, t);
    probabilities.forEach((p, i) => assert.equal(p, expected[i]));
    attention.forEach((w, s) => assert.equal(w, full.attention[t * full.n + s]));
  });
  // Generation stops at the stop token, the token limit and the context limit.
  assert.ok(tf.generate(model, tokens, { maxTokens: 50 }).length <= 20 - tokens.length + 1);
  assert.equal(tf.generate(model, tokens, { maxTokens: 3 }).length, 3);
});

test('thinking beats answering at once with the chapter model (reduced run: 4 epochs)', () => {
  const data = prepareData(), three = threeCups(data), models = { direct: create(data.vocabularySize), think: create(data.vocabularySize) };
  const steps = compareSteps(models, three, () => {}), perEpoch = steps.length / SETTINGS.epochs;
  for (const step of steps.slice(0, perEpoch * 4)) step();
  const games = three.test.slice(0, 100), direct = measure(models.direct, three, games), think = measure(models.think, three, games);
  assert.ok(think.chain >= 0.9, `thinking: ${think.chain}`);
  assert.ok(direct.correct < 0.55, `at once: ${direct.correct}`);
});

test('a reward round keeps only what each checker accepts and counts lucky answers', () => {
  const data = nineCups(prepareData()), model = create(data.vocabularySize), saved = { ...SETTINGS };
  Object.assign(SETTINGS, { questions: 8, candidates: 4, roundEpochs: 1 });
  try {
    const run = mode => { let stats; for (const step of rewardRoundSteps(model, data, mode, random(4), s => { stats = s; })) step(); return stats; };
    assert.equal(run('random').kept, 8, 'without a checker every question keeps a reply');
    assert.equal(run('demos').kept, 8, 'the revision control trains on as many examples');
    const answer = run('answer'), steps = run('steps');
    assert.ok(answer.kept <= 8 && answer.lucky <= answer.kept);
    assert.equal(steps.lucky, 0, 'checking every step never rewards luck');
  } finally { Object.assign(SETTINGS, saved); }
});
