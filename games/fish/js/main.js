/* Запуск, ввод (касания, свайпы, кнопка действия), главный цикл */
(function (FZ) {
  "use strict";
  const U = FZ.U, G = FZ.Game, UI = FZ.UI, Sc = FZ.Scene;
  const cv = document.getElementById("cv");
  let t = 0, last = 0, aim = null, ambT = 0, running = false;
  const P = { down: false, x: 0, y: 0, sx: 0, sy: 0, st: 0, id: null, moved: 0, canvasReeling: false };

  // ---------- Ввод ----------
  const Input = {};
  function rigState() { const r = G.rig(); return r ? r.state : null; }
  function blocked() { return !G.sess() || UI.anyOpen() || document.hidden || FZ.Ads.isBusy(); }
  function setAim(x, y) {
    const S = Sc.size();
    const yy = Math.max(y, S.shoreY + 2);
    const w = Sc.unproj(x, yy);
    aim = G.aimClamp(w.X, y < S.shoreY + 2 ? 999 : w.Z);
    aim.ok = true;
  }
  cv.addEventListener("pointerdown", function (e) {
    FZ.Sound.unlock();
    if (blocked() || P.down || e.button !== 0) return;
    P.down = true; P.id = e.pointerId; P.x = P.sx = e.clientX; P.y = P.sy = e.clientY; P.st = performance.now(); P.moved = 0; P.canvasReeling = false;
    try { cv.setPointerCapture(e.pointerId); } catch (er) {}
    const s = rigState(), r = G.rig(), mode = G.sess().mode;
    if (s === "idle" && !G.sess().ice) setAim(e.clientX, e.clientY);
    // Steering and reeling are independent: touching the water during a run
    // must not start the reel the player was just told to release.
    if (s === "fight") r.tilt = tiltOf(e.clientX);
    if ((s === "wait" || s === "bite") && mode === "spin") { r.reeling = true; P.canvasReeling = true; }
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
    const selected = aim;
    aim = null;
    const r = G.rig();
    if (!r) return;
    if (P.canvasReeling) r.reeling = false;
    P.canvasReeling = false;
    if (r.state === "fight") r.tilt = 0;
    if (e.type !== "pointerup" || blocked()) return;
    const dt = performance.now() - P.st, dy = P.sy - P.y;
    const s = r.state;
    if (selected && s === "idle") {
      if (P.moved >= 20) G.cast(selected.X, selected.Z);
      else { G.sess().lastAim = selected; r.aimSelected = true; }
    }
    else if (dy > 45 && dt < 600 && (s === "bite" || s === "wait")) G.strike();
    else if (P.moved < 14 && dt < 400) { if (s === "bite" && r.bite.phase === "take") G.strike(); else if (s === "wait" && G.sess().ice) G.jig(); }
  }
  cv.addEventListener("pointerup", up);
  cv.addEventListener("pointercancel", up);
  cv.addEventListener("lostpointercapture", up);
  function tiltOf(x) { const S = Sc.size(); return U.clamp((x - S.W / 2) / (S.W * 0.38), -1, 1); }

  Input.actionDown = function () {
    FZ.Sound.unlock();
    if (blocked()) return;
    const r = G.rig(), s = r.state, mode = G.sess().mode;
    if (s === "idle") { if (G.sess().ice) return; G.cast(); }
    else if (s === "nohole") G.drill();
    else if (s === "bite" && r.bite.phase === "take") {
      G.strike();
      if (r.state === "fight") r.reeling = true;
    }
    else if (s === "fight") r.reeling = true;
    else if (s === "landing" && r.landing && r.landing.trophyNet) r.netting = true;
    else if (mode === "spin" && (s === "wait" || s === "bite")) r.reeling = true;
    else if (s === "wait" && mode === "ice") G.jig();
    else if (s === "wait" || s === "settle") G.retrieve();
  };
  Input.actionUp = function () { const r = G.rig(); if (r) {r.reeling = false;r.netting = false;} };
  Input.reelSteer = function (deltaX) {
    const r = G.rig();
    if (!P.down && r && r.state === "fight") r.tilt = U.clamp(deltaX / 55, -1, 1);
  };
  window.addEventListener("keydown", function (e) {
    if (e.repeat || blocked()) return;
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
    const paused = UI.anyOpen() || document.hidden || FZ.Ads.isBusy() || FZ.appSuspended;
    if (!paused) G.update(dt, t);
    G.events().forEach(UI.onEvent);
    const s = G.sess();
    if (s) {
      if (r) r.idleHint = r.state === "idle" ? (r.idleHint || 0) + dt : 0;
      const v = G.view(t);
      Sc.render(v, dt);
      if(r&&r.state==="idle"&&(aim||r.aimSelected&&s.lastAim))Sc.drawAim(v,aim||s.lastAim);
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
      if(st.pendingCatch&&FZ.SP[st.pendingCatch.sid]){
        const result=Object.assign({},st.pendingCatch,{s:FZ.SP[st.pendingCatch.sid]});
        G.rig().result=result;G.rig().state='result';UI.closeMenu();UI.showCatch(result);
      }
      const b = document.getElementById("boot"); b.style.opacity = 0; setTimeout(() => b.remove(), 450);
      running = true; last = performance.now(); requestAnimationFrame(frame);
    });
    window.addEventListener("resize", () => Sc.resize());
    document.addEventListener("visibilitychange", () => {if(document.hidden)window.__appPause();else window.__appResume()});
    window.__appPause = function () { FZ.appSuspended=true;P.down=false;aim=null;Input.actionUp();FZ.Sound.suspend('app');G.save(true); };
    window.addEventListener('blur', () => { P.down = false; P.canvasReeling = false; aim = null; Input.actionUp(); Input.reelSteer(0); });
    window.__appResume = function () { const was=FZ.appSuspended;FZ.appSuspended=false;last=performance.now();FZ.Sound.resume("app");if(was&&G.sess()&&!UI.anyOpen()&&!FZ.Ads.isBusy())UI.showMenu(); };
    window.__game = { G, UI, Sc, FZ, aim: () => aim, setAim: (x, y) => setAim(x, y) };
  }
  if (document.fonts && document.fonts.load) Promise.all([document.fonts.load("700 16px Rubik"), document.fonts.load("700 30px Caveat")]).then(boot, boot);
  else boot();
})(window.FZ);
