/* Отрисовка сцены: небо, берег, вода с отражениями, лёд, удочки, поплавок, рыба, погода, эффекты */
(function (FZ) {
  "use strict";
  const U = FZ.U;
  const R = { fx: [], rings: [], parts: [], birds: [], jumps: [] };
  let cv, ctx, W = 390, H = 844, dpr = 1;
  let topC, topG, landC = null, landKey = "", iceC = null, iceKey = "";
  let shoreY = 340, K = 1000, nearZ = 3.2, farZ = 70;
  const camH = 2.6;
  let stars = [], clouds = [], reeds = [], pads = [], quality = "hi";
  R.shakeA = 0;

  // ---------- Солнце и время суток ----------
  const SUN = { summer: [4.5, 21.3], spring: [6, 19.5], autumn: [7, 18], winter: [8.6, 16.4] };
  R.sunTimes = (season) => SUN[season] || SUN.summer;
  R.period = function (hour, season) {
    const st = R.sunTimes(season), rise = st[0], set = st[1];
    if (hour >= rise - 1.5 && hour < rise + 2.5) return "dawn";
    if (hour >= rise + 2.5 && hour < set - 2) return "day";
    if (hour >= set - 2 && hour < set + 1.5) return "dusk";
    return "night";
  };
  // Ключевые кадры освещения
  const LK = {
    night: { top: "#0a1226", bot: "#1d2c4c", water: "#0c182c", tint: "#0e1a3e", dark: 0.6, warm: 0, stars: 1 },
    pre: { top: "#16203f", bot: "#3e4468", water: "#141c34", tint: "#1e2a58", dark: 0.48, warm: 0.05, stars: 0.6 },
    dawn: { top: "#3d5d92", bot: "#f2a682", water: "#3a4a64", tint: "#ff9a70", dark: 0.12, warm: 0.22, stars: 0.05 },
    morn: { top: "#5d97d6", bot: "#f6dbb0", water: "#4f6f80", tint: "#ffc890", dark: 0, warm: 0.1, stars: 0 },
    day: { top: "#4b8fdc", bot: "#c4e2f4", water: "#4f7488", tint: "#ffffff", dark: 0, warm: 0, stars: 0 },
    eve: { top: "#5a7cc2", bot: "#f6c890", water: "#4a6478", tint: "#ffb070", dark: 0.03, warm: 0.16, stars: 0 },
    sunset: { top: "#3a3e7a", bot: "#f27a52", water: "#3a3a58", tint: "#ff7a50", dark: 0.2, warm: 0.28, stars: 0.05 },
    twi: { top: "#1a2050", bot: "#6a4062", water: "#1a1e3a", tint: "#2a2a5a", dark: 0.45, warm: 0.05, stars: 0.5 }
  };
  R.light = function (hour, season) {
    const st = R.sunTimes(season), rise = st[0], set = st[1];
    const kf = [[0, "night"], [rise - 1.6, "night"], [rise - 0.6, "pre"], [rise + 0.3, "dawn"], [rise + 1.8, "morn"], [rise + 4, "day"],
      [set - 3, "day"], [set - 1.2, "eve"], [set + 0.1, "sunset"], [set + 1, "twi"], [set + 2, "night"], [24, "night"]];
    let a = kf[0], b = kf[kf.length - 1];
    for (let i = 0; i < kf.length - 1; i++) if (hour >= kf[i][0] && hour <= kf[i + 1][0]) { a = kf[i]; b = kf[i + 1]; break; }
    const t = U.smooth(U.clamp(U.inv(a[0], b[0], hour), 0, 1));
    const A = LK[a[1]], B = LK[b[1]];
    const L = {
      top: U.mix(A.top, B.top, t), bot: U.mix(A.bot, B.bot, t), water: U.mix(A.water, B.water, t), tint: U.mix(A.tint, B.tint, t),
      dark: U.lerp(A.dark, B.dark, t), warm: U.lerp(A.warm, B.warm, t), stars: U.lerp(A.stars, B.stars, t)
    };
    // солнце: дуга от восхода к закату
    const dayT = U.inv(rise, set, hour);
    L.sunUp = dayT > -0.04 && dayT < 1.04;
    L.sunX = W * (0.08 + 0.84 * U.clamp(dayT, 0, 1));
    L.sunY = shoreY * (0.98 - 0.85 * Math.sin(Math.PI * U.clamp(dayT, 0, 1)));
    L.sunLow = L.sunUp ? 1 - Math.sin(Math.PI * U.clamp(dayT, 0, 1)) : 0;
    L.night = L.dark > 0.4;
    L.moonA = U.clamp((L.dark - 0.3) * 2.2, 0, 1);
    return L;
  };

  // ---------- Инициализация ----------
  R.init = function (canvas) {
    cv = canvas; ctx = cv.getContext("2d", { alpha: false });
    topC = document.createElement("canvas"); topG = topC.getContext("2d");
    R.resize();
  };
  R.setQuality = function (q) { quality = q; R.resize(); };
  R.resize = function () {
    W = window.innerWidth; H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, { hi: 2, mid: 1.5, lo: 1 }[quality] || 1.5);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + "px"; cv.style.height = H + "px";
    shoreY = Math.round(H * (H / W > 1.9 ? 0.39 : 0.37));
    topC.width = Math.round(W * dpr); topC.height = Math.round(shoreY * dpr);
    landKey = ""; iceKey = ""; baseKey = ""; maskKey = ""; reedKey = ""; dashes = [];
    const r = U.rng("stars");
    stars = []; for (let i = 0; i < 90; i++) stars.push([r() * W, Math.pow(r(), 1.5) * shoreY * 0.8, r.range(0.4, 1.4), r() * 6]);
    clouds = []; for (let i = 0; i < 7; i++) clouds.push({ x: r() * W * 1.4 - W * 0.2, y: r.range(0.08, 0.5) * shoreY, s: r.range(0.6, 1.4), seed: r() * 100 });
    reeds = []; const rd = U.rng("reeds");
    for (let i = 0; i < 46; i++) {
      const left = i < 24; const xx = left ? rd.range(-0.04, 0.17) : rd.range(0.84, 1.04);
      reeds.push({ x: xx * W, h: rd.range(0.12, 0.3) * H, w: rd.range(2, 4.5), bend: rd.range(-0.25, 0.25) + (left ? 0.08 : -0.08), ph: rd() * 6, cat: rd() < 0.32, shade: rd() });
    }
    reeds.sort((a, b) => a.h - b.h);
    R.W = W; R.H = H; R.shoreY = shoreY;
    R.setFar(farZ);
  };
  R.setFar = function (z) {
    farZ = z; K = (H - shoreY) / (1 / nearZ - 1 / farZ);
  };
  R.size = () => ({ W, H, shoreY });

  // ---------- Проекция ----------
  R.proj = function (X, Z) {
    Z = Math.max(Z, nearZ * 0.9);
    const y = shoreY + K * (1 / Z - 1 / farZ);
    const s = K / (camH * Z);
    return { x: W / 2 + X * s, y: y, s: s };
  };
  R.unproj = function (x, y) {
    const iz = (y - shoreY) / K + 1 / farZ;
    const Z = 1 / Math.max(iz, 1e-4);
    return { X: (x - W / 2) * camH * Z / K, Z: Z };
  };
  R.maxLat = (Z) => (W / 2) * camH * Z / K * 0.86;

  // ---------- Пейзаж (рисуется один раз на водоём и сезон) ----------
  const PAL = {
    summer: { leaf: ["#3f6b35", "#4d7a3a", "#2f5a30", "#56863e"], spruce: "#21432b", hill: "#6f8ea6", grass: "#5f8a3a", bare: false, snow: false },
    autumn: { leaf: ["#c8742a", "#d9a33a", "#a8481e", "#8a7a2a", "#e0b84a", "#5f7a30"], spruce: "#24432c", hill: "#7d8aa2", grass: "#8a7a4a", bare: false, snow: false },
    spring: { leaf: ["#8fbf5a", "#a8cc6a", "#7aa84a", "#9a8f74", "#b8d27a"], spruce: "#2a4a30", hill: "#7a96ac", grass: "#6a9a4a", bare: false, snow: false },
    winter: { leaf: ["#7a7470", "#8a8580", "#6a625e"], spruce: "#25392f", hill: "#b4c2d4", grass: "#e8eef4", bare: true, snow: true }
  };
  function ridge(g, r, base, amp, rough, col, top) {
    const ph = [r() * 9, r() * 9, r() * 9];
    g.fillStyle = col; g.beginPath(); g.moveTo(0, top);
    for (let x = 0; x <= W + 4; x += 4) {
      const y = base - amp * (0.55 + 0.25 * Math.sin(x / W * 3.1 + ph[0]) + 0.15 * Math.sin(x / W * 7.3 + ph[1]) + rough * 0.1 * Math.sin(x / W * 23 + ph[2]));
      g.lineTo(x, y);
    }
    g.lineTo(W + 4, top); g.closePath(); g.fill();
  }
  function tree(g, r, x, yb, h, kind, P) {
    if (kind === "spruce") {
      g.fillStyle = U.shade(P.spruce, r.range(-0.1, 0.12));
      const w = h * 0.42;
      g.beginPath(); g.moveTo(x, yb - h);
      for (let i = 1; i <= 4; i++) { const yy = yb - h + h * i / 4.3; const ww = w * (0.35 + i * 0.17); g.lineTo(x + ww / 2, yy); g.lineTo(x + ww * 0.22, yy - h * 0.04); }
      for (let i = 4; i >= 1; i--) { const yy = yb - h + h * i / 4.3; const ww = w * (0.35 + i * 0.17); g.lineTo(x - ww * 0.22, yy - h * 0.04); g.lineTo(x - ww / 2, yy); }
      g.closePath(); g.fill();
      if (P.snow) { g.fillStyle = "rgba(240,246,252,0.85)"; for (let i = 1; i <= 3; i++) { const yy = yb - h + h * i / 4.3; const ww = w * (0.35 + i * 0.17); g.beginPath(); g.ellipse(x, yy - h * 0.05, ww * 0.32, h * 0.03, 0, 0, Math.PI * 2); g.fill(); } }
    } else if (kind === "pine") {
      const lean = r.range(-0.06, 0.06) * h;
      g.strokeStyle = "#7a5038"; g.lineWidth = Math.max(1, h * 0.045); g.beginPath(); g.moveTo(x, yb); g.quadraticCurveTo(x + lean * 0.3, yb - h * 0.4, x + lean, yb - h * 0.7); g.stroke();
      const col = U.shade(P.spruce, r.range(0.02, 0.16));
      for (let i = 0; i < 6; i++) {
        const k = i / 5; g.fillStyle = U.shade(col, (k - 0.5) * 0.12);
        g.beginPath(); g.ellipse(x + lean + r.range(-0.17, 0.17) * h * (1 - k * 0.4), yb - h * (0.55 + k * 0.42), h * r.range(0.1, 0.17) * (1 - k * 0.35), h * r.range(0.07, 0.11), r.range(-0.3, 0.3), 0, Math.PI * 2); g.fill();
      }
      if (P.snow) { g.fillStyle = "rgba(240,246,252,0.85)"; for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(x + lean + r.range(-0.1, 0.1) * h, yb - h * (0.62 + i * 0.13), h * 0.1, h * 0.025, 0, 0, Math.PI * 2); g.fill(); } }
    } else {
      // лиственное: берёза / ива / ветла
      const willow = kind === "willow";
      if (P.bare) {
        g.strokeStyle = U.shade(r.pick(P.leaf), r.range(-0.1, 0.1)); g.lineWidth = Math.max(0.8, h * 0.035);
        g.beginPath();
        for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + r.range(-0.9, 0.9); g.moveTo(x, yb - h * 0.3); g.lineTo(x + Math.cos(a) * h * 0.55, yb - h * 0.3 + Math.sin(a) * h * 0.65); }
        g.stroke();
        g.fillStyle = "rgba(120,110,105,0.35)"; g.beginPath(); g.ellipse(x, yb - h * 0.62, h * (willow ? 0.42 : 0.3), h * 0.36, 0, 0, Math.PI * 2); g.fill();
      } else {
        const col = r.pick(P.leaf);
        const n = willow ? 6 : 4;
        for (let i = 0; i < n; i++) {
          g.fillStyle = U.shade(col, r.range(-0.12, 0.12));
          g.beginPath(); g.ellipse(x + r.range(-0.25, 0.25) * h, yb - h * r.range(0.45, 0.8), h * r.range(0.2, willow ? 0.38 : 0.28), h * r.range(0.18, 0.3), 0, 0, Math.PI * 2); g.fill();
        }
      }
      if (kind === "birch") { g.strokeStyle = "#e8e6e0"; g.lineWidth = Math.max(1, h * 0.045); g.beginPath(); g.moveTo(x, yb); g.lineTo(x, yb - h * 0.45); g.stroke(); }
    }
  }
  function treeline(g, r, P, x0, x1, base, hMin, hMax, kinds, density) {
    for (let x = x0; x < x1; x += r.range(3, 9) / density) {
      const h = r.range(hMin, hMax) * (0.8 + 0.4 * Math.sin(x / W * 5 + 1));
      tree(g, r, x, base + r.range(0, 3), h, r.pick(kinds), P);
    }
  }
  function house(g, x, yb, w, h, wall, roof) {
    g.fillStyle = wall; g.fillRect(x, yb - h, w, h);
    g.fillStyle = roof; g.beginPath(); g.moveTo(x - w * 0.1, yb - h); g.lineTo(x + w / 2, yb - h - h * 0.6); g.lineTo(x + w * 1.1, yb - h); g.closePath(); g.fill();
    g.fillStyle = "rgba(255,230,160,0.7)"; g.fillRect(x + w * 0.35, yb - h * 0.65, w * 0.25, h * 0.3);
  }
  function church(g, x, yb, s, P) {
    g.fillStyle = P.snow ? "#e6e8ea" : "#f0ece4"; g.fillRect(x - s * 0.5, yb - s * 1.2, s, s * 1.2);
    g.fillRect(x - s * 0.18, yb - s * 2.1, s * 0.36, s * 1);
    g.fillStyle = "#3a6ab0"; g.beginPath(); g.moveTo(x - s * 0.24, yb - s * 2.1); g.quadraticCurveTo(x - s * 0.3, yb - s * 2.5, x, yb - s * 2.75); g.quadraticCurveTo(x + s * 0.3, yb - s * 2.5, x + s * 0.24, yb - s * 2.1); g.fill();
    g.fillStyle = "#d8b04a"; g.beginPath(); g.moveTo(x - s * 0.36, yb - s * 1.2); g.quadraticCurveTo(x - s * 0.42, yb - s * 1.6, x, yb - s * 1.85); g.quadraticCurveTo(x + s * 0.42, yb - s * 1.6, x + s * 0.36, yb - s * 1.2); g.fill();
    g.strokeStyle = "#d8b04a"; g.lineWidth = 1; g.beginPath(); g.moveTo(x, yb - s * 2.75); g.lineTo(x, yb - s * 3.05); g.moveTo(x - s * 0.08, yb - s * 2.95); g.lineTo(x + s * 0.08, yb - s * 2.95); g.stroke();
  }
  function buildLand(loc, season) {
    const c = document.createElement("canvas"); c.width = Math.round(W * dpr); c.height = Math.round(shoreY * dpr);
    const g = c.getContext("2d"); g.scale(dpr, dpr);
    const r = U.rng(loc.id + "|" + season + "|land");
    const P = PAL[season];
    const st = loc.style;
    const sy = shoreY;
    const haze = season === "winter" ? "#c8d4e2" : "#a8bccb";
    // дальние горы/холмы
    if (st === "baikal") {
      ridge(g, r, sy * 0.62, sy * 0.42, 1, U.mix(P.hill, "#8a9ab8", 0.4), sy);
      g.fillStyle = "rgba(245,248,255,0.85)";
      for (let x = 0; x < W; x += 3) { const y = sy * 0.62 - sy * 0.42 * (0.55 + 0.25 * Math.sin(x / W * 3.1 + 2) + 0.15 * Math.sin(x / W * 7.3 + 5)); if (y < sy * 0.36) g.fillRect(x, y, 3, sy * 0.36 - y + 2); }
      ridge(g, r, sy * 0.86, sy * 0.25, 1.4, U.mix(P.hill, "#4a5a70", 0.5), sy);
    } else if (st === "taiga") {
      ridge(g, r, sy * 0.72, sy * 0.36, 1, U.mix(P.hill, haze, 0.3), sy);
      ridge(g, r, sy * 0.86, sy * 0.24, 1.3, U.mix(P.spruce, P.hill, 0.45), sy);
    } else if (st === "reservoir" || st === "lake") {
      ridge(g, r, sy * 0.94, sy * 0.08, 1, U.mix(P.hill, haze, 0.5), sy);
    } else {
      ridge(g, r, sy * 0.86, sy * 0.16, 1, U.mix(P.hill, haze, 0.35), sy);
    }
    // дымка
    const hz = g.createLinearGradient(0, sy * 0.4, 0, sy); hz.addColorStop(0, U.rgba(haze, 0)); hz.addColorStop(1, U.rgba(haze, 0.35));
    g.fillStyle = hz; g.fillRect(0, sy * 0.4, W, sy * 0.6);
    // линия леса
    const base = sy - 4;
    if (st === "pond") {
      treeline(g, r, P, -10, W + 10, base - 2, sy * 0.06, sy * 0.13, ["birch", "birch", "willow", "spruce"], 1);
      church(g, W * 0.72, base - sy * 0.07, sy * 0.06, P);
      house(g, W * 0.18, base - 1, sy * 0.06, sy * 0.04, "#8a6a4a", "#5a4a3a");
      house(g, W * 0.3, base - 1, sy * 0.05, sy * 0.035, "#9a7a5a", "#6a3a2a");
      house(g, W * 0.86, base, sy * 0.05, sy * 0.032, "#7a5a3a", "#4a4a4a");
      g.fillStyle = "#6a5040"; g.fillRect(W * 0.06, base - 3, W * 0.1, 3); // мостки
    } else if (st === "river") {
      treeline(g, r, P, -10, W * 0.62, base - 2, sy * 0.07, sy * 0.15, ["willow", "willow", "birch", "spruce"], 1);
      treeline(g, r, P, W * 0.62, W + 10, base - 2, sy * 0.05, sy * 0.11, ["willow", "birch"], 0.8);
      g.fillStyle = season === "winter" ? "#eef2f6" : "#d8c49a"; g.beginPath(); g.moveTo(W * 0.55, base + 4); g.quadraticCurveTo(W * 0.8, base - 6, W + 10, base - 3); g.lineTo(W + 10, base + 4); g.fill();
    } else if (st === "platnik") {
      treeline(g, r, P, -10, W + 10, base - 2, sy * 0.06, sy * 0.12, ["birch", "spruce", "willow"], 0.9);
      for (let i = 0; i < 4; i++) { const x = W * (0.12 + i * 0.24); g.fillStyle = "#7a5a3a"; g.fillRect(x, base - sy * 0.045, sy * 0.05, sy * 0.045); g.fillStyle = "#4a6a3a"; g.beginPath(); g.moveTo(x - 4, base - sy * 0.045); g.lineTo(x + sy * 0.025, base - sy * 0.08); g.lineTo(x + sy * 0.05 + 4, base - sy * 0.045); g.fill(); g.fillStyle = "#6a5040"; g.fillRect(x - 2, base - 1, sy * 0.06, 3); }
    } else if (st === "reservoir") {
      treeline(g, r, P, -10, W + 10, base, sy * 0.025, sy * 0.05, ["spruce", "birch", "spruce"], 1.4);
      church(g, W * 0.3, base - sy * 0.03, sy * 0.025, P);
      g.fillStyle = "#e8e8e8"; g.fillRect(W * 0.84, base - sy * 0.09, sy * 0.012, sy * 0.09); g.fillStyle = "#c83a2a"; g.fillRect(W * 0.84, base - sy * 0.095, sy * 0.012, sy * 0.02);
    } else if (st === "lake") {
      treeline(g, r, P, -10, W + 10, base - 1, sy * 0.04, sy * 0.1, ["pine", "pine", "spruce"], 1);
      for (let i = 0; i < 7; i++) { g.fillStyle = U.shade("#8a8a8e", r.range(-0.2, 0.15)); g.beginPath(); g.ellipse(r() * W, base + 1, r.range(6, 18), r.range(3, 7), 0, Math.PI, 0); g.fill(); }
    } else if (st === "delta") {
      treeline(g, r, P, -10, W + 10, base - 1, sy * 0.06, sy * 0.12, ["willow", "willow", "willow", "birch"], 0.8);
      g.strokeStyle = season === "winter" ? "#c8b88a" : "#8a9a4a"; g.lineWidth = 1;
      for (let x = 0; x < W; x += 2) { if (Math.sin(x * 0.05) > -0.2) { g.beginPath(); g.moveTo(x, base + 3); g.lineTo(x + r.range(-2, 2), base - r.range(4, 12)); g.stroke(); } }
    } else if (st === "baikal") {
      treeline(g, r, P, -10, W + 10, base - 1, sy * 0.03, sy * 0.07, ["spruce", "pine"], 1.2);
    } else if (st === "taiga") {
      treeline(g, r, P, -10, W + 10, base - 2, sy * 0.07, sy * 0.16, ["spruce", "spruce", "pine", "birch"], 1.3);
      for (let i = 0; i < 5; i++) { g.fillStyle = U.shade("#7a7a78", r.range(-0.2, 0.1)); g.beginPath(); g.ellipse(r() * W, base + 2, r.range(8, 20), r.range(4, 8), 0, Math.PI, 0); g.fill(); }
    }
    // полоска берега
    g.fillStyle = P.grass; g.fillRect(0, base, W, sy - base + 1);
    g.fillStyle = "rgba(0,0,0,0.15)"; g.fillRect(0, sy - 1.5, W, 1.5);
    return c;
  }

  // ---------- Поверхность льда (зима) ----------
  function buildIce(loc) {
    const c = document.createElement("canvas"); c.width = Math.round(W * dpr); c.height = Math.round((H - shoreY) * dpr);
    const g = c.getContext("2d"); g.scale(dpr, dpr);
    const r = U.rng(loc.id + "|ice");
    const h = H - shoreY;
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#c9d6e4"); gr.addColorStop(0.3, "#e4ecf4"); gr.addColorStop(1, "#f6f9fc");
    g.fillStyle = gr; g.fillRect(0, 0, W, h);
    // проплешины льда
    for (let i = 0; i < 14; i++) {
      const Z = r.range(6, farZ * 0.9), X = r.range(-1, 1) * R.maxLat(Z); const p = R.proj(X, Z);
      g.fillStyle = loc.style === "baikal" ? "rgba(90,150,200,0.45)" : "rgba(150,180,205,0.35)";
      g.beginPath(); g.ellipse(p.x, p.y - shoreY, p.s * r.range(2, 6), p.s * r.range(0.4, 1.2), 0, 0, Math.PI * 2); g.fill();
    }
    // снежная фактура
    for (let i = 0; i < 1600; i++) {
      const yy = Math.pow(r(), 0.7) * h; const k = yy / h;
      g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.7)" : "rgba(160,180,200,0.22)";
      g.fillRect(r() * W, yy, 1 + k * 5, 0.4 + k * 1.4);
    }
    // трещины
    g.strokeStyle = "rgba(120,150,180,0.35)"; g.lineWidth = 0.8;
    for (let i = 0; i < 6; i++) { let x = r() * W, y = r.range(0.2, 0.9) * h; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 8; j++) { x += r.range(-30, 30); y += r.range(-4, 6); g.lineTo(x, y); } g.stroke(); }
    // старые лунки и рыбаки вдалеке
    for (let i = 0; i < 18; i++) {
      const Z = r.range(8, farZ * 0.8), X = r.range(-1, 1) * R.maxLat(Z); const p = R.proj(X, Z);
      g.fillStyle = "rgba(60,80,100,0.5)"; g.beginPath(); g.ellipse(p.x, p.y - shoreY, p.s * 0.12, p.s * 0.04, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "rgba(255,255,255,0.8)"; g.beginPath(); g.ellipse(p.x, p.y - shoreY + p.s * 0.03, p.s * 0.2, p.s * 0.05, 0, 0, Math.PI); g.fill();
    }
    for (let i = 0; i < 9; i++) {
      const Z = r.range(25, farZ * 0.85), X = r.range(-0.9, 0.9) * R.maxLat(Z); const p = R.proj(X, Z); const s = p.s * 1.7;
      const y0 = p.y - shoreY;
      g.fillStyle = r.pick(["#2a3a4a", "#5a3a2a", "#3a4a2a", "#4a2a3a"]); g.beginPath(); g.ellipse(p.x, y0 - s * 0.45, s * 0.22, s * 0.38, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#e8c8a0"; g.beginPath(); g.arc(p.x, y0 - s * 0.88, s * 0.1, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#c83a2a"; g.fillRect(p.x - s * 0.13, y0 - s * 0.98, s * 0.26, s * 0.08);
      g.fillStyle = r.pick(["#e0b030", "#3a7ab0", "#e8e8e8"]); g.fillRect(p.x + s * 0.15, y0 - s * 0.26, s * 0.3, s * 0.24);
    }
    return c;
  }

  // ---------- Кадр ----------
  // Небо и берег рисуются в кэш раз в несколько секунд (свет меняется медленно),
  // облака досоставляются в верхний слой 2–3 раза в секунду, отражение — тоже из кэша.
  let skyC = null, landLitC = null, reflC = null, iceLitC = null, cloudSpr = [];
  let baseKey = "", composeT = -1, reflDirty = true, iceLitKey = "";
  // Холсты переиспользуются: создавать новый каждые полсекунды — лишняя работа сборщику мусора
  const pool = {};
  const mk = (w, h, name) => {
    const cw = Math.max(1, Math.round(w * dpr)), ch = Math.max(1, Math.round(h * dpr));
    let e = name && pool[name];
    if (!e || e[0].width !== cw || e[0].height !== ch) {
      const c = document.createElement("canvas"); c.width = cw; c.height = ch; e = [c, c.getContext("2d")];
      if (name) pool[name] = e;
    }
    const g = e[1]; g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; g.clearRect(0, 0, cw, ch); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return e;
  };
  const WCOL = { pond: ["#5a7a62", "#1c3a30"], river: ["#5a7a84", "#1d3440"], platnik: ["#5a7a6a", "#1e3a34"], reservoir: ["#64849a", "#1e3448"],
    lake: ["#5a7a90", "#14304a"], delta: ["#6a7e74", "#22383a"], baikal: ["#4a8ab0", "#0c3450"], taiga: ["#4a6a6a", "#152e30"] };

  function buildBase(v, L, over) {
    const loc = v.loc, season = v.season, wx = v.wx;
    // небо
    let a = mk(W, shoreY, "sky"); skyC = a[0]; let g = a[1];
    let skyTop = L.top, skyBot = L.bot;
    if (over) { skyTop = U.mix(skyTop, "#7a8494", 0.55 * (1 - L.dark * 0.6)); skyBot = U.mix(skyBot, "#a8b0b8", 0.55 * (1 - L.dark * 0.6)); }
    if (season === "winter") skyBot = U.mix(skyBot, "#dfe8f2", 0.25 * (1 - L.dark));
    const sk = g.createLinearGradient(0, 0, 0, shoreY); sk.addColorStop(0, skyTop); sk.addColorStop(1, skyBot);
    g.fillStyle = sk; g.fillRect(0, 0, W, shoreY);
    if (L.stars > 0.02 && !over) {
      const tw = U.rng("tw" + Math.round(v.hour * 16));
      g.fillStyle = "#fff";
      for (const s of stars) { g.globalAlpha = L.stars * (0.45 + 0.55 * tw()); g.fillRect(s[0], s[1], s[2], s[2]); }
      g.globalAlpha = 1;
    }
    if (L.sunUp && !over) {
      const sr = 18 + L.sunLow * 10;
      const gl = g.createRadialGradient(L.sunX, L.sunY, 2, L.sunX, L.sunY, sr * 6);
      gl.addColorStop(0, "rgba(255,240,200,0.9)"); gl.addColorStop(0.15, U.rgba(U.mix("#fff6d8", "#ff9a5a", L.sunLow), 0.55)); gl.addColorStop(1, "rgba(255,200,150,0)");
      g.fillStyle = gl; g.fillRect(L.sunX - sr * 6, L.sunY - sr * 6, sr * 12, sr * 12);
      g.fillStyle = U.mix("#fffbe8", "#ffc08a", L.sunLow); g.beginPath(); g.arc(L.sunX, L.sunY, sr * 0.6, 0, Math.PI * 2); g.fill();
    }
    if (L.moonA > 0) {
      const mx = W * 0.28, my = shoreY * 0.3;
      g.globalAlpha = L.moonA * (over ? 0.35 : 1);
      const gl = g.createRadialGradient(mx, my, 4, mx, my, 70); gl.addColorStop(0, "rgba(220,230,255,0.5)"); gl.addColorStop(1, "rgba(200,210,255,0)");
      g.fillStyle = gl; g.fillRect(mx - 70, my - 70, 140, 140);
      g.fillStyle = "#eef2ff"; g.beginPath(); g.arc(mx, my, 13, 0, Math.PI * 2); g.fill();
      g.fillStyle = "rgba(170,180,210,0.5)"; g.beginPath(); g.arc(mx - 4, my - 3, 3, 0, Math.PI * 2); g.arc(mx + 4, my + 4, 2.2, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
    }
    // облака — спрайты под текущий свет
    const cloudCol = U.mix(U.mix("#ffffff", L.bot, 0.35), "#1a2240", L.dark * 0.9);
    const n = over ? 1.6 : (wx.sky === "cloudy" ? 1 : 0.45);
    cloudSpr = clouds.map(function (c) {
      const cr = U.rng(c.seed), pw = (60 + 52 * n) * c.s + 4, ph = 25 * c.s + 4;
      const b = mk(pw * 2, ph * 2, "cloud" + clouds.indexOf(c)), cg = b[1];
      cg.fillStyle = U.rgba(cloudCol, Math.min(0.9, 0.5 * n));
      for (let i = 0; i < 6; i++) { cg.beginPath(); cg.ellipse(pw + cr.range(-60, 60) * c.s, ph + cr.range(-8, 6) * c.s, cr.range(26, 52) * c.s * n, cr.range(9, 17) * c.s, 0, 0, Math.PI * 2); cg.fill(); }
      return { c: b[0], w: pw, h: ph };
    });
    // берег с освещением
    a = mk(W, shoreY, "land"); landLitC = a[0]; g = a[1];
    const img = FZ.Assets.bg(loc.id, season);
    if (img) {
      const wl = FZ.Assets.waterline(loc.id, season);
      const sc = Math.max(W / img.width, (shoreY + 8) / (img.height * wl));
      g.drawImage(img, (W - img.width * sc) / 2, shoreY - img.height * wl * sc, img.width * sc, img.height * sc);
      // небо картинки плавно уступает игровому небу (свет, звёзды, луна)
      g.globalCompositeOperation = "destination-out";
      const fade = g.createLinearGradient(0, 0, 0, shoreY * 0.62);
      fade.addColorStop(0, "rgba(0,0,0," + (0.15 + L.dark * 0.8) + ")"); fade.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = fade; g.fillRect(0, 0, W, shoreY * 0.62);
      g.globalCompositeOperation = "source-over";
    } else {
      const key = loc.id + season + W + "x" + H + dpr;
      if (landKey !== key) { landC = buildLand(loc, season); landKey = key; }
      g.drawImage(landC, 0, 0, W, shoreY);
    }
    g.globalCompositeOperation = "source-atop";
    if (L.dark > 0.01) { g.globalCompositeOperation = "multiply"; g.fillStyle = U.mix("#ffffff", "#24305e", L.dark); g.fillRect(0, 0, W, shoreY); }
    if (L.warm > 0.01) { g.globalAlpha = L.warm; g.fillStyle = L.tint; g.globalCompositeOperation = "soft-light"; g.fillRect(0, 0, W, shoreY); g.globalAlpha = 1; }
    g.globalCompositeOperation = "destination-in"; g.drawImage(img ? landMask(img, loc, season) : landC, 0, 0, W, shoreY);
    g.globalCompositeOperation = "source-over";
    if ((v.period === "dawn" || (wx.sky === "overcast" && season !== "summer")) && !v.ice) {
      const fg = g.createLinearGradient(0, shoreY * 0.7, 0, shoreY); fg.addColorStop(0, "rgba(230,232,240,0)"); fg.addColorStop(1, U.rgba(U.mix("#e8ecf2", L.bot, 0.3), 0.55 * (1 - L.dark)));
      g.fillStyle = fg; g.fillRect(0, shoreY * 0.7, W, shoreY * 0.3);
    }
  }
  // маска непрозрачности фоновой картинки (после вычитания неба) — чтобы свет не красил прозрачное
  let maskC = null, maskKey = "";
  function landMask(img, loc, season) {
    const key = loc.id + season + W + "x" + H + dpr + Math.round(R.lastLight.dark * 10);
    if (maskKey === key) return maskC;
    const a = mk(W, shoreY, "mask"), g = a[1];
    const wl = FZ.Assets.waterline(loc.id, season);
    const sc = Math.max(W / img.width, (shoreY + 8) / (img.height * wl));
    g.drawImage(img, (W - img.width * sc) / 2, shoreY - img.height * wl * sc, img.width * sc, img.height * sc);
    g.globalCompositeOperation = "destination-out";
    const fade = g.createLinearGradient(0, 0, 0, shoreY * 0.62);
    fade.addColorStop(0, "rgba(0,0,0," + (0.15 + R.lastLight.dark * 0.8) + ")"); fade.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = fade; g.fillRect(0, 0, W, shoreY * 0.62);
    maskC = a[0]; maskKey = key; return maskC;
  }
  function composeTop() {
    const g = topG;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(skyC, 0, 0);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    clouds.forEach(function (c, i) { const s = cloudSpr[i]; if (s) g.drawImage(s.c, c.x - s.w, c.y - s.h, s.w * 2, s.h * 2); });
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(landLitC, 0, 0);
  }
  function buildRefl(v, L, over) {
    const span = H - shoreY;
    const a = mk(W + 16, span, "refl"), g = a[1];
    g.translate(8, 0);
    const WC = WCOL[v.loc.style];
    let far = U.mix(WC[0], L.water, 0.45), near = U.mix(WC[1], L.top, 0.18);
    if (v.season === "autumn") { far = U.mix(far, "#4a5060", 0.2); near = U.mix(near, "#18222a", 0.25); }
    if (L.dark > 0) { far = U.mix(far, "#0a1224", L.dark * 0.8); near = U.mix(near, "#050a14", L.dark * 0.85); }
    // непрозрачная основа (слой копируется на экран как есть — прозрачных мест быть не должно)
    const wg = g.createLinearGradient(0, 0, 0, span); wg.addColorStop(0, far); wg.addColorStop(1, near);
    g.fillStyle = wg; g.fillRect(-8, 0, W + 16, span);
    // отражение берега: перевёрнутый верхний слой
    g.save(); g.globalAlpha = over ? 0.6 : 0.8;
    g.setTransform(dpr, 0, 0, -dpr / 1.02, 8 * dpr, shoreY * dpr / 1.02);
    g.drawImage(topC, 0, 0, topC.width, topC.height, -8, 0, W + 16, shoreY);
    g.restore();
    // цвет воды густеет к зрителю и прячет место, где отражение заканчивается
    const e = U.clamp(shoreY * 1.02 / span, 0.2, 1);
    const dg = g.createLinearGradient(0, 0, 0, span);
    dg.addColorStop(0, U.rgba(far, 0.05)); dg.addColorStop(e * 0.55, U.rgba(U.mix(far, near, 0.4), 0.3));
    dg.addColorStop(e * 0.97, U.rgba(U.mix(far, near, 0.75), 0.82)); dg.addColorStop(1, U.rgba(near, 0.9));
    g.fillStyle = dg; g.fillRect(-8, 0, W + 16, span);
    g.fillStyle = U.rgba(L.bot, 0.25); g.fillRect(-8, 0, W + 16, 1.5);
    reflC = a[0];
  }

  R.render = function (v, dt) {
    const loc = v.loc, season = v.season, t = v.t;
    if (farZ !== loc.zfar) R.setFar(loc.zfar);
    const L = R.light(v.hour, season);
    R.lastLight = L;
    const wx = v.wx;
    const over = wx.sky === "overcast" || wx.sky === "rain" || wx.sky === "storm" || wx.sky === "snow";
    const windF = 0.5 + wx.wind / 7;
    const key = loc.id + "|" + season + "|" + wx.sky + "|" + Math.round(v.hour * 16) + "|" + W + "x" + H + "|" + dpr + "|" + (v.ice ? 1 : 0) + "|" + FZ.Assets.version;
    for (const c of clouds) { c.x += (0.004 + wx.wind * 0.0025) * W * dt * 0.1; if (c.x > W * 1.25) c.x = -W * 0.35; }
    if (key !== baseKey) { buildBase(v, L, over); baseKey = key; composeTop(); composeT = t; if (!v.ice) buildRefl(v, L, over); reflDirty = false; }
    else if (reflDirty && !v.ice) { buildRefl(v, L, over); reflDirty = false; }
    else if (t - composeT > 0.8 || t < composeT) { composeTop(); composeT = t; reflDirty = true; }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let sx = 0, sy = 0;
    if (R.shakeA > 0.05) { sx = (Math.random() - 0.5) * R.shakeA; sy = (Math.random() - 0.5) * R.shakeA; R.shakeA *= Math.pow(0.02, dt); }
    R._sx = sx; R._sy = sy;
    if (sx || sy) { ctx.translate(sx, sy); ctx.drawImage(topC, 0, 0, topC.width, topC.height, -6, -6, W + 12, shoreY + 6); }
    else ctx.drawImage(topC, 0, 0, topC.width, topC.height, 0, 0, W, shoreY);
    R.drawBirds(L, dt, t);

    if (v.ice) R.drawIceField(v, L, t);
    else R.drawWater(v, L, t, windF, over);

    R.drawWorldFx(v, L, dt);
    if (!v.ice) R.drawReeds(v, L, t, windF, season);
    R.drawTackle(v, L, t);
    R.drawWeather(v, L, t, dt, wx);
    R.drawScreenFx(dt);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  };

  // ---------- Вода ----------
  let dashes = [];
  R.drawWater = function (v, L, t, windF, over) {
    const season = v.season;
    const span = H - shoreY;
    // отражение с волной: полосы из готового слоя
    // в пикселях экрана, без масштабирования — это простое копирование полос
    const lo = quality === "lo";
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const prevSmooth = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
    const ox = Math.round((R._sx || 0) * dpr), top0 = Math.round((shoreY + (R._sy || 0)) * dpr), rh = reflC.height;
    let d = 0;
    while (d < rh) {
      const k = d / rh;
      const step = Math.max(1, Math.round((lo ? 4 + k * 12 : 2.5 + k * 7) * dpr));
      const y = top0 + d;
      const amp = (0.4 + k * k * 9) * windF;
      const dx = Math.round((Math.sin(y / dpr * 0.11 + t * 1.7) * amp + Math.sin(y / dpr * 0.037 - t * 1.1) * amp * 0.7 - 8) * dpr);
      const hh = Math.min(step, rh - d);
      ctx.drawImage(reflC, 0, d, reflC.width, hh, dx + ox, y, reflC.width, hh);
      d += step;
    }
    ctx.imageSmoothingEnabled = prevSmooth;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.translate(R._sx || 0, R._sy || 0);
    // рябь: светлые и тёмные штрихи
    if (!dashes.length || dashes.W !== W) {
      const r = U.rng("dash"); dashes = []; dashes.W = W;
      for (let i = 0; i < 130; i++) dashes.push({ k: Math.pow(r(), 1.25), x: r() * (W + 80), l: r.range(0.5, 1.5), ph: r() * 6.28, light: r() > 0.42, sp: r.range(0.6, 1.4) });
    }
    const n = lo ? 60 : 130;
    const wa = Math.min(1.3, windF);
    const lightC = U.mix(U.mix(L.bot, "#ffffff", 0.35), "#7080a0", L.dark), darkC = U.mix("#0a1a24", "#000000", L.dark);
    for (let pass = 0; pass < 2; pass++) {
      ctx.fillStyle = pass ? darkC : lightC;
      for (let i = 0; i < n; i++) {
        const q = dashes[i]; if (q.light === !!pass) continue;
        const k = q.k, yy = shoreY + 2 + k * (span - 2);
        const w = (5 + k * 60) * q.l;
        let x = (q.x + t * (4 + 22 * k) * windF * q.sp) % (W + 80) - 40;
        const a = (0.07 + 0.2 * k) * (0.55 + 0.45 * Math.sin(t * 1.3 * q.sp + q.ph)) * wa;
        if (a <= 0.01) continue;
        ctx.globalAlpha = a; ctx.fillRect(x, yy, w, 0.6 + k * 1.6);
      }
    }
    ctx.globalAlpha = 1;
    // солнечная / лунная дорожка
    const glint = L.sunUp && !over ? { x: L.sunX, c: U.mix("#fff8e0", "#ffb070", L.sunLow), a: 0.35 + L.sunLow * 0.55 } : (L.moonA > 0.3 && !over ? { x: W * 0.28, c: "#dfe6ff", a: 0.55 * L.moonA } : null);
    if (glint) {
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = glint.c;
      const gn = lo ? 40 : 70;
      for (let i = 0; i < gn; i++) {
        const k = Math.pow((i + 0.5) / gn, 1.5);
        const yy = shoreY + 1 + k * span;
        const flick = Math.sin(t * 6.3 + i * 12.97) * 0.5 + 0.5;
        if (flick < 0.45) continue;
        const ww = (3 + k * 46) * (0.4 + flick) * (0.6 + windF * 0.3);
        const xx = glint.x + Math.sin(i * 7.3 + t * 0.9) * (4 + k * 34);
        ctx.globalAlpha = glint.a * (1 - k * 0.65) * flick;
        ctx.fillRect(xx - ww / 2, yy, ww, 0.8 + k * 1.6);
      }
      ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
    }
    if (v.loc.style === "pond" || v.loc.style === "delta" || v.loc.style === "platnik") R.drawPads(v, L, t, season);
    if (season === "autumn") R.drawLeaves(v, L, t);
  };

  R.drawPads = function (v, L, t, season) {
    if (season === "winter") return;
    if (!pads.length || pads.key !== v.loc.id) {
      pads = []; pads.key = v.loc.id; const r = U.rng(v.loc.id + "pads");
      for (let i = 0; i < 26; i++) { const Z = r.range(5, 24); const side = r() < 0.5 ? -1 : 1; const X = side * r.range(0.55, 1.05) * R.maxLat(Z); pads.push({ X, Z, rot: r() * 6, s: r.range(0.18, 0.32), fl: r() < 0.18 ? r.pick(["#fff8f0", "#f6e05a"]) : null }); }
      pads.sort((a, b) => b.Z - a.Z);
    }
    const dim = 1 - L.dark * 0.75;
    for (const p of pads) {
      if (season === "spring" && p.s < 0.24) continue;
      const q = R.proj(p.X, p.Z); const rx = Math.max(3, q.s * p.s), ry = rx * 0.32;
      ctx.fillStyle = U.mix(season === "autumn" ? "#8a7a3a" : "#3e7a3a", "#0a1420", 1 - dim);
      ctx.beginPath(); ctx.ellipse(q.x, q.y, rx, ry, 0, 0.15 + p.rot % 1, Math.PI * 2 - 0.15 + p.rot % 1); ctx.lineTo(q.x, q.y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.beginPath(); ctx.ellipse(q.x - rx * 0.2, q.y - ry * 0.2, rx * 0.5, ry * 0.4, 0, 0, Math.PI * 2); ctx.fill();
      if (p.fl && season === "summer") { ctx.fillStyle = U.mix(p.fl, "#202840", 1 - dim); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; ctx.beginPath(); ctx.ellipse(q.x + Math.cos(a) * rx * 0.18, q.y - ry * 0.6 + Math.sin(a) * ry * 0.2, rx * 0.16, ry * 0.5, a, 0, Math.PI * 2); ctx.fill(); } }
    }
  };
  R.drawLeaves = function (v, L, t) {
    const r = U.rng("leaves" + v.loc.id);
    const dim = 1 - L.dark * 0.75;
    for (let i = 0; i < 22; i++) {
      const Z = r.range(4, 40), X = r.range(-1, 1) * R.maxLat(Z) + Math.sin(t * 0.1 + i) * 0.5 + (v.loc.current || 0) * ((t * 0.3 + i * 7) % 20 - 10);
      const q = R.proj(X, Z); const s = Math.max(1.5, q.s * 0.06);
      ctx.fillStyle = U.mix(r.pick(["#d9a33a", "#c8742a", "#a8481e", "#e0b84a"]), "#101828", 1 - dim);
      ctx.beginPath(); ctx.ellipse(q.x, q.y, s, s * 0.4, r() * 3, 0, Math.PI * 2); ctx.fill();
    }
  };

  // ---------- Лёд ----------
  R.drawIceField = function (v, L, t) {
    const key = v.loc.id + W + "x" + H + dpr;
    if (iceKey !== key) { iceC = buildIce(v.loc); iceKey = key; iceLitKey = ""; }
    if (iceLitKey !== baseKey) {
      const a = mk(W, H - shoreY, "icelit"), g = a[1];
      g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(iceC, 0, 0); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (L.dark > 0.01) { g.globalCompositeOperation = "multiply"; g.fillStyle = U.mix("#ffffff", "#2a3a6a", L.dark); g.fillRect(0, 0, W, H - shoreY); }
      if (L.warm > 0.01) { g.globalAlpha = L.warm * 0.7; g.globalCompositeOperation = "soft-light"; g.fillStyle = L.tint; g.fillRect(0, 0, W, H - shoreY); g.globalAlpha = 1; }
      g.globalCompositeOperation = "source-over";
      iceLitC = a[0]; iceLitKey = baseKey;
    }
    ctx.drawImage(iceLitC, 0, 0, iceLitC.width, iceLitC.height, 0, shoreY, W, H - shoreY);
    // блики на снегу
    if (L.sunUp) {
      ctx.globalCompositeOperation = "lighter";
      const r = U.rng("spark");
      for (let i = 0; i < 40; i++) { const x = r() * W, y = shoreY + Math.pow(r(), 0.6) * (H - shoreY); const f = Math.sin(t * 3 + i * 7.7); if (f > 0.85) { ctx.fillStyle = "rgba(255,255,255," + (f - 0.85) * 5 + ")"; ctx.fillRect(x, y, 1.5, 1.5); } }
      ctx.globalCompositeOperation = "source-over";
    }
  };

  // Лунка крупным планом
  R.holeGeom = () => ({ x: W * 0.47, y: H * 0.64, rx: Math.min(W * 0.25, 130), ry: Math.min(W * 0.25, 130) * 0.36 });
  R.drawHole = function (v, L, t) {
    const h = R.holeGeom();
    const dim = U.mix("#ffffff", "#3a4a7a", L.dark);
    // снежный отвал
    const r = U.rng("hole" + (v.ice ? v.ice.holeId : 0));
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2, d = r.range(1.05, 1.6);
      ctx.fillStyle = U.mix(r() > 0.5 ? "#f2f6fa" : "#d8e2ec", "#2a3450", L.dark * 0.7);
      ctx.beginPath(); ctx.ellipse(h.x + Math.cos(a) * h.rx * d, h.y + Math.sin(a) * h.ry * d, r.range(8, 22), r.range(4, 9), 0, 0, Math.PI * 2); ctx.fill();
    }
    // стенка льда
    ctx.fillStyle = U.mix("#7aa8c8", "#1a2a4a", L.dark * 0.8);
    ctx.beginPath(); ctx.ellipse(h.x, h.y, h.rx, h.ry, 0, 0, Math.PI * 2); ctx.fill();
    const wallH = h.ry * 0.75;
    const wg = ctx.createLinearGradient(0, h.y - h.ry, 0, h.y + wallH);
    wg.addColorStop(0, U.mix("#bfe0f2", "#2a3a5a", L.dark * 0.8)); wg.addColorStop(1, U.mix("#3a6a8a", "#0a1428", L.dark));
    ctx.fillStyle = wg; ctx.beginPath(); ctx.ellipse(h.x, h.y, h.rx * 0.97, h.ry * 0.95, 0, Math.PI, 0); ctx.ellipse(h.x, h.y + wallH * 0.5, h.rx * 0.9, h.ry * 0.82, 0, 0, Math.PI, false); ctx.fill();
    // вода
    const water = U.mix("#0f2a3a", "#02060e", L.dark);
    ctx.fillStyle = water; ctx.beginPath(); ctx.ellipse(h.x, h.y + wallH * 0.5, h.rx * 0.88, h.ry * 0.78, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.ellipse(h.x, h.y + wallH * 0.5, h.rx * 0.88, h.ry * 0.78, 0, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = U.rgba(U.mix("#a8c8e8", "#304070", L.dark), 0.25); ctx.beginPath(); ctx.ellipse(h.x - h.rx * 0.2 + Math.sin(t) * 3, h.y + wallH * 0.3, h.rx * 0.5, h.ry * 0.22, -0.1, 0, Math.PI * 2); ctx.fill();
    // шуга
    const sr = U.rng("slush");
    for (let i = 0; i < 9; i++) { ctx.fillStyle = "rgba(220,235,245," + (0.45 - L.dark * 0.3) + ")"; ctx.beginPath(); ctx.ellipse(h.x + sr.range(-0.8, 0.8) * h.rx + Math.sin(t * 0.6 + i) * 2, h.y + wallH * 0.5 + sr.range(-0.6, 0.6) * h.ry, sr.range(3, 7), sr.range(1.2, 2.5), 0, 0, Math.PI * 2); ctx.fill(); }
    // рыба под лункой
    const f = v.fish;
    if (f && f.depth != null && f.depth < 1.6 && !f.out) {
      const a = U.clamp(1 - f.depth / 1.6, 0, 1) * 0.55;
      FZ.Art.drawFish(ctx, f.s, h.x + Math.sin(t * 2.2) * h.rx * 0.25, h.y + wallH * 0.55, Math.min(h.rx * 1.7, 50 + f.lenPx * 0.4), { silhouette: true, alpha: a, phase: t * 10, amp: 0.3, dir: Math.sin(t) > 0 ? 1 : -1 });
    }
    ctx.restore();
    // кромка
    ctx.strokeStyle = U.rgba(U.mix("#ffffff", "#4a5a8a", L.dark), 0.9); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(h.x, h.y, h.rx, h.ry, 0, 0, Math.PI * 2); ctx.stroke();
    return h;
  };

  // Место под лунку и ледобур
  R.drawDrill = function (v, L, t) {
    const h = R.holeGeom();
    const k = v.ice.drill;
    ctx.fillStyle = U.rgba(U.mix("#c8d6e4", "#2a3450", L.dark), 0.7);
    ctx.beginPath(); ctx.ellipse(h.x, h.y, h.rx * 0.9, h.ry * 0.9, 0, 0, Math.PI * 2); ctx.fill();
    if (k == null) {
      ctx.strokeStyle = U.rgba("#ffffff", 0.7); ctx.setLineDash([6, 6]); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(h.x, h.y, h.rx, h.ry, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      return;
    }
    const depth = U.clamp(k, 0, 1) * h.ry * 2.2;
    ctx.fillStyle = U.mix("#5a7a9a", "#101828", L.dark);
    ctx.beginPath(); ctx.ellipse(h.x, h.y, h.rx * 0.85 * k, h.ry * 0.85 * k, 0, 0, Math.PI * 2); ctx.fill();
    // ледобур
    const x = h.x, top = h.y - H * 0.42, bot = h.y + depth * 0.3;
    ctx.strokeStyle = U.mix("#7a8088", "#202630", L.dark); ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bot); ctx.stroke();
    ctx.strokeStyle = U.mix("#b8c0c8", "#303848", L.dark); ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) { const yy = bot - i * 14 - ((t * 120) % 14); if (yy < top + 60) continue; ctx.beginPath(); ctx.moveTo(x - 12, yy); ctx.lineTo(x + 12, yy - 7); ctx.stroke(); }
    ctx.fillStyle = U.mix("#c83a2a", "#301010", L.dark * 0.6); ctx.fillRect(x - 40, top - 6, 80, 10);
    ctx.save(); ctx.translate(x, top); ctx.rotate(t * 9); ctx.fillStyle = "#333"; ctx.fillRect(-36, -3, 72, 6); ctx.restore();
  };

  // ---------- Камыш ----------
  // Камыш: по две группы с каждой стороны рисуются в слои один раз на свет/сезон,
  // а каждый кадр слой копируется полосами со сдвигом — покачивание без перерисовки 46 линий
  let reedLayers = [], reedKey = "";
  function buildReeds(L, season) {
    reedLayers = [];
    const dark = L.dark;
    for (let side = 0; side < 2; side++) {
      for (let grp = 0; grp < 1; grp++) {
        const list = reeds.filter((r) => (side === 0 ? r.x < W / 2 : r.x >= W / 2));
        if (!list.length) continue;
        let x0 = Infinity, x1 = -Infinity, hmax = 0;
        list.forEach((r) => { x0 = Math.min(x0, r.x + Math.min(0, r.bend * r.h) - 14); x1 = Math.max(x1, r.x + Math.max(0, r.bend * r.h) + 14); hmax = Math.max(hmax, r.h + 16); });
        const a = mk(x1 - x0, hmax, "reed" + side + grp), g = a[1];
        g.lineCap = "round";
        list.forEach(function (r) {
          const col = season === "winter" ? U.mix("#c8b88a", "#a89a6a", r.shade) : season === "autumn" ? U.mix("#a89a4a", "#7a6a3a", r.shade) : season === "spring" ? U.mix("#7aa04a", "#a89a6a", r.shade) : U.mix("#3e6a2a", "#5a8a3a", r.shade);
          g.strokeStyle = U.mix(col, "#05080e", dark * 0.85); g.lineWidth = r.w;
          const bx = r.x - x0, by = hmax + 4, tipX = bx + r.bend * r.h, tipY = hmax - r.h;
          g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx + r.bend * r.h * 0.2, hmax - r.h * 0.5, tipX, tipY); g.stroke();
          if (r.cat && season !== "spring") {
            g.fillStyle = U.mix(season === "winter" ? "#8a6a4a" : "#6a3e22", "#05080e", dark * 0.85);
            const cx = U.lerp(bx, tipX, 0.88), cy = U.lerp(by, tipY, 0.88) + 6;
            g.save(); g.translate(cx, cy); g.rotate(Math.atan2(tipX - bx, -(tipY - by)) * 0.9);
            g.beginPath(); g.roundRect(-r.w * 1.3, -r.h * 0.07, r.w * 2.6, r.h * 0.14, r.w); g.fill(); g.restore();
          }
        });
        reedLayers.push({ c: a[0], x: x0, w: x1 - x0, h: hmax, ph: side * 1.7 + grp * 2.1 });
      }
    }
  }
  R.drawReeds = function (v, L, t, windF, season) {
    if (reedKey !== baseKey) { buildReeds(L, season); reedKey = baseKey; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
    const ox = Math.round((R._sx || 0) * dpr), oy = Math.round((R._sy || 0) * dpr), band = Math.max(4, Math.round(8 * dpr));
    for (const l of reedLayers) {
      const sway = Math.sin(t * (0.9 + windF * 0.5) + l.ph) * 0.05 * windF;
      const cw = l.c.width, ch = l.c.height, x0 = Math.round(l.x * dpr) + ox, y0 = Math.round((H - l.h) * dpr) + oy;
      for (let y = 0; y < ch; y += band) {
        const hh = Math.min(band, ch - y), hgt = (ch - y - hh / 2) / dpr; // высота полосы над низом экрана
        const off = Math.round((sway + Math.sin(t * 1.3 + hgt * 0.02 + l.ph) * 0.012 * windF) * hgt * (hgt / l.h) * dpr);
        ctx.drawImage(l.c, 0, y, cw, hh, x0 + off, y0 + y, cw, hh);
      }
    }
    ctx.imageSmoothingEnabled = sm;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.translate(R._sx || 0, R._sy || 0);
  };

  // ---------- Птицы, всплески вдали ----------
  R.drawBirds = function (L, dt, t) {
    if (Math.random() < dt * 0.025 && R.birds.length < 3 && L.dark < 0.4) R.birds.push({ x: -20, y: shoreY * (0.15 + Math.random() * 0.45), v: 25 + Math.random() * 30, ph: Math.random() * 6, s: 0.6 + Math.random() * 0.6 });
    ctx.strokeStyle = U.mix("#2a3240", "#c8d0e0", L.dark); ctx.lineWidth = 1.4;
    R.birds = R.birds.filter(function (b) {
      b.x += b.v * dt; b.y += Math.sin(t + b.ph) * 4 * dt;
      const f = Math.sin(t * 9 + b.ph) * 4 * b.s;
      ctx.beginPath(); ctx.moveTo(b.x - 7 * b.s, b.y - f); ctx.quadraticCurveTo(b.x - 3 * b.s, b.y - 3 * b.s, b.x, b.y); ctx.quadraticCurveTo(b.x + 3 * b.s, b.y - 3 * b.s, b.x + 7 * b.s, b.y - f); ctx.stroke();
      return b.x < W + 20;
    });
  };

  // ---------- Мировые эффекты (кольца, пузыри, всплески) ----------
  R.ring = function (X, Z, size, life) { R.rings.push({ X, Z, r: 0, size: size || 0.6, life: life || 1.6, age: 0 }); };
  R.splash = function (X, Z, power, col) {
    const p = R.proj(X, Z);
    const n = Math.round(8 + power * 18);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const sp = (40 + Math.random() * 140) * (0.5 + power) * Math.min(1.6, p.s / 40 + 0.4);
      R.parts.push({ x: p.x, y: p.y, vx: Math.cos(a) * sp * 0.6, vy: Math.sin(a) * sp, life: 0.5 + Math.random() * 0.5, age: 0, r: 1 + Math.random() * 2.2 * (0.5 + power), col: col || "rgba(230,242,250,0.9)", g: 420, floor: p.y + 2 });
    }
    R.ring(X, Z, 0.5 + power, 1.8); R.ring(X, Z, 0.25 + power * 0.6, 1.3);
  };
  R.bubbles = function (X, Z, n) { for (let i = 0; i < n; i++) R.fx.push({ type: "bub", X: X + (Math.random() - 0.5) * 0.8, Z: Z + (Math.random() - 0.5) * 0.8, age: -Math.random() * 1.5, life: 0.7 }); };
  R.chips = function (x, y, n) { for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, sp = 60 + Math.random() * 160; R.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.6 + Math.random() * 0.4, age: 0, r: 1.5 + Math.random() * 2.5, col: "rgba(240,248,255,0.95)", g: 500, floor: y + 30 }); } };
  R.distantJump = function () {
    const Z = 15 + Math.random() * (farZ * 0.7), X = (Math.random() - 0.5) * 1.6 * R.maxLat(Z);
    R.jumps.push({ X, Z, age: 0, dir: Math.random() < 0.5 ? -1 : 1 });
  };

  R.drawWorldFx = function (v, L, dt) {
    const lineCol = U.rgba(U.mix("#ffffff", "#8090b0", L.dark), 0.6);
    // пятна активности рыбы (пузыри / бой хищника)
    if (v.spots) for (const s of v.spots) {
      if (s.type === "bubbles" && Math.random() < dt * 4) R.bubbles(s.X, s.Z, 1);
      if (s.type === "boil" && Math.random() < dt * 1.3) { R.splash(s.X + (Math.random() - 0.5) * 2, s.Z + (Math.random() - 0.5) * 2, 0.35); }
    }
    if (v.fedSpot && !v.ice) {
      const q = R.proj(v.fedSpot.X, v.fedSpot.Z);
      ctx.strokeStyle = "rgba(255,210,120," + (0.12 + 0.25 * v.fedSpot.level) + ")"; ctx.setLineDash([4, 5]); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(q.x, q.y, q.s * 1.2, q.s * 0.35, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
    for (let i = R.rings.length - 1; i >= 0; i--) {
      const r = R.rings[i]; r.age += dt; const k = r.age / r.life;
      if (k >= 1) { R.rings.splice(i, 1); continue; }
      if (v.ice) continue;
      const q = R.proj(r.X, r.Z); const rad = q.s * r.size * (0.2 + k * 1.4);
      ctx.strokeStyle = U.rgba(U.mix("#ffffff", "#90a0c0", L.dark), 0.55 * (1 - k)); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(q.x, q.y, rad, rad * 0.28, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.strokeStyle = lineCol; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = R.fx.length - 1; i >= 0; i--) {
      const f = R.fx[i]; f.age += dt;
      if (f.age > f.life) { R.fx.splice(i, 1); if (f.type === "bub") R.ring(f.X, f.Z, 0.12, 0.6); continue; }
      if (f.age < 0 || v.ice) continue;
      const q = R.proj(f.X, f.Z); const rr = Math.max(1, q.s * 0.05 * (0.6 + f.age));
      ctx.moveTo(q.x + rr, q.y - rr * 0.6); ctx.arc(q.x, q.y - rr * 0.6, rr, 0, Math.PI * 2);
    }
    ctx.stroke();
    // прыжки рыбы вдали
    for (let i = R.jumps.length - 1; i >= 0; i--) {
      const j = R.jumps[i]; j.age += dt;
      if (j.age > 0.8) { R.jumps.splice(i, 1); R.ring(j.X, j.Z, 0.7, 2); continue; }
      if (v.ice) continue;
      const q = R.proj(j.X, j.Z); const k = j.age / 0.8;
      const hgt = Math.sin(k * Math.PI) * q.s * 0.5;
      ctx.fillStyle = U.mix("#c8d0d8", "#202838", L.dark);
      ctx.save(); ctx.translate(q.x + (k - 0.5) * q.s * 0.6 * j.dir, q.y - hgt); ctx.rotate((k - 0.5) * 2 * j.dir);
      ctx.beginPath(); ctx.ellipse(0, 0, Math.max(2, q.s * 0.14), Math.max(1, q.s * 0.04), 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      if (j.age < dt * 1.5) R.ring(j.X, j.Z, 0.4, 1.2);
    }
  };

  // ---------- Снасть: удилище, леска, поплавок, рыба ----------
  function rodGeom(v) {
    const m = v.mode;
    let base, tip;
    if (m === "feeder") { base = { x: W * 1.02, y: H * 1.02 }; tip = { x: W * 0.3, y: H * 0.5 }; }
    else if (m === "spin") { base = { x: W * 0.98, y: H * 1.06 }; tip = { x: W * 0.56, y: H * 0.56 }; }
    else if (m === "ice") { base = { x: W * 1.0, y: H * 0.95 }; tip = { x: W * 0.7, y: H * 0.55 }; }
    else { base = { x: W * 0.92, y: H * 1.06 }; tip = { x: W * 0.55, y: H * 0.47 }; }
    const rod = v.rod || {};
    tip.x += (rod.tilt || 0) * W * 0.24;
    tip.y += (rod.lift || 0) * H * 0.05;
    return { base, tip };
  }
  R.rodTip = function (v) { const g = rodGeom(v); return g.tip; };

  R.drawTackle = function (v, L, t) {
    const rod = v.rod || {};
    const G = rodGeom(v);
    const night = L.dark > 0.35;
    const lineCol = U.rgba(U.mix("#f4f8fb", "#8aa0c8", L.dark * 0.8), 0.75);
    let target = null; // точка, куда уходит леска
    const tk = v.tackle || {};
    if (v.ice) {
      if (v.ice.noHole || v.ice.drill != null) R.drawDrill(v, L, t);
      else {
        const h = R.drawHole(v, L, t);
        target = { x: h.x + (v.fish && v.fish.hooked ? Math.sin(t * 7) * h.rx * 0.2 : 0), y: h.y + h.ry * 0.35 };
      }
    } else if (tk.state === "fly") {
      const k = tk.flyT;
      const p = R.proj(tk.X, tk.Z);
      const x = U.lerp(G.tip.x, p.x, k), y = U.lerp(G.tip.y, p.y, k) - Math.sin(k * Math.PI) * H * 0.22;
      target = { x, y, air: true };
      ctx.fillStyle = v.mode === "float" ? "#f04a2a" : "#ddd"; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
    } else if (tk.state === "water" || tk.state === "fight") {
      const X = v.fish && v.fish.hooked ? v.fish.X : tk.X, Z = v.fish && v.fish.hooked ? v.fish.Z : tk.Z;
      const p = R.proj(X, Z);
      target = { x: p.x, y: p.y, s: p.s, X, Z };
    }

    // натяжение изгибает удилище к цели
    const bend = U.clamp(rod.bend || 0, 0, 1.4);
    let tip = { x: G.tip.x, y: G.tip.y };
    if (target && !target.air) {
      const dx = target.x - tip.x, dy = target.y - tip.y, d = Math.hypot(dx, dy) || 1;
      tip.x += dx / d * bend * 26; tip.y += dy / d * bend * 26 + bend * 18;
    }
    if (rod.jerk) { tip.y += rod.jerk * 14; tip.x -= rod.jerk * 6; }
    // кивок у зимней удочки / квивертип у фидера
    let lineFrom = tip;
    if (v.mode === "ice") {
      const nod = rod.nod || 0; // -1 подъём, +1 вниз
      const kl = W * 0.2;
      const kx = tip.x - kl * Math.cos(nod * 0.5), ky = tip.y + kl * Math.sin(nod * 0.5) + bend * 14;
      ctx.strokeStyle = U.mix("#2a2a2a", "#4a5470", L.dark); ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.quadraticCurveTo(tip.x - kl * 0.5, tip.y + nod * 10, kx, ky); ctx.stroke();
      if (night) R.glow(kx, ky, 16);
      ctx.fillStyle = night ? "#7aff6a" : "#ff3a1a";
      ctx.beginPath(); ctx.arc(kx, ky, 5, 0, Math.PI * 2); ctx.fill();
      lineFrom = { x: kx, y: ky };
    }

    // леска
    if (target) {
      const sag = (1 - U.clamp(rod.tension || 0, 0, 1)) * (target.air ? 0 : 40) + 4;
      ctx.strokeStyle = lineCol; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(lineFrom.x, lineFrom.y);
      ctx.quadraticCurveTo((lineFrom.x + target.x) / 2, Math.max(lineFrom.y, target.y) + sag, target.x, target.y); ctx.stroke();
    }

    // поплавок / рыба / приманка
    if (!v.ice && target && !target.air) {
      if (v.fish && v.fish.hooked) R.drawFightFish(v, L, t, target);
      else if (v.mode === "float") R.drawFloat(target, tk, L, t, night);
      else if (v.mode === "spin" && tk.reeling) { ctx.strokeStyle = U.rgba("#ffffff", 0.35); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(target.x - target.s * 0.4, target.y + 2); ctx.lineTo(target.x, target.y); ctx.lineTo(target.x + target.s * 0.4, target.y + 2); ctx.stroke(); }
      else { ctx.fillStyle = U.rgba("#ffffff", 0.3); ctx.beginPath(); ctx.ellipse(target.x, target.y, 3, 1, 0, 0, Math.PI * 2); ctx.fill(); }
    }
    if (v.landing) R.drawLanding(v, L, t);

    // удилище
    const bx = G.base.x, by = G.base.y;
    const mx = (bx + tip.x) / 2 - (tip.y - by) * 0.04 * bend, my = (by + tip.y) / 2 + bend * 40 + 10;
    const rodCol = { float: "#2a2420", feeder: "#22384a", spin: "#1a1a1c", ice: "#c8a46a" }[v.mode];
    if (v.mode === "feeder") { // подставка (род-под)
      const p = qb(bx, by, mx, my, tip.x, tip.y, 0.42);
      ctx.strokeStyle = U.mix("#6a6e74", "#1a2030", L.dark * 0.8); ctx.lineWidth = 4; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(p.x - 18, H + 10); ctx.lineTo(p.x, p.y + 4); ctx.lineTo(p.x + 18, H + 10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(p.x - 10, p.y - 4); ctx.lineTo(p.x, p.y + 4); ctx.lineTo(p.x + 10, p.y - 4); ctx.stroke();
    }
    // удилище — одна сужающаяся фигура вдоль кривой (вершинка фидера — отдельно)
    const w0 = v.mode === "ice" ? 8 : v.mode === "feeder" ? 10 : 9, w1 = v.mode === "feeder" ? 2.6 : 1.6;
    const rodPoly = function (a0, a1, col) {
      const n = 10, left = [], right = [];
      for (let i = 0; i <= n; i++) {
        const tt = U.lerp(a0, a1, i / n);
        const p = qb(bx, by, mx, my, tip.x, tip.y, tt), q = qb(bx, by, mx, my, tip.x, tip.y, Math.min(1, tt + 0.01));
        let nx = -(q.y - p.y), ny = q.x - p.x; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
        const hw = U.lerp(w0, w1, tt) / 2;
        left.push([p.x + nx * hw, p.y + ny * hw]); right.push([p.x - nx * hw, p.y - ny * hw]);
      }
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(left[0][0], left[0][1]);
      for (let i = 1; i <= n; i++) ctx.lineTo(left[i][0], left[i][1]);
      for (let i = n; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
      ctx.closePath(); ctx.fill();
    };
    const body = U.mix(rodCol, "#000000", L.dark * 0.5);
    if (v.mode === "feeder") {
      rodPoly(0, 0.8, body);
      rodPoly(0.8, 1, U.mix(night ? "#7aff6a" : "#ff6a12", "#000000", L.dark * 0.3));
      if (!night) { rodPoly(0.86, 0.9, "#ffffff"); rodPoly(0.94, 0.97, "#ffffff"); }
    } else rodPoly(0, 1, body);
    // кольца одним контуром
    ctx.strokeStyle = U.mix("#c8ccd0", "#303848", L.dark); ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 1; i < 6; i++) { const p = qb(bx, by, mx, my, tip.x, tip.y, 0.3 + i * 0.12), r2 = 2.5 - i * 0.25; ctx.moveTo(p.x + r2, p.y - 3); ctx.arc(p.x, p.y - 3, r2, 0, Math.PI * 2); }
    ctx.stroke();
    // колокольчик донки
    if (v.mode === "feeder") {
      const p = qb(bx, by, mx, my, tip.x, tip.y, 0.9);
      ctx.fillStyle = "#d8b04a"; ctx.beginPath(); ctx.arc(p.x, p.y + 6 + Math.sin(t * 30) * (rod.ring || 0) * 3, 4, 0, Math.PI); ctx.fill();
    }
    // катушка
    {
      const p = qb(bx, by, mx, my, tip.x, tip.y, v.mode === "ice" ? 0.12 : 0.1);
      const rr = v.mode === "ice" ? 13 : 20;
      ctx.save(); ctx.translate(p.x - 2, p.y + rr * 0.9);
      const gg = ctx.createLinearGradient(-rr, -rr, rr, rr); gg.addColorStop(0, U.mix("#c8ccd4", "#202838", L.dark * 0.7)); gg.addColorStop(1, U.mix("#5a606a", "#05080e", L.dark * 0.7));
      ctx.fillStyle = gg; ctx.beginPath(); ctx.ellipse(0, 0, rr * 0.75, rr, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = U.mix("#e04a28", "#301010", L.dark * 0.6); ctx.beginPath(); ctx.ellipse(0, 0, rr * 0.35, rr * 0.5, 0.3, 0, Math.PI * 2); ctx.fill();
      const ang = (rod.reelAngle || 0);
      ctx.strokeStyle = U.mix("#d8dce0", "#303848", L.dark * 0.7); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ang) * rr * 1.1, Math.sin(ang) * rr * 0.6); ctx.stroke();
      ctx.fillStyle = "#222"; ctx.beginPath(); ctx.arc(Math.cos(ang) * rr * 1.1, Math.sin(ang) * rr * 0.6, 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  };
  function qb(x0, y0, x1, y1, x2, y2, t) { const a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t; return { x: a * x0 + b * x1 + c * x2, y: a * y0 + b * y1 + c * y2 }; }

  R.drawFloat = function (p, tk, L, t, night) {
    const z = tk.Z;
    const hgt = U.clamp(30 * Math.pow(10 / z, 0.65), 11, 34);
    const sink = tk.sink || 0, tilt = tk.tilt || 0;
    const bob = Math.sin(t * 2.1) * 0.6 + (tk.bob || 0);
    const x = p.x + (tk.dx || 0), y = p.y + bob;
    const w = Math.max(2.2, hgt * 0.13);
    // отражение
    ctx.save(); ctx.globalAlpha = 0.25 * (1 - Math.abs(sink));
    ctx.fillStyle = "#ff6a3a"; ctx.fillRect(x - w / 2, y + 1, w, hgt * 0.35 * (1 - sink));
    ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.rect(x - hgt * 2, y - hgt * 3, hgt * 4, hgt * 3 + 0.5); ctx.clip(); // выше воды
    ctx.translate(x, y + hgt * Math.max(0, sink));
    ctx.rotate(-tilt * 1.35);
    const up = sink < 0 ? -sink : 0;
    // тело поплавка (видно, если поднят)
    if (up > 0) { ctx.fillStyle = "#f4f0e8"; ctx.beginPath(); ctx.ellipse(0, -hgt * 0.05, w * 1.6, hgt * 0.5 * up + 1, 0, 0, Math.PI * 2); ctx.fill(); }
    const top = -hgt * (1 + up * 0.5);
    ctx.fillStyle = "#f6f6f2"; ctx.fillRect(-w / 2, top + hgt * 0.45, w, hgt * 0.55 + up * hgt * 0.5);
    if (night) { R.glow(0, top + hgt * 0.22, hgt * 0.9); ctx.fillStyle = "#9aff7a"; }
    else ctx.fillStyle = "#ff3d12";
    ctx.beginPath(); ctx.roundRect(-w / 2, top, w, hgt * 0.47, w / 2); ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(-w / 2, top + hgt * 0.45, w, Math.max(1, hgt * 0.05));
    ctx.restore();
    // кольцо у основания
    ctx.strokeStyle = U.rgba(U.mix("#ffffff", "#90a0c0", L.dark), 0.4 + Math.abs(tk.bob || 0) * 0.1); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(x, y + 1, w * 2.2, w * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
  };

  R.drawFightFish = function (v, L, t, p) {
    const f = v.fish;
    const night = L.dark > 0.35;
    // бурун и усы от движения
    const sp = Math.min(1, Math.hypot(f.vx || 0, f.vz || 0) / 2);
    const s = p.s;
    ctx.strokeStyle = U.rgba(U.mix("#ffffff", "#8090b0", L.dark), 0.25 + sp * 0.4); ctx.lineWidth = 1.2;
    const dirx = -(f.vx || 0) >= 0 ? 1 : -1;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + dirx * s * 0.8 * sp + s * 0.3, p.y + s * 0.12 * sp + 2); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + dirx * s * 0.8 * sp - s * 0.3, p.y + s * 0.12 * sp + 2); ctx.stroke();
    if (Math.random() < 0.1 + sp * 0.25) R.ring(f.X, f.Z, 0.25 + f.surface * 0.5, 1);
    // силуэт рыбы под водой рядом с берегом
    const lenPx = Math.max(26, f.lenM * s * 1.1);
    if (f.Z < 9 && !f.jump) {
      const a = U.clamp(1 - (f.Z - 3) / 6, 0.15, 1) * (0.3 + f.surface * 0.4);
      FZ.Art.drawFish(ctx, f.s, p.x, p.y + 6 + (1 - f.surface) * 10, lenPx, { silhouette: f.surface < 0.6, alpha: f.surface < 0.6 ? a : 0.85, phase: t * 9, amp: 0.25 + sp * 0.3, dir: (f.vx || 0) > 0 ? -1 : 1, roll: f.surface > 0.8 ? 0.15 : 0 });
    }
    if (f.jump) {
      const k = f.jump.k;
      const hgt = Math.sin(k * Math.PI) * Math.max(40, lenPx * 1.1);
      ctx.save();
      FZ.Art.drawFish(ctx, f.s, p.x + (k - 0.5) * lenPx * 0.7 * (f.jump.dir || 1), p.y - hgt, lenPx * 1.15, { phase: t * 16, amp: 0.55, dir: f.jump.dir || 1, roll: (k - 0.5) * 1.6 * (f.jump.dir || 1) });
      ctx.restore();
    }
    if (night) { ctx.fillStyle = "rgba(160,255,140,0.6)"; }
  };

  R.drawLanding = function (v, L, t) {
    const ld = v.landing; const k = ld.k;
    const cx = W * 0.5, cy = U.lerp(H * 0.72, H * 0.52, U.easeOut(k));
    const f = v.fish;
    const lenPx = Math.min(W * 0.8, Math.max(80, (f ? f.lenM : 0.3) * 330));
    if (!v.ice) {
      // подсачек
      ctx.strokeStyle = U.mix("#3a3a3a", "#101418", L.dark); ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(W * 1.05, H * 1.05); ctx.lineTo(cx + lenPx * 0.45, cy + 22); ctx.stroke();
      ctx.strokeStyle = U.mix("#2a2a2a", "#05080c", L.dark); ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(cx, cy + 20, lenPx * 0.55, lenPx * 0.16, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = "rgba(40,40,40,0.5)"; ctx.lineWidth = 1;
      for (let i = -5; i <= 5; i++) { ctx.beginPath(); ctx.moveTo(cx + i * lenPx * 0.1, cy + 20 - lenPx * 0.15 * Math.sqrt(1 - (i / 5.5) * (i / 5.5))); ctx.quadraticCurveTo(cx + i * lenPx * 0.06, cy + 70, cx, cy + 80); ctx.stroke(); }
    }
    if (f) FZ.Art.drawFish(ctx, f.s, cx, cy, lenPx, { phase: t * 12, amp: 0.35 * (1 - k * 0.5), dir: 1, roll: Math.sin(t * 5) * 0.08 });
    if (Math.random() < 0.5) R.parts.push({ x: cx + (Math.random() - 0.5) * lenPx, y: cy, vx: (Math.random() - 0.5) * 60, vy: -Math.random() * 80, life: 0.6, age: 0, r: 1.5 + Math.random() * 2, col: "rgba(230,242,250,0.9)", g: 500, floor: H });
  };

  // ---------- Погода ----------
  let drops = [];
  R.drawWeather = function (v, L, t, dt, wx) {
    const rain = wx.sky === "rain" || wx.sky === "storm", snow = wx.sky === "snow" || (v.ice && wx.sky === "overcast");
    if (!rain && !snow) { drops.length = 0; return; }
    const n = rain ? (wx.sky === "storm" ? 140 : 80) : 70;
    while (drops.length < n) drops.push({ x: Math.random() * W, y: Math.random() * H, s: Math.random() });
    const wind = (wx.wind / 10) * (wx.dir.indexOf("З") >= 0 ? 1 : -1);
    ctx.strokeStyle = U.rgba(U.mix("#dfe8f2", "#7080a0", L.dark), 0.45); ctx.lineWidth = 1;
    ctx.fillStyle = U.rgba("#ffffff", 0.85 - L.dark * 0.3);
    if (rain) ctx.beginPath();
    for (const d of drops) {
      if (rain) {
        d.y += (520 + d.s * 300) * dt; d.x += wind * 160 * dt;
        ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + wind * 6, d.y + 10 + d.s * 6);
        if (d.y > H || d.y > shoreY + (H - shoreY) * d.s && d.y > shoreY && Math.random() < dt * 3) {
          if (d.y > shoreY && !v.ice) { const w = R.unproj(d.x, d.y); if (Math.random() < 0.35) R.ring(w.X, w.Z, 0.15, 0.5); }
          d.y = -10; d.x = Math.random() * W;
        }
      } else {
        d.y += (40 + d.s * 50) * dt; d.x += (Math.sin(t + d.s * 9) * 20 + wind * 60) * dt;
        ctx.globalAlpha = 0.5 + d.s * 0.5; ctx.fillRect(d.x, d.y, 1.5 + d.s * 2, 1.5 + d.s * 2);
        if (d.y > H) { d.y = -5; d.x = Math.random() * W; }
      }
    }
    if (rain) ctx.stroke();
    ctx.globalAlpha = 1;
    if (wx.sky === "storm" && Math.random() < dt * 0.08) R.flash = 1;
    if (R.flash > 0) { ctx.fillStyle = "rgba(230,235,255," + R.flash * 0.5 + ")"; ctx.fillRect(0, 0, W, H); R.flash -= dt * 3; if (R.flash > 0.95 && FZ.Sound) FZ.Sound.thunder(); }
  };

  // Частицы в экранных координатах
  R.drawScreenFx = function (dt) {
    for (let i = R.parts.length - 1; i >= 0; i--) {
      const p = R.parts[i]; p.age += dt;
      if (p.age > p.life) { R.parts.splice(i, 1); continue; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.y > p.floor && p.vy > 0) { R.parts.splice(i, 1); continue; }
      ctx.globalAlpha = 1 - p.age / p.life; ctx.fillStyle = p.col;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  // Прицел заброса
  R.drawAim = function (v, aim) {
    if (!aim) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const G = rodGeom(v);
    const p = R.proj(aim.X, aim.Z);
    ctx.strokeStyle = aim.ok ? "rgba(255,255,255,0.75)" : "rgba(255,120,100,0.8)"; ctx.setLineDash([5, 6]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(G.tip.x, G.tip.y); ctx.quadraticCurveTo((G.tip.x + p.x) / 2, Math.min(G.tip.y, p.y) - 60, p.x, p.y); ctx.stroke();
    ctx.setLineDash([]);
    const r = Math.max(10, p.s * 0.9);
    ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * 0.3, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(p.x, p.y, r * 0.35, r * 0.1, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return p;
  };

  // Миниатюра водоёма для карты
  const thumbs = {};
  R.thumb = function (loc, season) {
    const key = loc.id + season;
    if (thumbs[key]) return thumbs[key];
    const S = 112, c = document.createElement("canvas"); c.width = c.height = S * 2;
    const g = c.getContext("2d"); g.scale(2, 2);
    const hz = S * 0.55;
    const sk = g.createLinearGradient(0, 0, 0, hz); sk.addColorStop(0, season === "winter" ? "#8fb0d4" : "#5d97d6"); sk.addColorStop(1, season === "winter" ? "#e4ecf4" : "#cfe6f4");
    g.fillStyle = sk; g.fillRect(0, 0, S, hz);
    const img = FZ.Assets.bg(loc.id, season);
    const src = img || buildLand(loc, season);
    const sw = img ? img.width : src.width, sh = img ? img.height * FZ.Assets.waterline(loc.id, season) : src.height;
    const cw = sw * 0.5, ch = Math.min(sh, cw * hz / S);
    g.drawImage(src, (sw - cw) / 2, sh - ch, cw, ch, 0, 0, S, hz);
    if (season === "winter") { const ig = g.createLinearGradient(0, hz, 0, S); ig.addColorStop(0, "#c9d6e4"); ig.addColorStop(1, "#f6f9fc"); g.fillStyle = ig; g.fillRect(0, hz, S, S - hz); }
    else {
      g.save(); g.translate(0, hz * 2); g.scale(1, -1); g.globalAlpha = 0.55; g.drawImage(c, 0, 0, S * 2, hz * 2, 0, 0, S, hz); g.restore();
      const wg = g.createLinearGradient(0, hz, 0, S); wg.addColorStop(0, "rgba(40,80,100,0.25)"); wg.addColorStop(1, "rgba(15,40,52,0.85)"); g.fillStyle = wg; g.fillRect(0, hz, S, S - hz);
    }
    try { thumbs[key] = c.toDataURL("image/jpeg", 0.85); } catch (e) { thumbs[key] = ""; }
    return thumbs[key];
  };

  // Зелёное свечение светлячка (заранее нарисованный спрайт вместо дорогой тени)
  let glowC = null;
  R.glow = function (x, y, r) {
    if (!glowC) {
      glowC = document.createElement("canvas"); glowC.width = glowC.height = 64;
      const g = glowC.getContext("2d"); const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
      gr.addColorStop(0, "rgba(160,255,140,0.95)"); gr.addColorStop(0.3, "rgba(120,255,100,0.45)"); gr.addColorStop(1, "rgba(120,255,100,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    }
    const op = ctx.globalCompositeOperation; ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(glowC, x - r, y - r, r * 2, r * 2); ctx.globalCompositeOperation = op;
  };

  R.shake = function (a) { R.shakeA = Math.max(R.shakeA, a); };
  R.clearFx = function () { R.fx.length = 0; R.rings.length = 0; R.parts.length = 0; R.jumps.length = 0; };

  // Снимок сцены (для карточки трофея)
  R.snapshot = function () { return cv; };

  FZ.Scene = R;
})(window.FZ);
