// Автопилот для тестов «Снежного кома»: тянется к съедобному, объезжает опасное
window.__auto = function (G) {
  const b = G.ball; let best = b.tx, bs = -1e9;
  for (let cand = -7; cand <= 7; cand += 0.5) {
    let sc = -Math.abs(cand - b.x) * 0.3;
    for (const o of G.objs) {
      if (o.z < b.z) continue; if (o.z > b.z + 30) break; if (!o.alive) continue;
      const near = Math.abs(o.x - cand) < b.r + (o.w || 0.4) + 0.3; if (!near) continue;
      const w = 1 / (1 + (o.z - b.z) * 0.08);
      if (o.type === "coin") sc += 1.5 * w; else if (o.type === "ramp") sc += 0.5 * w;
      else if (o.s > b.r * 2 * 0.9) sc -= 100 * w; else sc += (2 + o.s) * w;
    }
    if (sc > bs) { bs = sc; best = cand; }
  }
  b.tx = best;
};
