/* Запуск, ввод (касания, свайпы, кнопка действия), главный цикл */
(function (FZ) {
  "use strict";
  const U = FZ.U, G = FZ.Game, UI = FZ.UI, Sc = FZ.Scene;
  const cv = document.getElementById("cv");
  let t = 0, last = 0, aim = null, ambT = 0, running = false;
  const P = { down: false, x: 0, y: 0, sx: 0, sy: 0, st: 0, id: null, moved: 0 };

  // ---------- Ввод ----------
  const Input = {};
  function rigState() { const r = G.rig(); return r ? r.state : null; }
  function blocked() { return !G.sess() || UI.anyOpen(); }
  function setAim(x, y) {
    const S = Sc.size();
    const yy = Math.max(y, S.shoreY + 2);
    const w = Sc.unproj(x, yy);
    aim = G.aimClamp(w.X, y < S.shoreY + 2 ? 999 : w.Z);
    aim.ok = true;
  }
  cv.addEventListener("pointerdown", function (e) {
    FZ.Sound.unlock();
    if (blocked()) return;
    P.down = true; P.id = e.pointerId; P.x = P.sx = e.clientX; P.y = P.sy = e.clientY; P.st = performance.now(); P.moved = 0;
    try { cv.setPointerCapture(e.pointerId); } catch (er) {}
    const s = rigState(), r = G.rig(), mode = G.sess().mode;
    if (s === "idle" && !G.sess().ice) setAim(e.clientX, e.clientY);
    if (s === "fight") { r.reeling = true; r.tilt = tiltOf(e.clientX); }
    if ((s === "wait" || s === "bite") && mode === "spin") r.reeling = true;
  });
  cv.addEventListener("pointermove", function (e) {
    if (!P.down || e.pointerId !== P.id) return;
    P.moved = Math.max(P.moved, Math.hypot(e.clientX - P.sx, e.clientY - P.sy));
    P.x = e.clientX; P.y = e.clientY;
    if (aim) setAim(e.clientX, e.clientY);
    const r = G.rig(); if (r && r.state === "fight") r.tilt = tiltOf(e.clientX);
  });
  function up(e) {
    if (!P.down || (e && e.pointerId !== P.id)) return;
    P.down = false;
    const r = G.rig(); if (!r) return;
    const dt = performance.now() - P.st, dy = P.sy - P.y;
    const s = r.state;
    if (aim) { const a = aim; aim = null; if (s === "idle") G.cast(a.X, a.Z); }
    else if (dy > 45 && dt < 600 && (s === "bite" || s === "wait")) G.strike();
    else if (P.moved < 14 && dt < 400) { if (s === "bite" && r.bite.phase === "take") G.strike(); else if (s === "wait" && G.sess().ice) G.jig(); }
    r.reeling = false;
  }
  cv.addEventListener("pointerup", up);
  cv.addEventListener("pointercancel", up);
  function tiltOf(x) { const S = Sc.size(); return U.clamp((x - S.W / 2) / (S.W * 0.38), -1, 1); }

  Input.actionDown = function () {
    FZ.Sound.unlock();
    if (!G.sess()) return;
    const r = G.rig(), s = r.state, mode = G.sess().mode;
    if (s === "idle") { if (G.sess().ice) return; G.cast(); }
    else if (s === "nohole") G.drill();
    else if (s === "bite" && r.bite.phase === "take") G.strike();
    else if (s === "fight") r.reeling = true;
    else if (mode === "spin" && (s === "wait" || s === "bite")) r.reeling = true;
    else if (s === "wait" && mode === "ice") G.jig();
    else if (s === "wait" || s === "settle") G.retrieve();
  };
  Input.actionUp = function () { const r = G.rig(); if (r) r.reeling = false; };
  window.addEventListener("keydown", function (e) {
    if (e.repeat) return;
    if (e.code === "Space") { e.preventDefault(); Input.actionDown(); }
    if (e.code === "ArrowUp") G.strike && G.rig() && G.strike();
  });
  window.addEventListener("keyup", function (e) { if (e.code === "Space") Input.actionUp(); });
  FZ.Input = Input;

  // ---------- Цикл ----------
  function frame(now) {
    let dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
    const r = G.rig();
    if (r && r.fish && r.fish.jump) dt *= 0.55; // замедление на «свечке»
    t += dt;
    const paused = UI.anyOpen() && !document.getElementById("ovCatch").classList.contains("on");
    if (!paused) G.update(dt, t);
    G.events().forEach(UI.onEvent);
    const s = G.sess();
    if (s) {
      if (r) r.idleHint = r.state === "idle" ? (r.idleHint || 0) + dt : 0;
      const v = G.view(t);
      Sc.render(v, dt);
      if (aim && r && r.state === "idle") Sc.drawAim(v, aim);
      UI.frame(dt, t);
      ambT -= dt; if (ambT <= 0) { ambT = 3; UI.ambience(); }
    }
    FZ.Sound.tick(dt);
    autoQuality(now);
    if (running) requestAnimationFrame(frame);
  }

  // Качество «Авто»: начинаем с высокого и ступенькой снижаем, пока кадров меньше 48 в секунду
  const QL = ["hi", "mid", "lo"];
  const effQ = (st) => (st.settings.quality === "auto" ? (st.settings.autoQ || "hi") : st.settings.quality);
  let fq = { t0: 0, n: 0, off: !!navigator.webdriver, start: 0 };
  function autoQuality(now) {
    const st = G.state();
    if (fq.off || st.settings.quality !== "auto" || !G.sess() || document.hidden || now - fq.start < 2500) { fq.t0 = 0; return; }
    if (!fq.t0) { fq.t0 = now; fq.n = 0; return; }
    fq.n++;
    if (now - fq.t0 > 4000) {
      const fps = fq.n / ((now - fq.t0) / 1000);
      fq.t0 = 0;
      const i = QL.indexOf(effQ(st));
      if (fps < 48 && i < QL.length - 1) { st.settings.autoQ = QL[i + 1]; Sc.setQuality(QL[i + 1]); G.save(true); fq.start = now; }
    }
  }
  FZ.applyQuality = function () { const st = G.state(); Sc.setQuality(effQ(st)); fq.start = performance.now(); };

  // ---------- Запуск ----------
  function boot() {
    const st = G.load();
    Sc.init(cv); Sc.setQuality(effQ(st)); fq.start = performance.now();
    FZ.Assets.setStyle(st.settings.gfx);
    FZ.Sound.setOn(st.settings.sound); FZ.Sound.music = st.settings.music;
    const bar = document.getElementById("bootBar");
    FZ.Assets.load((k) => { bar.style.width = Math.round(k * 100) + "%"; }).then(function () {
      FZ.Ads.init();
      G.startSession(st.loc);
      UI.buildHud();
      UI.showMenu();
      const b = document.getElementById("boot"); b.style.opacity = 0; setTimeout(() => b.remove(), 450);
      running = true; last = performance.now(); requestAnimationFrame(frame);
    });
    window.addEventListener("resize", () => Sc.resize());
    document.addEventListener("visibilitychange", () => { if (document.hidden) { FZ.Sound.suspend(); G.save(true); } else FZ.Sound.resume(); });
    window.__appPause = function () { FZ.Sound.suspend(); G.save(true); };
    window.__appResume = function () { FZ.Sound.resume(); };
    window.__game = { G, UI, Sc, FZ, aim: () => aim, setAim: (x, y) => setAim(x, y) };
  }
  if (document.fonts && document.fonts.load) Promise.all([document.fonts.load("700 16px Rubik"), document.fonts.load("700 30px Caveat")]).then(boot, boot);
  else boot();
})(window.FZ);
