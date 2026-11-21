/* Запуск, ввод (касания, свайпы, кнопка действия), главный цикл */
(function (FZ) {
  "use strict";
  const U = FZ.U, G = FZ.Game, UI = FZ.UI, Sc = FZ.Scene;
  const cv = document.getElementById("cv");
  let activeCanvas = cv;
  let t = 0, last = 0, aim = null, ambT = 0, running = false, worldLast = -Infinity, physicsDebt = 0;
  const FIXED_DT = 1 / 60, MAX_PHYSICS_STEPS = 12;
  // Pointer ownership is independent of the current fishing state.
  const pointers = new Map(), actions = new Set();
  let rodId = null, castId = null, inputRig = null;
  const Input = {};
  function blocked() { return !G.sess() || UI.anyOpen(); }
  function setAim(x, y) {
    const S = Sc.size(), w = Sc.unproj(x, Math.max(y, S.shoreY + 2));
    aim = G.aimClamp(w.X, y < S.shoreY + 2 ? 999 : w.Z); aim.ok = true;
  }
  function syncReel() {
    const r = G.rig(); if (!r) return;
    const canReel = r.state === "fight" ||
      (G.sess().mode === "spin" && (r.state === "wait" || r.state === "bite"));
    r.reeling = !blocked() && canReel && (actions.size > 0 ||
      Array.from(pointers.values()).some(p => p.mouseReel));
  }
  function capture(el, id) { try { el.setPointerCapture(id); } catch (_) {} }
  function release(el, id) { try { if (el.hasPointerCapture(id)) el.releasePointerCapture(id); } catch (_) {} }
  function onPointerDown(e) {
    FZ.Sound.unlock();
    if (blocked() || (e.button != null && e.button !== 0)) return;
    e.preventDefault();
    const r = G.rig(), sess = G.sess();
    const role = r.state === "idle" && !sess.ice && castId === null ? "cast" :
      rodId === null && r.state !== "idle" ? "rod" : "extra";
    const p = { role, sx:e.clientX, sy:e.clientY, x:e.clientX, y:e.clientY,
      st:performance.now(), moved:0, startTilt:r.tilt || 0, rig:r,
      mouseReel:e.pointerType !== "touch" && role === "rod" &&
        (r.state === "fight" || sess.mode === "spin") };
    pointers.set(e.pointerId,p); inputRig=r;
    if(role === "cast") { castId=e.pointerId; setAim(p.x,p.y); }
    if(role === "rod") rodId=e.pointerId;
    capture(activeCanvas,e.pointerId); syncReel();
  }
  function onPointerMove(e) {
    const p=pointers.get(e.pointerId); if(!p)return;
    if(blocked() || p.rig !== G.rig()) { releaseInput(); return; }
    e.preventDefault();
    const moveDistance=Math.hypot(e.clientX-p.x,e.clientY-p.y);
    p.x=e.clientX; p.y=e.clientY;
    p.moved=Math.max(p.moved,Math.hypot(p.x-p.sx,p.y-p.sy));
    if(p.role === "cast" && aim) setAim(p.x,p.y);
    if(p.role === "rod") {
      const r=G.rig();
      r.tilt=U.clamp(p.startTilt+(p.x-p.sx)/(Sc.size().W*.35),-1,1);
      r.liftTarget=U.clamp((p.sy-p.y)/(Sc.size().W*.3),-.6,1);
      if(G.sess().mode==="spin" && r.state==="wait" && moveDistance>8)r.twitch=Math.min(1,(r.twitch||0)+moveDistance/70);
    }
  }
  function endPointer(e,cancelled) {
    const p=pointers.get(e.pointerId); if(!p)return;
    pointers.delete(e.pointerId);
    if(rodId===e.pointerId)rodId=null;
    if(castId===e.pointerId)castId=null;
    release(activeCanvas,e.pointerId);
    const r=G.rig(), a=p.role==="cast"?aim:null;
    if(p.role==="cast")aim=null;
    if(!cancelled && !blocked() && r===p.rig) {
      const dy=p.sy-p.y, elapsed=performance.now()-p.st;
      if(a && r.state==="idle")G.cast(a.X,a.Z);
      else if(p.role==="rod") {
        if(dy>45 && (r.state==="bite" || r.state==="wait"))G.strike();
        else if(p.moved<14 && elapsed<400) {
          if(r.state==="bite" && r.bite && r.bite.phase==="take")G.strike();
          else if(r.state==="wait" && G.sess().ice)G.jig();
        }
      }
    }
    syncReel();
  }
  function bindCanvas(el) {
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", e => endPointer(e,false));
    el.addEventListener("pointercancel", e => endPointer(e,true));
    el.addEventListener("lostpointercapture", e => endPointer(e,true));
  }
  bindCanvas(cv);
  // The WebGL fallback replaces #cv with a new Canvas 2D element.
  // Reattach input there or the player loses casting, striking and multitouch.
  Input.rebindCanvas = function(nextCanvas) {
    if (!nextCanvas || nextCanvas === activeCanvas) return;
    releaseInput();
    activeCanvas = nextCanvas;
    bindCanvas(activeCanvas);
  };
  Input.actionDown=function(id) {
    id=id==null?"legacy":id;
    FZ.Sound.unlock(); if(blocked() || actions.has(id))return;
    const first=actions.size===0;
    actions.add(id); inputRig=G.rig();
    const r=G.rig(), s=r.state, sess=G.sess();
    if(first) {
      if(s==="idle" && !sess.ice)G.cast();
      else if(s==="nohole")G.drill();
      else if(s==="bite" && r.bite && r.bite.phase==="take")G.strike();
      else if(s==="wait" && sess.mode==="ice")G.jig();
      else if((s==="wait" || s==="settle") && sess.mode!=="spin")G.retrieve();
    }
    syncReel();
  };
  Input.actionUp=function(id) { actions.delete(id==null?"legacy":id); syncReel(); };
  function releaseInput() {
    const ids=Array.from(pointers.keys()); pointers.clear(); actions.clear();
    rodId=null;castId=null;aim=null;inputRig=null;
    ids.forEach(id=>release(activeCanvas,id));
    const r=G.rig();if(r){r.reeling=false;r.tilt=0;r.liftTarget=0;}
    const b=document.getElementById("bAct");if(b)b.classList.remove("held");
  }
  Input.reset=releaseInput;
  Input.sync=function() {
    if(blocked() || (inputRig && inputRig!==G.rig()))releaseInput();
    else syncReel();
  };
  Input.snapshot=()=>({rodId,castId,pointers:pointers.size,actions:actions.size});
  window.addEventListener("keydown",function(e) {
    if(e.repeat || /INPUT|TEXTAREA|SELECT/.test((e.target||{}).tagName||""))return;
    if(e.code==="Space" && !blocked()){e.preventDefault();Input.actionDown("keyboard");}
    if(e.code==="ArrowUp" && !blocked() && G.rig())G.strike();
  });
  window.addEventListener("keyup",e=>{if(e.code==="Space")Input.actionUp("keyboard");});
  window.addEventListener("blur",releaseInput);
  document.addEventListener("visibilitychange",()=>{if(document.hidden)releaseInput();});
  FZ.Input=Input;

  // ---------- Цикл ----------
  function frame(now) {
    // Use a fixed simulation step and catch up to wall-clock time when a
    // mid-range Android phone takes longer to paint photographic reflections.
    // Never bind reel speed or fish fatigue to the rendering frame rate.
    const dt = Math.max(0, Math.min(0.25, (now - last) / 1000 || FIXED_DT)); last = now;
    Input.sync();
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
    window.__appPause = function () { releaseInput(); FZ.Sound.suspend(); G.save(true); };
    window.__appResume = function () { FZ.Sound.resume(); };
    window.__game = { G, UI, Sc, FZ, aim: () => aim, setAim: (x, y) => setAim(x, y) };
  }
  if (document.fonts && document.fonts.load) Promise.all([document.fonts.load("700 16px Rubik"), document.fonts.load("700 30px Caveat")]).then(boot, boot);
  else boot();
})(window.FZ);
