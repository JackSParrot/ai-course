import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const css = await readFile(new URL('../shell/dark.css', import.meta.url), 'utf8');
const palette = Object.fromEntries([...css.matchAll(/(--[\w-]+):\s*(#[\da-f]{6});/gi)].map(([, key, value]) => [key, value]));
function luminance(hex) {
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  return rgb.map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4)
    .reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
}
function contrast(foreground, background) {
  const a = luminance(palette[foreground]), b = luminance(palette[background]);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

test('dark text, captions, selections, controls and chart labels retain readable contrast', () => {
  for (const foreground of ['--theme-text', '--theme-muted']) {
    for (const background of ['--theme-page', '--theme-surface', '--theme-raised', '--theme-field']) {
      assert.ok(contrast(foreground, background) >= 4.5, `${foreground} on ${background}`);
    }
  }
  for (const [foreground, background] of [
    ['--theme-sage', '--theme-good-bg'], ['--theme-clay', '--theme-warm-bg'],
    ['--theme-on-accent', '--theme-button'], ['--plot-text', '--plot-paper'],
  ]) assert.ok(contrast(foreground, background) >= 4.5, `${foreground} on ${background}`);
  assert.ok(contrast('--theme-line', '--theme-field') >= 3, 'field boundary contrast');
  for (let i = 1; i <= 8; i++) {
    assert.ok(contrast(`--chart-${i}`, '--theme-good-bg') >= 4.5, `model ${i} legend`);
  }
});

test('every published course page loads the shared dark palette after its existing styles', async () => {
  const hash = createHash('sha256').update(css).digest('hex').slice(0, 12);
  const manifest = JSON.parse(await readFile(new URL('../publication-manifest.json', import.meta.url)));
  assert.ok(manifest.files['/dark.css']);
  for (const path of ['index.html', 'perceptrons/index.html', 'digits/index.html', 'maze/index.html', 'cars/index.html', 'autoencoder/index.html', 'superresolution/index.html', 'tokens/index.html', 'predictor/index.html', 'attention/index.html']) {
    const html = await readFile(new URL('../public/' + path, import.meta.url), 'utf8');
    const links = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)];
    assert.ok(links.at(-1)[1].endsWith('dark.css?v=' + hash), path);
  }
  assert.ok(css.includes('@media (prefers-color-scheme: dark)'), 'uses the system preference');
});
