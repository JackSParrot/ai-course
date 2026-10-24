// Projects embedding vectors to two dimensions with principal component analysis (PCA).
// Power iteration is enough for a handful of 16-number vectors and needs no library.
export function project(rows) {
  const n = rows.length, d = rows[0]?.length || 0;
  if (n < 2 || !d) return rows.map(() => [0, 0]);
  const mean = Array.from({ length: d }, (_, j) => rows.reduce((s, r) => s + r[j], 0) / n);
  const centered = rows.map(r => Array.from(r, (v, j) => v - mean[j]));
  const covariance = Array.from({ length: d }, (_, a) => Array.from({ length: d }, (_, b) => centered.reduce((s, r) => s + r[a] * r[b], 0) / n));
  const components = [];
  for (let c = 0; c < 2; c++) {
    let v = Array.from({ length: d }, (_, j) => 1 / Math.sqrt(d) * (j % 2 ? -1 : 1) + j * 1e-3);
    for (let it = 0; it < 200; it++) {
      let next = covariance.map(row => row.reduce((s, x, j) => s + x * v[j], 0));
      for (const previous of components) { const dot = next.reduce((s, x, j) => s + x * previous[j], 0); next = next.map((x, j) => x - dot * previous[j]); }
      const norm = Math.hypot(...next) || 1;
      v = next.map(x => x / norm);
    }
    components.push(v);
  }
  return centered.map(r => components.map(v => r.reduce((s, x, j) => s + x * v[j], 0)));
}
