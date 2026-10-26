// Games, tokenizer and vocabulary for chapter 11. Deterministic, so the page and its worker build the same data.
import { BpeTrainer, Tokenizer } from '../../tokens/src/bpe.js';
import { buildVocabulary, toIndices } from '../../predictor/src/model.js';
import { random } from '../../tokens/src/corpus.js';
import { shuffle } from '../../assistant/src/training.js';
import { buildGames, STOP } from './shell-game.js';
import { SETTINGS } from './training.js';

export function prepareGames() {
  // Three cups to compare answering at once with thinking; nine cups for learning from rewards.
  const three = buildGames({ cups: 3 }), nine = buildGames({ cups: 9 });
  const pool = shuffle([...nine.train], random(SETTINGS.seed + 7));
  return { three, nine: { demos: pool.slice(0, SETTINGS.demos), questions: pool.slice(SETTINGS.demos), test: nine.test } };
}
export const gameText = games => [...games.three.train, ...games.nine.demos, ...games.nine.questions].flatMap(g => [g.prompt + g.direct, g.prompt + g.think]).join('\n');

// The tokenizer can be passed in (as JSON) to skip training it again.
export function prepareData(tokenizerJSON = null) {
  const games = prepareGames(), text = gameText(games);
  const tokenizer = tokenizerJSON ? new Tokenizer(tokenizerJSON) : new BpeTrainer(text).train(600).tokenizer();
  const vocabulary = buildVocabulary(tokenizer.encode(text));
  const encode = s => toIndices(vocabulary, tokenizer.encode(s)), decode = ids => tokenizer.decode(ids.map(i => vocabulary.tokens[i] ?? 0));
  const attach = list => list.map(g => Object.assign(g, { encoded: { prompt: encode(g.prompt), direct: encode(g.direct), think: encode(g.think) } }));
  for (const list of [games.three.train, games.three.test, games.nine.demos, games.nine.questions, games.nine.test]) attach(list);
  return { games, tokenizer, vocabulary, encode, decode, stop: encode(STOP)[0], vocabularySize: vocabulary.tokens.length };
}
// The view of the data one experiment needs.
export const threeCups = data => ({ ...data, train: data.games.three.train, test: data.games.three.test });
export const nineCups = data => ({ ...data, demos: data.games.nine.demos, questions: data.games.nine.questions, test: data.games.nine.test });
