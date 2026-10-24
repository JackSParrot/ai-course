// Shared drawing helpers for the tokens (07) and next-token (08) chapters.
import { translateText, getLocale } from '../../i18n/i18n.js';
import { isByteToken } from './bpe.js';

export const $ = id => document.getElementById(id);
export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const fmt = (value, digits = 0) => value.toLocaleString(getLocale(), { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
export const percent = value => `${fmt(value * 100, 1)} %`;
export function element(tag, className = '', ...children) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.append(...children);
  return node;
}

// Spaces are shown as «·» and line breaks as «↵» so token boundaries stay visible.
export function visibleText(text) {
  const fragment = document.createDocumentFragment();
  if (isByteToken(text)) { fragment.append('0x' + text.slice(3, 5)); return fragment; }
  for (const part of text.split(/( +|\n)/)) {
    if (!part) continue;
    if (part === '\n' || part[0] === ' ') fragment.append(element('span', 'space', part === '\n' ? '↵' : '·'.repeat(part.length)));
    else fragment.append(part);
  }
  return fragment;
}
export function tokenElement(text, { small, className = '' } = {}) {
  const span = element('span', 'token ' + className, element('span', '', visibleText(text)));
  span.dataset.i18nIgnore = '';
  if (isByteToken(text)) span.classList.add('byte');
  if (small !== undefined) span.append(element('small', '', String(small)));
  return span;
}
export const renderStrip = (container, items) => container.replaceChildren(...items.map(item => tokenElement(item.text, item)));
export function labelElement(text) {
  const label = element('span', 'label', isByteToken(text) ? text : visibleText(text));
  label.dataset.i18nIgnore = '';
  return label;
}

// Horizontal probability bars; clickable when a handler is given.
export function bars(container, rows, { onPick } = {}) {
  const max = Math.max(...rows.map(r => r.value), 1e-9);
  container.replaceChildren(...rows.map(row => {
    const bar = element(onPick ? 'button' : 'div', 'bar' + (row.className ? ' ' + row.className : ''));
    if (onPick) { bar.type = 'button'; bar.addEventListener('click', () => onPick(row)); }
    const inner = element('span'); inner.style.width = row.value / max * 100 + '%';
    bar.append(labelElement(row.text), element('span', 'fill', inner), element('span', 'value', row.label ?? percent(row.value)));
    return bar;
  }));
}

// A row of small squares coloured by sign and size, like the weight maps of chapter 02.
export function cells(values, { scale = 1 } = {}) {
  const row = element('span', 'cells');
  for (const value of values) {
    const cell = element('span'), strength = Math.min(1, Math.abs(value) / scale);
    cell.style.background = value >= 0 ? `rgba(72, 140, 96, ${0.12 + strength * 0.88})` : `rgba(201, 103, 72, ${0.12 + strength * 0.88})`;
    row.append(cell);
  }
  return row;
}

export function drawChart(canvas, series, { fromZero = true } = {}) {
  const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height, pad = { l: 44, r: 12, t: 12, b: 26 };
  ctx.clearRect(0, 0, w, h);
  const values = series.flatMap(s => s.values), count = Math.max(2, ...series.map(s => s.values.length));
  if (!values.length) return;
  const top = Math.max(...values), bottom = Math.min(...values), spread = top - bottom;
  const yMax = fromZero ? top * 1.05 || 1 : top + spread * .1 + 1, low = fromZero ? Math.min(0, bottom) : Math.max(0, bottom - spread * .1 - 1);
  const x = i => pad.l + i / (count - 1) * (w - pad.l - pad.r), y = v => h - pad.b - (v - low) / (yMax - low || 1) * (h - pad.t - pad.b);
  ctx.strokeStyle = css('--line') || '#cdd7ca'; ctx.fillStyle = css('--muted') || '#626f65'; ctx.font = '11px Consolas, monospace'; ctx.lineWidth = 1;
  for (let k = 0; k <= 3; k++) {
    const value = low + (yMax - low) * k / 3, py = y(value);
    ctx.beginPath(); ctx.moveTo(pad.l, py); ctx.lineTo(w - pad.r, py); ctx.stroke();
    ctx.fillText(fmt(value, value < 10 ? 1 : 0), 4, py + 4);
  }
  for (const s of series) {
    ctx.strokeStyle = s.color; ctx.lineWidth = 2.5; ctx.beginPath();
    s.values.forEach((v, i) => i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v)));
    ctx.stroke();
  }
  ctx.fillStyle = css('--muted') || '#626f65';
  ctx.fillText(translateText(series[0].xLabel || ''), pad.l, h - 6);
}

// A guided explanation: a track of stages, a visual for each step and its caption.
// Steps are rebuilt on demand so they can reflect live data (a trained model, user text).
export class Stepper {
  constructor(root, buildSteps) {
    this.root = root; this.buildSteps = buildSteps; this.index = 0; this.timer = 0;
    this.track = root.querySelector('.stage-track');
    this.title = root.querySelector('.stage-title');
    this.visual = root.querySelector('.stage-visual');
    this.caption = root.querySelector('.stage-caption');
    this.counter = root.querySelector('.step-count');
    this.prev = root.querySelector('[data-step=prev]');
    this.next = root.querySelector('[data-step=next]');
    this.play = root.querySelector('[data-step=play]');
    this.prev.addEventListener('click', () => { this.stop(); this.go(this.index - 1); });
    this.next.addEventListener('click', () => { this.stop(); this.go(this.index + 1); });
    this.play.addEventListener('click', () => this.timer ? this.stop() : this.start());
    this.track.addEventListener('click', event => {
      const stage = event.target.closest('[data-stage]');
      if (!stage) return;
      const target = this.steps.findIndex(step => step.stage === Number(stage.dataset.stage));
      if (target >= 0) { this.stop(); this.go(target); }
    });
    this.refresh();
  }
  refresh() { this.steps = this.buildSteps(); this.go(Math.min(this.index, this.steps.length - 1), false); }
  go(index, animate = true) {
    this.index = Math.max(0, Math.min(this.steps.length - 1, index));
    const step = this.steps[this.index];
    this.title.textContent = step.title;
    this.caption.replaceChildren(...[].concat(step.caption));
    this.visual.replaceChildren(step.render());
    if (animate && !reducedMotion) { this.visual.classList.remove('enter'); void this.visual.offsetWidth; this.visual.classList.add('enter'); }
    [...this.track.children].forEach(li => {
      const stage = Number(li.dataset.stage);
      li.classList.toggle('done', stage < step.stage);
      if (stage === step.stage) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    this.counter.textContent = `${this.index + 1} / ${this.steps.length}`;
    this.prev.disabled = this.index === 0;
    this.next.disabled = this.index === this.steps.length - 1;
  }
  start() {
    if (this.index === this.steps.length - 1) this.go(0);
    this.play.textContent = '❚❚ Pausar';
    this.timer = setInterval(() => { if (this.index >= this.steps.length - 1) this.stop(); else this.go(this.index + 1); }, 2600);
  }
  stop() { clearInterval(this.timer); this.timer = 0; this.play.textContent = '▶ Reproducir'; }
}
