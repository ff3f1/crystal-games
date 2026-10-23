/* Рисованные рыбы и иконки снастей (работают без картинок; если есть сгенерированный спрайт — берётся он). */
(function (FZ) {
  "use strict";
  const U = FZ.U;
  const A = {};

  // Профили тела: точки [t, y] (t — доля длины тела от носа, y — доля полувысоты)
  const PROFILES = {
    normal: { top: [[0, -0.05], [0.07, -0.5], [0.22, -0.9], [0.42, -1], [0.62, -0.8], [0.78, -0.42], [0.86, -0.2]],
      bot: [[0.86, 0.2], [0.76, 0.42], [0.56, 0.82], [0.36, 0.97], [0.18, 0.8], [0.06, 0.45], [0, 0.08]] },
    big: { top: [[0, -0.02], [0.05, -0.6], [0.18, -0.95], [0.36, -1], [0.6, -0.78], [0.78, -0.42], [0.86, -0.22]],
      bot: [[0.86, 0.22], [0.74, 0.46], [0.55, 0.85], [0.32, 1], [0.15, 0.85], [0.05, 0.5], [0, 0.12]] },
    small: { top: [[0, -0.1], [0.08, -0.45], [0.25, -0.88], [0.45, -1], [0.64, -0.8], [0.79, -0.42], [0.86, -0.2]],
      bot: [[0.86, 0.2], [0.76, 0.42], [0.56, 0.84], [0.38, 0.96], [0.2, 0.78], [0.07, 0.4], [0, 0.02]] },
    bream: { top: [[0, -0.12], [0.08, -0.42], [0.2, -0.8], [0.4, -1], [0.6, -0.82], [0.78, -0.42], [0.86, -0.18]],
      bot: [[0.86, 0.18], [0.74, 0.5], [0.56, 0.92], [0.4, 1], [0.22, 0.74], [0.08, 0.34], [0, 0.0]] },
    pike: { top: [[0, -0.02], [0.12, -0.22], [0.28, -0.55], [0.5, -0.86], [0.66, -1], [0.79, -0.6], [0.88, -0.3]],
      bot: [[0.88, 0.3], [0.78, 0.72], [0.6, 0.98], [0.36, 0.82], [0.16, 0.45], [0.05, 0.18], [0, 0.05]] },
    asp: { top: [[0, -0.08], [0.1, -0.4], [0.26, -0.82], [0.44, -1], [0.64, -0.78], [0.79, -0.42], [0.87, -0.2]],
      bot: [[0.87, 0.2], [0.76, 0.42], [0.56, 0.84], [0.36, 0.96], [0.18, 0.72], [0.06, 0.32], [0, 0.12]] },
    taimen: { top: [[0, -0.04], [0.1, -0.38], [0.26, -0.78], [0.46, -1], [0.66, -0.8], [0.8, -0.44], [0.88, -0.24]],
      bot: [[0.88, 0.24], [0.77, 0.46], [0.56, 0.86], [0.36, 0.98], [0.18, 0.78], [0.06, 0.36], [0, 0.1]] },
    smelt: { top: [[0, -0.08], [0.1, -0.45], [0.3, -0.92], [0.48, -1], [0.66, -0.8], [0.8, -0.44], [0.87, -0.22]],
      bot: [[0.87, 0.22], [0.76, 0.44], [0.56, 0.86], [0.36, 0.98], [0.18, 0.76], [0.06, 0.34], [0, 0.1]] },
    cat: { top: [[0, 0.08], [0.04, -0.62], [0.14, -0.96], [0.3, -1], [0.55, -0.72], [0.8, -0.44], [0.9, -0.32]],
      bot: [[0.9, 0.32], [0.7, 0.62], [0.45, 0.92], [0.24, 1], [0.1, 0.86], [0.03, 0.48], [0, 0.2]] },
    burbot: { top: [[0, 0], [0.05, -0.55], [0.15, -0.92], [0.3, -1], [0.55, -0.8], [0.8, -0.5], [0.9, -0.36]],
      bot: [[0.9, 0.36], [0.72, 0.62], [0.48, 0.9], [0.26, 1], [0.12, 0.84], [0.04, 0.46], [0, 0.14]] },
    stur: { top: [[0, 0.02], [0.1, -0.24], [0.26, -0.74], [0.45, -1], [0.7, -0.76], [0.86, -0.36], [0.91, -0.22]],
      bot: [[0.91, 0.18], [0.76, 0.44], [0.5, 0.86], [0.3, 0.82], [0.16, 0.42], [0.06, 0.12], [0, 0.04]] }
  };

  // Сглаженная кривая через точки (Catmull-Rom → Безье)
  function curveThrough(ctx, pts, moveFirst) {
    if (moveFirst) ctx.moveTo(pts[0][0], pts[0][1]); else ctx.lineTo(pts[0][0], pts[0][1]);
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
    }
  }

  // Профиль: интерполяция высоты по t
  function profAt(arr, t) {
    for (let i = 0; i < arr.length - 1; i++) {
      const a = arr[i], b = arr[i + 1];
      const lo = Math.min(a[0], b[0]), hi = Math.max(a[0], b[0]);
      if (t >= lo && t <= hi) { const k = (t - a[0]) / (b[0] - a[0] || 1); return a[1] + (b[1] - a[1]) * k; }
    }
    return 0;
  }

  /* Нарисовать рыбу. Голова слева. (x,y) — центр, len — полная длина с хвостом.
     o: {phase, amp (изгиб), silhouette, alpha, dir (1 — голова влево, -1 — вправо), roll} */
  A.drawFish = function (ctx, s, x, y, len, o) {
    o = o || {};
    if (!o.direct) {
      // готовый спрайт: сгенерированный или нарисованный кодом один раз (рисовать рыбу каждый кадр дорого)
      const sprite = !o.silhouette && FZ.Assets && FZ.Assets.fish(s.id);
      if (sprite) return A.drawSprite(ctx, sprite, x, y, len, o, s);
      const need = len * 2, size = need <= 300 ? 320 : need <= 640 ? 640 : 1280;
      return A.drawSprite(ctx, A.procSprite(s, !!o.silhouette, size), x, y, len / PROC_K, o, s);
    }
    const L = s.look;
    const P = PROFILES[L.head === "normal" ? (L.h > 0.4 ? "big" : "normal") : L.head] || PROFILES.normal;
    const bodyL = len * 0.84;
    const H = bodyL * L.h / 2;
    const ph = o.phase || 0, amp = o.amp == null ? 0 : o.amp;
    const wig = (t) => Math.sin(ph - t * 3.2) * amp * H * 0.9 * t * t;
    const X = (t) => -len / 2 + t * bodyL;
    const pt = (t, yy) => [X(t), yy * H + wig(t)];

    ctx.save();
    ctx.translate(x, y);
    if (o.dir === -1) ctx.scale(-1, 1);
    if (o.roll) ctx.rotate(o.roll);
    ctx.globalAlpha *= (o.alpha == null ? 1 : o.alpha);
    const sil = !!o.silhouette;
    const finCol = sil ? "rgba(20,30,36,0.9)" : L.fin;
    const finFill = function (path) {
      ctx.beginPath(); path(); ctx.closePath();
      if (sil) { ctx.fillStyle = finCol; ctx.fill(); return; }
      const g = ctx.createLinearGradient(-len / 2, -H, len / 2, H);
      g.addColorStop(0, U.rgba(L.fin, 0.95)); g.addColorStop(1, U.rgba(U.shade(L.fin, -0.25), 0.85));
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = U.rgba(U.shade(L.fin, -0.45), 0.5); ctx.lineWidth = Math.max(0.5, len * 0.004); ctx.stroke();
    };
    const rays = function (from, tips) { // лучи плавника
      if (sil || len < 50) return;
      ctx.strokeStyle = U.rgba(U.shade(L.fin, -0.4), 0.35); ctx.lineWidth = Math.max(0.5, len * 0.003);
      ctx.beginPath(); tips.forEach(function (tp, i) { const f = from[Math.min(i, from.length - 1)]; ctx.moveTo(f[0], f[1]); ctx.lineTo(tp[0], tp[1]); }); ctx.stroke();
    };

    // --- Хвост ---
    const tb = P.top[P.top.length - 1][0];
    const pedT = pt(tb, P.top[P.top.length - 1][1]), pedB = pt(tb, P.bot[0][1]);
    const tw = wig(1) * 1.2, tx = len / 2;
    const tailH = H * (L.tail === "cat" ? 0.55 : L.tail === "stur" ? 1.1 : 1.05);
    finFill(function () {
      if (L.tail === "round" || L.tail === "cat") {
        ctx.moveTo(pedT[0], pedT[1]);
        ctx.quadraticCurveTo(tx - len * 0.02, -tailH * 1.05 + tw, tx, tw);
        ctx.quadraticCurveTo(tx - len * 0.02, tailH * 1.05 + tw, pedB[0], pedB[1]);
      } else if (L.tail === "stur") {
        ctx.moveTo(pedT[0], pedT[1]);
        ctx.quadraticCurveTo(tx - len * 0.05, -tailH * 0.9 + tw, tx + len * 0.01, -tailH * 1.25 + tw);
        ctx.quadraticCurveTo(tx - len * 0.06, -tailH * 0.1 + tw, tx - len * 0.07, tailH * 0.55 + tw);
        ctx.quadraticCurveTo(tx - len * 0.1, tailH * 0.3 + tw, pedB[0], pedB[1]);
      } else {
        ctx.moveTo(pedT[0], pedT[1]);
        ctx.quadraticCurveTo(tx - len * 0.06, -tailH * 0.55 + tw * 0.8, tx + len * 0.005, -tailH + tw);
        ctx.quadraticCurveTo(tx - len * 0.05, -tailH * 0.25 + tw, tx - len * 0.065, tw);
        ctx.quadraticCurveTo(tx - len * 0.05, tailH * 0.25 + tw, tx + len * 0.005, tailH + tw);
        ctx.quadraticCurveTo(tx - len * 0.06, tailH * 0.55 + tw * 0.8, pedB[0], pedB[1]);
      }
    });
    rays([[pedT[0], (pedT[1] + pedB[1]) / 2]], [[tx, -tailH * 0.8 + tw], [tx - len * 0.02, -tailH * 0.4 + tw], [tx - len * 0.05, tw], [tx - len * 0.02, tailH * 0.4 + tw], [tx, tailH * 0.8 + tw]]);

    // --- Спинные плавники ---
    const dorsal = function (t0, t1, hgt, peakAt, spiny) {
      const a = pt(t0, profAt(P.top, t0) + 0.04), b = pt(t1, profAt(P.top, t1) + 0.04);
      const pk = U.lerp(t0, t1, peakAt == null ? 0.3 : peakAt);
      const c = pt(pk, profAt(P.top, pk) - hgt);
      finFill(function () {
        ctx.moveTo(a[0], a[1]);
        if (spiny) {
          const n = 7;
          for (let i = 0; i <= n; i++) {
            const tt = U.lerp(t0, t1, i / n);
            const base = profAt(P.top, tt);
            const hh = hgt * Math.sin(Math.PI * Math.min(1, (i + 0.6) / n)) * 0.95;
            const p = pt(tt, base - hh); ctx.lineTo(p[0], p[1]);
            if (i < n) { const q = pt(tt + (t1 - t0) / n / 2, base - hh * 0.62); ctx.lineTo(q[0], q[1]); }
          }
          ctx.lineTo(b[0], b[1]);
        } else {
          ctx.quadraticCurveTo(c[0] - len * 0.02, c[1], c[0], c[1]);
          ctx.quadraticCurveTo(U.lerp(c[0], b[0], 0.6), U.lerp(c[1], b[1], 0.2), b[0], b[1]);
        }
      });
      if (!spiny) { const tips = []; for (let i = 1; i < 5; i++) tips.push(pt(U.lerp(t0, t1, i / 5), profAt(P.top, U.lerp(t0, t1, i / 5)) - hgt * 0.8 * Math.sin(Math.PI * i / 5 + 0.3))); rays([[ (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + H * 0.15 ]], tips); }
    };
    if (L.dorsal === "spiny") { dorsal(0.3, 0.52, 0.55, 0.3, true); dorsal(0.54, 0.72, 0.42, 0.25); }
    else if (L.dorsal === "sail") dorsal(0.28, 0.66, 0.95, 0.65);
    else if (L.dorsal === "back") dorsal(0.66, 0.8, 0.5, 0.25);
    else if (L.dorsal === "long") { dorsal(0.3, 0.42, 0.25, 0.4); dorsal(0.46, 0.86, 0.3, 0.3); }
    else if (L.dorsal === "tiny") dorsal(0.26, 0.31, 0.25, 0.4);
    else if (L.dorsal === "stur") dorsal(0.7, 0.8, 0.5, 0.3);
    else dorsal(0.38, 0.56, 0.62, 0.25);
    if (L.adipose) dorsal(0.74, 0.79, 0.22, 0.5);

    // --- Анальный и брюшные плавники ---
    const belly = function (t0, t1, hgt, peakAt) {
      const a = pt(t0, profAt(P.bot, t0) - 0.04), b = pt(t1, profAt(P.bot, t1) - 0.04);
      const pk = U.lerp(t0, t1, peakAt);
      const c = pt(pk + 0.02, profAt(P.bot, pk) + hgt);
      finFill(function () { ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(c[0] - len * 0.01, c[1], c[0], c[1]); ctx.quadraticCurveTo(U.lerp(c[0], b[0], 0.5), U.lerp(c[1], b[1], 0.3), b[0], b[1]); });
    };
    if (L.tail === "cat" || L.dorsal === "long") belly(0.45, 0.88, 0.32, 0.15);
    else belly(0.6, 0.74, 0.5, 0.3);
    belly(0.38, 0.46, 0.45, 0.4);

    // --- Тело ---
    const topPts = P.top.map((p) => pt(p[0], p[1]));
    const botPts = P.bot.map((p) => pt(p[0], p[1]));
    const bodyPath = function () {
      ctx.beginPath(); curveThrough(ctx, topPts, true);
      ctx.lineTo(botPts[0][0], botPts[0][1]); curveThrough(ctx, botPts, false); ctx.closePath();
    };
    bodyPath();
    if (sil) { ctx.fillStyle = "rgba(20,30,36,0.92)"; ctx.fill(); }
    else {
      const g = ctx.createLinearGradient(0, -H, 0, H);
      g.addColorStop(0, L.back); g.addColorStop(0.42, U.mix(L.back, L.side, 0.75)); g.addColorStop(0.62, L.side); g.addColorStop(1, L.belly);
      ctx.fillStyle = g; ctx.fill();
      ctx.save(); bodyPath(); ctx.clip();
      A.pattern(ctx, s, len, H, pt, P);
      // блик
      const hl = ctx.createLinearGradient(0, -H, 0, H * 0.4);
      hl.addColorStop(0, "rgba(255,255,255,0)"); hl.addColorStop(0.45, "rgba(255,255,255,0.22)"); hl.addColorStop(0.62, "rgba(255,255,255,0)");
      ctx.fillStyle = hl; ctx.fillRect(-len, -H * 1.2, len * 2, H * 2.4);
      // боковая линия
      if (len > 40) {
        ctx.strokeStyle = "rgba(0,0,0,0.18)"; ctx.lineWidth = Math.max(0.6, len * 0.004);
        ctx.beginPath();
        for (let t = 0.22; t <= 0.86; t += 0.04) { const p = pt(t, -0.15 + Math.sin(t * 3) * 0.05); if (t === 0.22) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); }
        ctx.stroke();
      }
      // жаберная крышка
      const gx = L.head === "pike" || L.head === "stur" ? 0.27 : L.head === "cat" || L.head === "burbot" ? 0.17 : 0.2;
      const gr = ctx.createRadialGradient(X(gx) - H * 0.6, 0, H * 0.2, X(gx) - H * 0.4, 0, H * 1.2);
      gr.addColorStop(0, "rgba(255,255,255,0.08)"); gr.addColorStop(1, "rgba(0,0,0,0.12)");
      ctx.fillStyle = gr; ctx.beginPath(); ctx.rect(X(0) - 2, -H * 1.2, X(gx) - X(0) + 2, H * 2.4); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = Math.max(0.7, len * 0.005);
      ctx.beginPath(); const g0 = pt(gx, -0.75), g1 = pt(gx + 0.03, 0), g2 = pt(gx, 0.75);
      ctx.moveTo(g0[0], g0[1]); ctx.quadraticCurveTo(g1[0] + H * 0.25, g1[1], g2[0], g2[1]); ctx.stroke();
      // затемнение снизу для объёма
      const sh = ctx.createLinearGradient(0, H * 0.3, 0, H);
      sh.addColorStop(0, "rgba(0,0,0,0)"); sh.addColorStop(1, "rgba(0,0,0,0.12)");
      ctx.fillStyle = sh; ctx.fillRect(-len, 0, len * 2, H * 1.2);
      ctx.restore();
      ctx.strokeStyle = U.rgba(U.shade(L.back, -0.5), 0.45); ctx.lineWidth = Math.max(0.6, len * 0.004); bodyPath(); ctx.stroke();
    }

    // --- Грудной плавник ---
    const pf = pt(0.24, 0.35);
    finFill(function () {
      ctx.moveTo(pf[0], pf[1] - H * 0.12);
      ctx.quadraticCurveTo(pf[0] + len * 0.08, pf[1] + H * 0.05, pf[0] + len * 0.1, pf[1] + H * 0.38);
      ctx.quadraticCurveTo(pf[0] + len * 0.03, pf[1] + H * 0.3, pf[0], pf[1] + H * 0.1);
    });

    // --- Глаз, рот, усы ---
    const eyeT = L.head === "pike" ? 0.12 : L.head === "stur" ? 0.16 : L.head === "cat" ? 0.06 : 0.075;
    const eyeY = L.head === "cat" || L.head === "burbot" ? -0.45 : -0.28;
    const er = Math.max(1.4, H * (L.head === "cat" ? 0.1 : L.head === "small" || L.head === "smelt" ? 0.26 : 0.22));
    const ep = pt(eyeT, eyeY);
    if (!sil) {
      ctx.fillStyle = L.eye; ctx.beginPath(); ctx.arc(ep[0], ep[1], er, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#0b0f12"; ctx.beginPath(); ctx.arc(ep[0] - er * 0.12, ep[1], er * 0.55, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.beginPath(); ctx.arc(ep[0] - er * 0.35, ep[1] - er * 0.35, er * 0.22, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = Math.max(0.6, len * 0.004);
      ctx.beginPath(); const m0 = pt(0, 0.08), m1 = pt(L.head === "pike" || L.head === "asp" || L.head === "taimen" || L.head === "cat" ? 0.1 : 0.05, 0.12);
      ctx.moveTo(m0[0], m0[1]); ctx.lineTo(m1[0], m1[1]); ctx.stroke();
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.15)"; ctx.beginPath(); ctx.arc(ep[0], ep[1], er * 0.8, 0, Math.PI * 2); ctx.fill();
    }
    if (L.whisk) {
      ctx.strokeStyle = sil ? "rgba(20,30,36,0.9)" : U.rgba(U.shade(L.back, -0.2), 0.9);
      ctx.lineCap = "round";
      const base = pt(0.015, 0.12);
      const n = L.whisk;
      for (let i = 0; i < n; i++) {
        const long = (L.head === "cat" && i < 2) || (L.head === "burbot");
        const ll = long ? len * 0.28 : len * (L.head === "stur" ? 0.05 : 0.06);
        ctx.lineWidth = Math.max(0.8, len * (long ? 0.008 : 0.005));
        const ang = (L.head === "stur" ? 1.6 : 2.2) + i * 0.25 + Math.sin(ph * 0.7 + i) * 0.08;
        const bx = L.head === "stur" ? pt(0.08 + i * 0.012, 0.1)[0] : base[0];
        const by = L.head === "stur" ? pt(0.08, 0.15)[1] : base[1];
        ctx.beginPath(); ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(bx - ll * 0.5 * Math.cos(ang - 2.2 + 1.6), by + ll * 0.4, bx + Math.cos(ang) * ll * 0.8, by + Math.sin(ang) * ll * 0.8 + ll * 0.2);
        ctx.stroke();
      }
    }
    ctx.restore();
  };

  // Узоры на теле (рисуются внутри клипа тела)
  A.pattern = function (ctx, s, len, H, pt, P) {
    const L = s.look, pat = L.pat;
    const r = U.rng(s.id);
    const dark = U.rgba(U.shade(L.back, -0.35), 0.55);
    // чешуя у карповых и окуневых
    const scaly = !(pat === "mottle" || pat === "scutes" || L.head === "cat" || L.head === "burbot" || s.id === "tench" || s.id === "smelt");
    if (scaly && len > 60) {
      const sz = Math.max(3, H * (s.look.h > 0.35 ? 0.16 : 0.2));
      ctx.strokeStyle = "rgba(0,0,0,0.07)"; ctx.lineWidth = Math.max(0.5, len * 0.0025);
      for (let yy = -H; yy < H; yy += sz * 0.7) {
        const off = (Math.round((yy + H) / (sz * 0.7)) % 2) * sz * 0.5;
        for (let xx = -len * 0.32 + off; xx < len * 0.36; xx += sz) { ctx.beginPath(); ctx.arc(xx, yy, sz * 0.55, -0.9, 0.9); ctx.stroke(); }
      }
    }
    if (pat === "stripes") {
      ctx.fillStyle = U.rgba(U.shade(L.back, -0.4), 0.55);
      for (let i = 0; i < 6; i++) {
        const t = 0.28 + i * 0.095;
        const a = pt(t - 0.025, -1.2), b = pt(t + 0.025, -1.2), c = pt(t + 0.012 + (i % 2) * 0.01, 0.45), d = pt(t - 0.008, 0.45);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.fill();
      }
    } else if (pat === "bands") {
      ctx.fillStyle = U.rgba(U.shade(L.back, -0.3), 0.32);
      for (let i = 0; i < 9; i++) { const t = 0.26 + i * 0.065; const a = pt(t, -1.2), c = pt(t + 0.02, 0.3); ctx.beginPath(); ctx.ellipse((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, len * 0.012, H * 0.7, 0.1, 0, Math.PI * 2); ctx.fill(); }
    } else if (pat === "pike") {
      ctx.fillStyle = "rgba(246,240,200,0.55)";
      for (let i = 0; i < 70; i++) { const t = r.range(0.2, 0.84), yy = r.range(-0.75, 0.45); const p = pt(t, yy); ctx.beginPath(); ctx.ellipse(p[0], p[1], len * r.range(0.008, 0.014), H * r.range(0.05, 0.09), 0, 0, Math.PI * 2); ctx.fill(); }
    } else if (pat === "dots") {
      ctx.fillStyle = dark;
      for (let i = 0; i < 40; i++) { const t = r.range(0.15, 0.6), yy = r.range(-0.8, 0.2); const p = pt(t, yy); ctx.beginPath(); ctx.arc(p[0], p[1], Math.max(0.8, len * 0.006), 0, Math.PI * 2); ctx.fill(); }
    } else if (pat === "mottle") {
      for (let i = 0; i < 26; i++) { const t = r.range(0.05, 0.9), yy = r.range(-1, 0.4); const p = pt(t, yy); ctx.fillStyle = U.rgba(U.shade(L.back, -0.3), r.range(0.25, 0.5)); ctx.beginPath(); ctx.ellipse(p[0], p[1], len * r.range(0.02, 0.05), H * r.range(0.12, 0.3), r.range(0, 3), 0, Math.PI * 2); ctx.fill(); }
    } else if (pat === "mirror") {
      for (let i = 0; i < 12; i++) {
        const top = i < 7; const t = top ? 0.24 + i * 0.085 : 0.3 + (i - 7) * 0.11; const yy = top ? -0.72 : -0.1 + (i % 2) * 0.05;
        const p = pt(t, yy); const rr = H * r.range(0.13, 0.22);
        const g = ctx.createRadialGradient(p[0] - rr * 0.3, p[1] - rr * 0.3, 1, p[0], p[1], rr);
        g.addColorStop(0, "rgba(255,240,200,0.55)"); g.addColorStop(1, "rgba(120,80,30,0.3)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(p[0], p[1], rr * 1.15, rr, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(60,40,10,0.35)"; ctx.lineWidth = 0.8; ctx.stroke();
      }
    } else if (pat === "scales" || pat === "net") {
      const sz = Math.max(3, H * 0.24);
      ctx.strokeStyle = pat === "net" ? "rgba(30,25,15,0.35)" : "rgba(60,40,10,0.18)"; ctx.lineWidth = Math.max(0.6, len * 0.004);
      for (let yy = -H; yy < H * 0.6; yy += sz * 0.7) {
        const off = (Math.round((yy + H) / (sz * 0.7)) % 2) * sz * 0.5;
        for (let xx = -len * 0.3 + off; xx < len * 0.34; xx += sz) { ctx.beginPath(); ctx.arc(xx, yy, sz * 0.55, -1, 1); ctx.stroke(); }
      }
    } else if (pat === "trout" || pat === "rainbow" || pat === "taimen") {
      if (pat === "rainbow") {
        const g = ctx.createLinearGradient(0, -H * 0.4, 0, H * 0.2);
        g.addColorStop(0, "rgba(230,90,120,0)"); g.addColorStop(0.5, "rgba(230,90,130,0.55)"); g.addColorStop(1, "rgba(230,90,120,0)");
        ctx.fillStyle = g; ctx.fillRect(-len, -H * 0.4, len * 2, H * 0.6);
      }
      if (pat === "taimen") {
        const g = ctx.createLinearGradient(-len / 2, 0, len / 2, 0);
        g.addColorStop(0.55, "rgba(190,70,40,0)"); g.addColorStop(1, "rgba(190,70,40,0.45)");
        ctx.fillStyle = g; ctx.fillRect(-len, -H * 1.2, len * 2, H * 2.4);
      }
      ctx.fillStyle = "rgba(20,15,10,0.6)";
      const n = pat === "taimen" ? 55 : 45;
      for (let i = 0; i < n; i++) {
        const t = r.range(0.12, 0.85), yy = r.range(-0.95, pat === "rainbow" ? 0.1 : 0.3); const p = pt(t, yy); const rr = Math.max(0.8, len * r.range(0.004, 0.008));
        if (pat === "taimen") { ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(0.7); ctx.fillRect(-rr * 1.6, -rr * 0.45, rr * 3.2, rr * 0.9); ctx.rotate(-1.4); ctx.fillRect(-rr * 1.6, -rr * 0.45, rr * 3.2, rr * 0.9); ctx.restore(); }
        else { ctx.beginPath(); ctx.arc(p[0], p[1], rr, 0, Math.PI * 2); ctx.fill(); }
      }
    } else if (pat === "scutes") {
      ctx.fillStyle = "rgba(235,230,210,0.75)";
      const rows = [-0.92, -0.25, 0.55];
      rows.forEach(function (yy, ri) {
        for (let t = 0.18; t < 0.86; t += ri === 0 ? 0.055 : 0.04) {
          const p = pt(t, yy); const sz = H * (ri === 0 ? 0.16 : 0.1);
          ctx.beginPath(); ctx.moveTo(p[0] - sz, p[1] + sz * 0.5); ctx.lineTo(p[0], p[1] - sz * 0.8); ctx.lineTo(p[0] + sz, p[1] + sz * 0.5); ctx.closePath(); ctx.fill();
        }
      });
    }
    if (s.id === "gcrucian" || s.id === "ide" || s.id === "rudd" || s.id === "carp" || s.id === "wildcarp") {
      const g = ctx.createRadialGradient(-len * 0.05, -H * 0.1, 1, 0, 0, len * 0.45);
      g.addColorStop(0, "rgba(255,220,120,0.25)"); g.addColorStop(1, "rgba(255,220,120,0)");
      ctx.fillStyle = g; ctx.fillRect(-len, -H * 1.2, len * 2, H * 2.4);
    }
    if (s.id === "perch") { // тёмное пятно на первом спинном — рисуется в плавнике, тут красный низ
      const g = ctx.createLinearGradient(0, H * 0.3, 0, H); g.addColorStop(0, "rgba(255,160,90,0)"); g.addColorStop(1, "rgba(255,160,90,0.18)");
      ctx.fillStyle = g; ctx.fillRect(-len, 0, len * 2, H);
    }
  };

  // Кэш рыб, нарисованных кодом: рыба занимает PROC_K ширины холста (запас под усы и плавники)
  const PROC_K = 0.76, pcache = {};
  A.procSprite = function (s, sil, size) {
    const key = s.id + (sil ? "|s|" : "|c|") + size;
    if (pcache[key]) return pcache[key];
    const c = document.createElement("canvas"); c.width = size; c.height = Math.round(size * 0.75);
    A.drawFish(c.getContext("2d"), s, size / 2, c.height / 2, size * PROC_K, { silhouette: sil, amp: 0, direct: true });
    pcache[key] = c; return c;
  };

  // Сгенерированный спрайт рыбы (голова влево), с изгибом полосками
  A.drawSprite = function (ctx, img, x, y, len, o, s) {
    const w = len, h = len * img.height / img.width;
    ctx.save(); ctx.translate(x, y);
    if (o.dir === -1) ctx.scale(-1, 1);
    if (o.roll) ctx.rotate(o.roll);
    ctx.globalAlpha *= (o.alpha == null ? 1 : o.alpha);
    const amp = o.amp || 0;
    if (!amp) ctx.drawImage(img, -w / 2, -h / 2, w, h);
    else {
      const n = 24, sw = img.width / n, dw = w / n;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const dy = Math.sin((o.phase || 0) - t * 3.2) * amp * h * 0.45 * t * t;
        ctx.drawImage(img, i * sw, 0, sw + 1, img.height, -w / 2 + i * dw, -h / 2 + dy, dw + 0.6, h);
      }
    }
    ctx.restore();
  };

  // Кэш картинок рыб для меню (canvas → dataURL)
  const cache = {};
  A.fishURL = function (s, w, sil) {
    const key = s.id + "|" + w + "|" + (sil ? 1 : 0) + "|" + (FZ.Assets && FZ.Assets.fish(s.id) ? "img" : "pr");
    if (cache[key]) return cache[key];
    const c = document.createElement("canvas");
    const k = 2; const h = Math.round(w * 0.6);
    c.width = w * k; c.height = h * k;
    const g = c.getContext("2d"); g.scale(k, k);
    A.drawFish(g, s, w / 2, h / 2, w * 0.92, { silhouette: sil, amp: 0 });
    try { cache[key] = c.toDataURL("image/png"); } catch (e) { cache[key] = ""; }
    return cache[key];
  };

  // ---------- Иконки снастей ----------
  A.icon = function (id, size) {
    const key = "ic|" + id + "|" + size + "|" + (FZ.Assets ? FZ.Assets.style : "");
    if (cache[key]) return cache[key];
    const img = FZ.Assets && FZ.Assets.item(id);
    const c = document.createElement("canvas"); const k = 2; c.width = c.height = size * k;
    const g = c.getContext("2d"); g.scale(k, k);
    if (img) { const sc = Math.min(size / img.width, size / img.height) * 0.92; g.drawImage(img, (size - img.width * sc) / 2, (size - img.height * sc) / 2, img.width * sc, img.height * sc); }
    else A.paintIcon(g, id, size);
    try { cache[key] = c.toDataURL("image/png"); } catch (e) { cache[key] = ""; }
    return cache[key];
  };

  A.paintIcon = function (g, id, S) {
    const c = S / 2;
    g.lineCap = "round"; g.lineJoin = "round";
    const worm = function (col, w, wav) {
      g.strokeStyle = col; g.lineWidth = w; g.beginPath();
      for (let i = 0; i <= 30; i++) { const t = i / 30; const x = S * 0.15 + t * S * 0.7; const y = c + Math.sin(t * Math.PI * wav) * S * 0.16; if (!i) g.moveTo(x, y); else g.lineTo(x, y); }
      g.stroke(); g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = w * 0.25; g.stroke();
    };
    const blob = function (x, y, r, col) { const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); gr.addColorStop(0, U.shade(col, 0.4)); gr.addColorStop(1, col); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
    const minnow = function (col, lure) {
      const s = { look: { h: .26, back: lure ? "#1d6f8a" : "#4f6f7a", side: lure ? "#9fe0f0" : "#d9e2e6", belly: lure ? "#fff" : "#f4f7f8", fin: lure ? "#e04a28" : "#c9d2d6", eye: lure ? "#ffd23a" : "#ccc", pat: "none", head: "normal", dorsal: "normal", tail: "fork" }, id: "ic" };
      A.drawFish(g, s, c, c, S * 0.82, { dir: -1, direct: true });
    };
    switch (id) {
      case "worm": worm("#c9686a", S * 0.11, 2.2); break;
      case "crawler": worm("#9a4a4c", S * 0.15, 1.6); break;
      case "bloodworm": worm("#b0182a", S * 0.06, 3.5); break;
      case "maggot": for (let i = 0; i < 3; i++) { g.fillStyle = "#f3e6c4"; g.beginPath(); g.ellipse(S * (0.3 + i * 0.2), c + (i - 1) * S * 0.12, S * 0.1, S * 0.05, 0.6, 0, Math.PI * 2); g.fill(); g.strokeStyle = "#cdbb8e"; g.lineWidth = 1; g.stroke(); } break;
      case "bread": g.fillStyle = "#c98a3a"; g.beginPath(); g.roundRect(S * 0.18, S * 0.22, S * 0.64, S * 0.58, S * 0.16); g.fill(); g.fillStyle = "#f2dfb4"; g.beginPath(); g.roundRect(S * 0.24, S * 0.3, S * 0.52, S * 0.44, S * 0.12); g.fill(); break;
      case "dough": blob(c, c, S * 0.28, "#e8c784"); blob(c + S * 0.2, c + S * 0.16, S * 0.12, "#e0b870"); break;
      case "corn": for (let i = 0; i < 4; i++) blob(S * (0.32 + (i % 2) * 0.3), S * (0.36 + Math.floor(i / 2) * 0.3), S * 0.13, "#f2c21a"); break;
      case "barley": for (let i = 0; i < 6; i++) blob(S * (0.28 + (i % 3) * 0.22), S * (0.4 + Math.floor(i / 3) * 0.22), S * 0.09, "#e6dcc2"); break;
      case "boilie": blob(S * 0.4, S * 0.45, S * 0.2, "#c8502a"); blob(S * 0.62, S * 0.6, S * 0.17, "#e0a03a"); break;
      case "livebait": minnow(); break;
      case "grasshopper": g.fillStyle = "#5aa83a"; g.beginPath(); g.ellipse(c, c, S * 0.3, S * 0.1, -0.2, 0, Math.PI * 2); g.fill(); g.strokeStyle = "#3e7a28"; g.lineWidth = S * 0.04; g.beginPath(); g.moveTo(c, c); g.lineTo(c + S * 0.18, c - S * 0.22); g.lineTo(c + S * 0.32, c + S * 0.12); g.stroke(); blob(c - S * 0.3, c + S * 0.05, S * 0.08, "#6cbf48"); break;
      case "amphipod": g.strokeStyle = "#9a8a6a"; g.lineWidth = S * 0.1; g.beginPath(); g.arc(c, c + S * 0.1, S * 0.24, Math.PI * 1.1, Math.PI * 1.95); g.stroke(); g.lineWidth = 1.2; for (let i = 0; i < 6; i++) { const a = Math.PI * (1.15 + i * 0.13); g.beginPath(); g.moveTo(c + Math.cos(a) * S * 0.24, c + S * 0.1 + Math.sin(a) * S * 0.24); g.lineTo(c + Math.cos(a) * S * 0.36, c + S * 0.18 + Math.sin(a) * S * 0.3); g.stroke(); } break;
      case "spinner": g.strokeStyle = "#888"; g.lineWidth = S * 0.04; g.beginPath(); g.moveTo(S * 0.15, c); g.lineTo(S * 0.85, c); g.stroke(); g.fillStyle = "#e8e8f0"; g.beginPath(); g.ellipse(S * 0.42, c - S * 0.1, S * 0.16, S * 0.09, -0.5, 0, Math.PI * 2); g.fill(); g.strokeStyle = "#999"; g.lineWidth = 1; g.stroke(); g.fillStyle = "#e04a28"; g.fillRect(S * 0.58, c - S * 0.05, S * 0.12, S * 0.1); g.strokeStyle = "#444"; g.beginPath(); g.arc(S * 0.82, c + S * 0.08, S * 0.07, 0, Math.PI); g.stroke(); break;
      case "spoon": { const gr = g.createLinearGradient(0, S * 0.2, 0, S * 0.8); gr.addColorStop(0, "#fff3b0"); gr.addColorStop(1, "#c89a1a"); g.fillStyle = gr; g.beginPath(); g.ellipse(c, c, S * 0.32, S * 0.15, -0.5, 0, Math.PI * 2); g.fill(); g.fillStyle = "#e04a28"; g.beginPath(); g.ellipse(c + S * 0.08, c - S * 0.05, S * 0.08, S * 0.05, -0.5, 0, Math.PI * 2); g.fill(); break; }
      case "wobbler": minnow(null, true); break;
      case "jig": blob(S * 0.3, c, S * 0.1, "#3a3a3a"); g.fillStyle = "#7ad03a"; g.beginPath(); g.moveTo(S * 0.36, c - S * 0.08); g.quadraticCurveTo(S * 0.7, c - S * 0.1, S * 0.86, c - S * 0.14); g.quadraticCurveTo(S * 0.82, c + S * 0.06, S * 0.72, c + S * 0.12); g.quadraticCurveTo(S * 0.5, c + S * 0.1, S * 0.36, c + S * 0.08); g.fill(); break;
      case "mouse": g.fillStyle = "#6a5a4a"; g.beginPath(); g.ellipse(c, c, S * 0.26, S * 0.15, 0, 0, Math.PI * 2); g.fill(); blob(S * 0.3, c - S * 0.12, S * 0.06, "#8a7a6a"); g.strokeStyle = "#6a5a4a"; g.lineWidth = S * 0.03; g.beginPath(); g.moveTo(S * 0.75, c); g.quadraticCurveTo(S * 0.9, c - S * 0.15, S * 0.95, c + S * 0.05); g.stroke(); break;
      case "balancer": g.fillStyle = "#e0c03a"; g.beginPath(); g.ellipse(c, c, S * 0.3, S * 0.11, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = "#e04a28"; g.beginPath(); g.moveTo(S * 0.72, c); g.lineTo(S * 0.9, c - S * 0.12); g.lineTo(S * 0.9, c + S * 0.12); g.fill(); blob(S * 0.3, c - S * 0.02, S * 0.04, "#222"); break;
      case "icespoon": { const gr = g.createLinearGradient(S * 0.3, 0, S * 0.7, 0); gr.addColorStop(0, "#f2f2f8"); gr.addColorStop(1, "#9aa0b0"); g.fillStyle = gr; g.beginPath(); g.moveTo(c, S * 0.12); g.quadraticCurveTo(c + S * 0.2, c, c, S * 0.84); g.quadraticCurveTo(c - S * 0.16, c, c, S * 0.12); g.fill(); break; }
      case "mormy": blob(c, c, S * 0.14, "#3a3a44"); g.fillStyle = "#e0c03a"; g.beginPath(); g.arc(c, c, S * 0.06, 0, Math.PI * 2); g.fill(); g.strokeStyle = "#555"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(c, c - S * 0.14); g.lineTo(c, S * 0.1); g.stroke(); break;
      case "gb": g.fillStyle = "#a8844a"; g.beginPath(); g.roundRect(S * 0.22, S * 0.2, S * 0.56, S * 0.64, S * 0.08); g.fill(); g.fillStyle = "#f2dfb4"; g.fillRect(S * 0.28, S * 0.42, S * 0.44, S * 0.18); g.fillStyle = "#6a4a2a"; g.font = "800 " + (S * 0.13) + "px Rubik,sans-serif"; g.textAlign = "center"; g.fillText("КОРМ", c, S * 0.56); break;
      case "float": case "rod_float": g.strokeStyle = "#333"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(c, S * 0.08); g.lineTo(c, S * 0.92); g.stroke(); g.fillStyle = "#f04a2a"; g.beginPath(); g.ellipse(c, S * 0.35, S * 0.07, S * 0.14, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = "#fafafa"; g.beginPath(); g.ellipse(c, S * 0.55, S * 0.11, S * 0.15, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = "#2a2a2a"; g.fillRect(c - 1, S * 0.68, 2, S * 0.2); break;
      case "feeder": case "rod_feeder": g.strokeStyle = "#555"; g.lineWidth = 2; g.beginPath(); g.moveTo(c, S * 0.1); g.lineTo(c, S * 0.3); g.stroke(); g.fillStyle = "#4a6a8a"; g.beginPath(); g.roundRect(c - S * 0.16, S * 0.3, S * 0.32, S * 0.42, S * 0.06); g.fill(); g.strokeStyle = "rgba(255,255,255,0.5)"; g.lineWidth = 1; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(c - S * 0.16, S * (0.36 + i * 0.09)); g.lineTo(c + S * 0.16, S * (0.36 + i * 0.09)); g.stroke(); } g.fillStyle = "#c8a46a"; g.fillRect(c - S * 0.12, S * 0.42, S * 0.24, S * 0.22); break;
      case "spin": case "rod_spin": A.paintIcon(g, "spinner", S); break;
      case "ice": case "rod_ice": g.fillStyle = "#c8a46a"; g.beginPath(); g.roundRect(S * 0.36, S * 0.5, S * 0.28, S * 0.36, S * 0.06); g.fill(); g.strokeStyle = "#ddd"; g.lineWidth = 2; g.beginPath(); g.moveTo(c, S * 0.5); g.lineTo(c - S * 0.05, S * 0.12); g.stroke(); g.strokeStyle = "#f04a2a"; g.beginPath(); g.moveTo(c - S * 0.05, S * 0.12); g.lineTo(c - S * 0.25, S * 0.18); g.stroke(); break;
      case "line": g.fillStyle = "#3a6ab0"; g.beginPath(); g.ellipse(c, c, S * 0.32, S * 0.32, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = "#cfe0f4"; g.beginPath(); g.arc(c, c, S * 0.22, 0, Math.PI * 2); g.fill(); g.strokeStyle = "rgba(60,100,170,0.6)"; g.lineWidth = 1; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(c, c, S * (0.08 + i * 0.025), 0, Math.PI * 2); g.stroke(); } g.fillStyle = "#3a6ab0"; g.beginPath(); g.arc(c, c, S * 0.07, 0, Math.PI * 2); g.fill(); break;
      case "hook": g.strokeStyle = "#7a7a86"; g.lineWidth = S * 0.06; g.beginPath(); g.moveTo(c + S * 0.08, S * 0.12); g.lineTo(c + S * 0.08, S * 0.6); g.arc(c - S * 0.06, S * 0.6, S * 0.14, 0, Math.PI); g.lineTo(c - S * 0.2, S * 0.48); g.stroke(); break;
      default: blob(c, c, S * 0.3, "#888");
    }
  };

  FZ.Art = A;
})(window.FZ);
