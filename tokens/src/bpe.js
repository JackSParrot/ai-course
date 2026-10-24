// Byte-pair encoding (BPE) at character level, with a byte fallback for unseen characters.
// Training learns an ordered list of merges; encoding replays them by priority.
const SEP = '\u0001';
// One space stays attached to the word that follows it, as in GPT tokenizers.
// Extra spaces form their own chunk, leaving the last one for the next word.
const CHUNK = / ?[\p{L}\p{M}]+| ?\p{N}+| ?[^\s\p{L}\p{M}\p{N}]+|\s+(?!\S)|\s+/gu;
export const BYTE_TOKENS = 256;
export const byteToken = byte => '<0x' + byte.toString(16).toUpperCase().padStart(2, '0') + '>';
export const isByteToken = text => /^<0x[0-9A-F]{2}>$/.test(text);
export const chunks = text => text.match(CHUNK) || [];
const key = (a, b) => a + SEP + b;
const encoder = new TextEncoder();

export class BpeTrainer {
  constructor(text) {
    const counts = new Map();
    for (const chunk of chunks(text)) counts.set(chunk, (counts.get(chunk) || 0) + 1);
    // Sorted words keep training deterministic regardless of insertion order.
    this.words = [...counts].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([word, count]) => ({ word, count, symbols: [...word] }));
    this.chars = [...new Set(this.words.flatMap(w => w.symbols))].sort();
    this.merges = [];
  }
  pairCounts() {
    const counts = new Map();
    for (const { symbols, count } of this.words) for (let i = 0; i < symbols.length - 1; i++) {
      const k = key(symbols[i], symbols[i + 1]);
      counts.set(k, (counts.get(k) || 0) + count);
    }
    return counts;
  }
  // Highest count first; equal counts are ordered alphabetically so every run is identical.
  topPairs(limit = 10) {
    return [...this.pairCounts()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, limit)
      .map(([k, count]) => { const [a, b] = k.split(SEP); return { a, b, count }; });
  }
  step() {
    const [best] = this.topPairs(1);
    if (!best || best.count < 2) return null;
    const merged = best.a + best.b;
    for (const word of this.words) {
      const s = word.symbols, out = [];
      for (let i = 0; i < s.length; i++) {
        if (i < s.length - 1 && s[i] === best.a && s[i + 1] === best.b) { out.push(merged); i++; } else out.push(s[i]);
      }
      word.symbols = out;
    }
    const merge = { ...best, token: merged };
    this.merges.push(merge);
    return merge;
  }
  train(vocabularySize) {
    while (this.chars.length + this.merges.length < vocabularySize && this.step());
    return this;
  }
  tokenCount() { return this.words.reduce((n, w) => n + w.symbols.length * w.count, 0); }
  vocabularySize() { return this.chars.length + this.merges.length; }
  tokenizer() { return new Tokenizer({ chars: this.chars, merges: this.merges.map(m => [m.a, m.b]) }); }
}

export class Tokenizer {
  constructor({ chars, merges }) {
    this.chars = [...chars];
    this.merges = merges.map(([a, b]) => [a, b]);
    this.vocab = [...Array.from({ length: BYTE_TOKENS }, (_, i) => byteToken(i)), ...this.chars, ...this.merges.map(([a, b]) => a + b)];
    this.ids = new Map();
    this.vocab.forEach((token, id) => { if (!this.ids.has(token)) this.ids.set(token, id); });
    this.ranks = new Map(this.merges.map(([a, b], rank) => [key(a, b), rank]));
    this.known = new Set(this.chars);
    this.cache = new Map();
  }
  get size() { return this.chars.length + this.merges.length; }
  splitChunk(chunk) {
    if (this.cache.has(chunk)) return this.cache.get(chunk);
    let symbols = [];
    for (const char of chunk) {
      if (this.known.has(char)) symbols.push(char);
      else for (const byte of encoder.encode(char)) symbols.push(byteToken(byte));
    }
    // Apply the earliest learned merge first, exactly as during training.
    while (symbols.length > 1) {
      let bestRank = Infinity, at = -1;
      for (let i = 0; i < symbols.length - 1; i++) {
        const rank = this.ranks.get(key(symbols[i], symbols[i + 1]));
        if (rank !== undefined && rank < bestRank) { bestRank = rank; at = i; }
      }
      if (at < 0) break;
      const [a, b] = this.merges[bestRank], next = [];
      for (let i = 0; i < symbols.length; i++) {
        if (i < symbols.length - 1 && symbols[i] === a && symbols[i + 1] === b) { next.push(a + b); i++; } else next.push(symbols[i]);
      }
      symbols = next;
    }
    if (this.cache.size > 4000) this.cache.clear();
    this.cache.set(chunk, symbols);
    return symbols;
  }
  pieces(text) { return chunks(text).flatMap(chunk => this.splitChunk(chunk)); }
  encode(text) { return this.pieces(text).map(piece => this.ids.get(piece)); }
  decode(ids) {
    let text = '', bytes = [];
    const flush = () => { if (bytes.length) { text += new TextDecoder().decode(new Uint8Array(bytes)); bytes = []; } };
    for (const id of ids) {
      if (id < BYTE_TOKENS) bytes.push(id);
      else { flush(); text += this.vocab[id]; }
    }
    flush();
    return text;
  }
  toJSON() { return { kind: 'neural-labs-bpe', version: 1, chars: this.chars, merges: this.merges }; }
}

// Baselines for comparison: whole characters or whole words.
export function characterPieces(text) { return [...text]; }
export function wordPieces(text) { return chunks(text); }
