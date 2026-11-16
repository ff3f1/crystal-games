/* Запуск, ввод (касания, свайпы, кнопка действия), главный цикл */
(function (FZ) {
  "use strict";
  const U = FZ.U, G = FZ.Game, UI = FZ.UI, Sc = FZ.Scene;
  const cv = document.getElementById("cv");
  let t = 0, last = 0, aim = null, ambT = 0, running = false, worldLast = -Infinity, physicsDebt = 0;
  const FIXED_DT = 1 / 60, MAX_PHYSICS_STEPS = 12;
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
    P.startTilt=(G.rig()&&G.rig().tilt)||0;
    const s = rigState(), r = G.rig(), mode = G.sess().mode;
    if (s === "idle" && !G.sess().ice) setAim(e.clientX, e.clientY);
    if (s === "fight") { r.reeling = true; r.tilt=P.startTilt; }
    if ((s === "wait" || s === "bite") && mode === "spin") r.reeling = true;
  });
  cv.addEventListener("pointermove", function (e) {
    if (!P.down || e.pointerId !== P.id) return;
    P.moved = Math.max(P.moved, Math.hypot(e.clientX - P.sx, e.clientY - P.sy));
    P.x = e.clientX; P.y = e.clientY;
    if (aim) setAim(e.clientX, e.clientY);
    const r = G.rig(); if (r && r.state === "fight") r.tilt = U.clamp(P.startTilt+(e.clientX-P.sx)/(Sc.size().W*.35),-1,1);
  });
  function up(e) {
    if (!P.down || (e && e.pointerId !== P.id)) return;
    P.down = false;
    const r = G.rig(); if (!r) return;
    const dt = performance.now() - P.st, dy = P.sy - P.y;
    const s = r.state;
    if (aim) { const a = aim; aim = null; if (s === "idle") G.cast(a.X, a.Z); }
    else if (dy > 45 && (s === "bite" || s === "wait")) G.strike();
    else if (P.moved < 14 && dt < 400) { if (s === "bite" && r.bite.phase === "take") G.strike(); else if (s === "wait" && G.sess().ice) G.jig(); }
    r.reeling = false;
  }
  cv.addEventListener("pointerup", up);
  cv.addEventListener("pointercancel", function(e) {
    if(e.pointerId!==P.id)return;P.down=false;aim=null;const r=G.rig();if(r)r.reeling=false;
  });
  function tiltOf(x) { const S = Sc.size(); return U.clamp((x - S.W / 2) / (S.W * 0.38), -1, 1); }

  Input.actionDown = function () {
    FZ.Sound.unlock();
    if (!G.sess() || UI.anyOpen()) return;
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
    if (e.code === "ArrowUp" && !UI.anyOpen()) G.strike && G.rig() && G.strike();
  });
  window.addEventListener("keyup", function (e) { if (e.code === "Space") Input.actionUp(); });
  function releaseInput(){P.down=false;aim=null;const r=G.rig();if(r){r.reeling=false;r.tilt=0;}}
  window.addEventListener('blur',releaseInput);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseInput();});
  FZ.Input = Input;

  // ---------- Цикл ----------
  function frame(now) {
    // Use a fixed simulation step and catch up to wall-clock time when a
    // mid-range Android phone takes longer to paint photographic reflections.
    // Never bind reel speed or fish fatigue to the rendering frame rate.
    const dt = Math.max(0, Math.min(0.25, (now - last) / 1000 || FIXED_DT)); last = now;
    const r = G.rig();
    const paused = document.hidden || (Sc.graphicsInfo && Sc.graphicsInfo().contextLost) || (UI.anyOpen() && !document.getElementById("ovCatch").classList.contains("on"));
    if (paused) physicsDebt = 0;
    else {
      // Fixed 60Hz simulation: no FPS-based reel speed, fatigue or random bite bias.
      // Keep a bounded backlog on slow Android phones instead of a death spiral.
      const scale = r && r.fish && r.fish.jump ? 0.55 : 1;
      physicsDebt = Math.min(physicsDebt + dt * scale, FIXED_DT * MAX_PHYSICS_STEPS);
      let steps = 0;
      while (physicsDebt + 1e-9 >= FIXED_DT && steps < MAX_PHYSICS_STEPS) {
        physicsDebt -= FIXED_DT;
        t += FIXED_DT;
        G.update(FIXED_DT, t);
        steps++;
      }
    }
    G.events().forEach(function (event) {
      UI.onEvent(event);
      // Просим оценку только после реального игрового опыта: пятая завершённая поимка.
      // Никаких вопросов о желаемой оценке и никаких наград за отзыв.
      if (event.type === "resolved" && G.state().stats.total >= 5) {
        const st = G.state(), lastAsk = Number(st.rateAsked || 0);
        if (FZ.Ads.platform === "android" && Date.now() - lastAsk > 90 * 86400000) {
          st.rateAsked = Date.now(); G.save(true);
          FZ.Platform.requestReview().then(function (ok) {
            if (!ok) { st.rateAsked = Math.max(0, Date.now() - 80 * 86400000); G.save(true); }
          });
        }
      }
    });
    const s = G.sess();
    if (s) {
      if (r) r.idleHint = r.state === "idle" ? (r.idleHint || 0) + dt : 0;
      const v = G.view(t);
      // Full-screen sheets/catch only need an occasional background refresh.
      const interval = UI.anyOpen() ? (document.getElementById('ovMenu').classList.contains('on') ? 1000/15 : 500) : 0;
      if(now-worldLast>=interval){Sc.render(v,dt);worldLast=now;}
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
      if (fps < 36 && i < QL.length - 1) { st.settings.autoQ = QL[i + 1]; Sc.setQuality(QL[i + 1]); G.save(true); fq.start = now; }
    }
  }
  FZ.applyQuality = function () { const st = G.state(); Sc.setQuality(effQ(st)); fq.start = performance.now(); };

  // ---------- Запуск ----------
  function boot() {
    const st = G.load();
    Sc.init(cv); Sc.setQuality(effQ(st)); fq.start = performance.now();
    FZ.Assets.setStyle(st.settings.gfx);
    FZ.Sound.setMix(st.settings); FZ.Sound.setOn(st.settings.sound); FZ.Sound.music = st.settings.music;
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
