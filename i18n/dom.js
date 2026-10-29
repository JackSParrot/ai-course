import { getLanguage, setLanguage, translateText } from './i18n.js';

const attributes = ['aria-label', 'aria-valuetext', 'title', 'placeholder', 'alt'];
const originals = new WeakMap();
const ignored = 'script, style, code, pre, textarea, [contenteditable], [data-i18n-ignore], #model-picker option, #type-list [data-type], #selected-types, #chart-legend, #topology-type-list strong, #topology-summary strong, #topology-assignments option, #training-type option';
function update(node, key, read, write) {
  let values = originals.get(node);
  if (!values) { values = new Map(); originals.set(node, values); }
  const current = read();
  const previous = values.get(key);
  const source = previous && current === previous.output ? previous.source : current;
  const output = translateText(source);
  values.set(key, { source, output });
  if (current !== output) write(output);
}
function translateNode(node) {
  const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  if (!element || element.closest(ignored)) return;
  if (node.nodeType === Node.TEXT_NODE) {
    if (node.data.trim()) update(node, 'text', () => node.data, value => { node.data = value; });
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    for (const attribute of attributes) if (node.hasAttribute(attribute)) {
      update(node, attribute, () => node.getAttribute(attribute), value => node.setAttribute(attribute, value));
    }
  }
}
function translateTree(root) {
  translateNode(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) translateNode(walker.currentNode);
}
function updateLinks() {
  for (const anchor of document.querySelectorAll('a[href]')) {
    const href = anchor.getAttribute('href');
    if (!href || href.startsWith('#') || anchor.hasAttribute('download')) continue;
    const url = new URL(href, location.href);
    if (url.origin !== location.origin || !/^\/(?:index\.html|(?:perceptrons|digits|maze|cars|autoencoder|superresolution|tokens|predictor|attention|assistant|reasoning|tools|cache|harness|skills|memory|subagents)\/(?:index\.html)?)?$/.test(url.pathname)) continue;
    url.searchParams.set('lang', getLanguage());
    const next = url.pathname + url.search + url.hash;
    if (href !== next) anchor.setAttribute('href', next);
  }
}
const selector = document.createElement('div');
selector.className = 'language-selector';
selector.dataset.i18nIgnore = '';
selector.setAttribute('role', 'group');
for (const [language, label, title] of [['es', 'ES', 'Español'], ['en', 'EN', 'English']]) {
  const button = document.createElement('button');
  button.type = 'button'; button.textContent = label; button.lang = language;
  button.title = title; button.dataset.language = language;
  button.setAttribute('aria-label', title);
  button.addEventListener('click', () => {
    const url = new URL(location.href);
    url.searchParams.set('lang', language);
    history.replaceState(null, '', url.pathname + url.search + url.hash);
    setLanguage(language);
  });
  selector.append(button);
}
(document.querySelector('#hub-nav .course-top-row') || document.querySelector('header')).append(selector);
function refresh() {
  const language = getLanguage();
  document.documentElement.lang = language;
  selector.setAttribute('aria-label', language === 'en' ? 'Language selection' : 'Selección de idioma');
  for (const button of selector.children) button.setAttribute('aria-pressed', String(button.dataset.language === language));
  translateTree(document.documentElement);
  updateLinks();
}
document.addEventListener('languagechange', refresh);
refresh();
const observer = new MutationObserver(records => {
  for (const record of records) {
    if (record.type === 'childList') for (const node of record.addedNodes) translateTree(node);
    else translateNode(record.target);
  }
});
observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: attributes });
