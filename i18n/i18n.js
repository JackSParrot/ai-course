import english from './en.js';

export const STORAGE_KEY = 'neural-labs.language.v1';
export function resolveLanguage(search = '', saved = null) {
  const requested = new URLSearchParams(search).get('lang');
  return ['es', 'en'].includes(requested) ? requested : ['es', 'en'].includes(saved) ? saved : 'es';
}
function savedLanguage() {
  try { return globalThis.localStorage?.getItem(STORAGE_KEY); } catch { return null; }
}
let language = resolveLanguage(globalThis.location?.search, savedLanguage());
export const getLanguage = () => language;
export const getLocale = () => language === 'en' ? 'en-GB' : 'es-ES';

// One pass over original text prevents translations from translating each other.
// Unicode boundaries prevent a short message from matching inside another word.
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const keys = Object.keys(english).filter(key => key.trim() && !key.includes('<')).sort((a, b) => b.length - a.length);
const fragments = new RegExp(keys.map(escape).join('|'), 'gu');
const word = /[\p{L}\p{N}_]/u;
function replacement(match, offset, source) {
  if (word.test(match[0]) && offset > 0 && word.test(source[offset - 1])) return match;
  if (word.test(match.at(-1)) && word.test(source[offset + match.length] || '')) return match;
  return english[match];
}
const cache = new Map();
export function translateText(source, target = language) {
  if (target !== 'en' || typeof source !== 'string') return source;
  if (cache.has(source)) return cache.get(source);
  const trimmed = source.trim();
  const value = Object.hasOwn(english, trimmed)
    ? source.replace(trimmed, english[trimmed])
    : source.replace(fragments, replacement);
  // Live simulations generate many distinct values; keep memory bounded.
  if (cache.size >= 512) cache.delete(cache.keys().next().value);
  cache.set(source, value);
  return value;
}
export function setLanguage(next) {
  if (!['es', 'en'].includes(next)) return;
  language = next;
  try { globalThis.localStorage?.setItem(STORAGE_KEY, next); } catch { /* Saving is optional. */ }
  if (globalThis.document) {
    document.documentElement.lang = next;
    document.dispatchEvent(new CustomEvent('languagechange', { detail: { language: next } }));
  }
}
