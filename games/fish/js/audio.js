/* Звук: природа и эффекты синтезируются на лету (WebAudio); музыка — из файлов ACE-Step, если они есть */
(function (FZ) {
  "use strict";
  const S = { on: true, music: true };
  let ac = null, master, amb, sfx, noiseBuf = null;
  const A = {}; // узлы окружения
  let music = null, musicKey = "", musicVol = 0.32;
  let nextBird = 0, nextCrack = 0, nextFrog = 0, cricket = null;
  let ambParams = {};

  S.unlock = function () {
    if (ac) { if (ac.state === "suspended") ac.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    ac = new C();
    master = ac.createGain(); master.gain.value = S.on ? 1 : 0; master.connect(ac.destination);
    amb = ac.createGain(); amb.gain.value = 0.9; amb.connect(master);
    sfx = ac.createGain(); sfx.gain.value = 0.9; sfx.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // вода
    A.water = loopNoise("lowpass", 520, 0.6); A.water.lfo = lfo(0.13, 0.35, A.water.g.gain);
    A.wind = loopNoise("bandpass", 600, 0.6);
    A.rain = loopNoise("highpass", 1200, 0.3);
    S.updateAmbience(ambParams);
  };
  function loopNoise(type, f, q) {
    const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = ac.createGain(); g.gain.value = 0;
    src.connect(fl); fl.connect(g); g.connect(amb); src.start();
    return { src, f: fl, g };
  }
  function lfo(freq, depth, param) {
    const o = ac.createOscillator(); o.frequency.value = freq;
    const g = ac.createGain(); g.gain.value = depth; o.connect(g); g.connect(param); o.start(); return o;
  }
  function env(g, t, a, peak, d, end) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(end || 0.0001, t + a + d); }
  function tone(type, f0, f1, dur, vol, dest, delay) {
    if (!ac) return;
    const t = ac.currentTime + (delay || 0);
    const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ac.createGain(); env(g, t, 0.008, vol, dur);
    o.connect(g); g.connect(dest || sfx); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, type, f0, f1, vol, q, delay, dest) {
    if (!ac) return;
    const t = ac.currentTime + (delay || 0);
    const src = ac.createBufferSource(); src.buffer = noiseBuf; src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const fl = ac.createBiquadFilter(); fl.type = type; fl.Q.value = q || 0.8; fl.frequency.setValueAtTime(f0, t);
    if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ac.createGain(); env(g, t, 0.01, vol, dur);
    src.connect(fl); fl.connect(g); g.connect(dest || sfx); src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }

  // ---------- Окружение ----------
  S.updateAmbience = function (p) {
    ambParams = p || {};
    if (!ac) return;
    const t = ac.currentTime;
    const ice = p.mode === "ice", river = p.style === "river" || p.style === "taiga";
    A.water.g.gain.setTargetAtTime(ice ? 0 : (river ? 0.22 : 0.12), t, 0.8);
    A.water.f.frequency.setTargetAtTime(river ? 900 : 480, t, 1);
    A.wind.g.gain.setTargetAtTime(0.02 + (p.wind || 0) * (ice ? 0.022 : 0.012), t, 1);
    A.rain.g.gain.setTargetAtTime(p.sky === "rain" ? 0.12 : p.sky === "storm" ? 0.2 : 0, t, 1);
    const crickets = !ice && p.period === "night" && (p.season === "summer" || p.season === "autumn");
    if (crickets && !cricket) {
      const o = ac.createOscillator(); o.frequency.value = 4300; const g = ac.createGain(); g.gain.value = 0;
      const pulse = ac.createOscillator(); pulse.type = "square"; pulse.frequency.value = 28; const pg = ac.createGain(); pg.gain.value = 0.006;
      pulse.connect(pg); pg.connect(g.gain); const slow = ac.createOscillator(); slow.frequency.value = 0.9; const sg = ac.createGain(); sg.gain.value = 0.5;
      slow.connect(sg); sg.connect(pulse.frequency);
      o.connect(g); g.connect(amb); o.start(); pulse.start(); slow.start();
      cricket = { o, pulse, slow, g };
    } else if (!crickets && cricket) { cricket.o.stop(); cricket.pulse.stop(); cricket.slow.stop(); cricket = null; }
  };
  S.tick = function (dt) {
    if (!ac || !S.on) return;
    const p = ambParams, now = ac.currentTime;
    if ((p.period === "dawn" || p.period === "day") && p.season !== "winter" && now > nextBird) {
      nextBird = now + 2 + Math.random() * (p.period === "dawn" ? 3 : 7);
      const base = 2400 + Math.random() * 2200, n = 2 + Math.floor(Math.random() * 5);
      for (let i = 0; i < n; i++) tone("sine", base * (1 + Math.random() * 0.3), base * (0.8 + Math.random() * 0.6), 0.07 + Math.random() * 0.08, 0.035, amb, i * (0.09 + Math.random() * 0.06));
    }
    if (p.mode === "ice" && now > nextCrack) {
      nextCrack = now + 12 + Math.random() * 25;
      tone("sine", 180, 38, 1.4, 0.18, amb); noise(0.5, "lowpass", 900, 120, 0.12, 1, 0, amb);
    }
    if (p.mode !== "ice" && (p.style === "pond" || p.style === "delta") && (p.period === "dusk" || p.period === "night") && (p.season === "summer" || p.season === "spring") && now > nextFrog) {
      nextFrog = now + 3 + Math.random() * 6;
      for (let i = 0; i < 3; i++) tone("sawtooth", 110 + Math.random() * 30, 90, 0.12, 0.03, amb, i * 0.16);
    }
  };

  // ---------- Эффекты ----------
  S.click = () => tone("triangle", 900, 700, 0.05, 0.08);
  S.cast = () => { noise(0.45, "bandpass", 800, 3000, 0.22, 1.2); tone("sine", 600, 1400, 0.3, 0.03); };
  S.plop = (big) => { tone("sine", big ? 320 : 700, big ? 90 : 180, 0.18, 0.25); noise(0.25, "lowpass", 2400, 400, big ? 0.35 : 0.18); };
  S.splash = (k) => { noise(0.5 + k * 0.4, "lowpass", 3200, 300, 0.25 + k * 0.25); tone("sine", 260, 70, 0.3, 0.15 * k); };
  S.bite = () => tone("sine", 1200, 900, 0.06, 0.07);
  S.bell = () => { [1320, 1980, 2640].forEach((f, i) => tone("sine", f, f * 0.995, 0.6 - i * 0.15, 0.06 / (i + 1))); };
  S.strike = () => { noise(0.18, "bandpass", 2400, 900, 0.3, 2); tone("square", 300, 120, 0.08, 0.05); };
  S.snap = () => { noise(0.08, "highpass", 3000, 6000, 0.5); tone("square", 1900, 300, 0.12, 0.12); };
  S.coin = () => { tone("triangle", 1568, 1568, 0.09, 0.12); tone("triangle", 2093, 2093, 0.22, 0.12, null, 0.08); };
  S.level = () => [523, 659, 784, 1046].forEach((f, i) => tone("triangle", f, f, 0.25, 0.12, null, i * 0.1));
  S.trophy = () => [392, 523, 659, 784, 1046, 1318].forEach((f, i) => tone("triangle", f, f, 0.35, 0.1, null, i * 0.07));
  S.fail = () => { tone("sawtooth", 300, 120, 0.35, 0.06); };
  S.drill = (dur) => { for (let i = 0; i < 8; i++) noise(0.22, "bandpass", 500 + Math.random() * 300, 300, 0.16, 3, i * dur / 8); };
  S.flop = () => { noise(0.08, "lowpass", 1800, 600, 0.25); };
  S.thunder = () => { noise(2.2, "lowpass", 400, 60, 0.45, 0.7); };
  // трещотка катушки (вызывать часто при подмотке)
  let lastClick = 0;
  S.reel = function (speed) { if (!ac) return; const now = ac.currentTime; if (now - lastClick < 0.07 / Math.max(0.3, speed)) return; lastClick = now; tone("square", 2400, 1800, 0.012, 0.025); };
  // фрикцион «поёт»
  let lastDrag = 0;
  S.drag = function (k) { if (!ac) return; const now = ac.currentTime; if (now - lastDrag < 0.045) return; lastDrag = now; tone("sawtooth", 1500 + k * 900, 1300, 0.04, 0.035 + k * 0.03); };

  // ---------- Музыка ----------
  S.playMusic = function (key) {
    const url = FZ.Assets.audio(key) || FZ.Assets.audio("music_" + key);
    if (!url || !S.music) { S.stopMusic(); return; }
    if (musicKey === key && music) return;
    const old = music; musicKey = key;
    music = new Audio(url); music.loop = true; music.volume = 0;
    music.play().catch(function () {});
    fade(music, musicVol, 1.5);
    if (old) { fade(old, 0, 1.2, function () { old.pause(); }); }
  };
  S.stopMusic = function () { if (music) { const m = music; fade(m, 0, 0.8, () => m.pause()); music = null; musicKey = ""; } };
  function fade(a, to, dur, done) {
    const from = a.volume, t0 = performance.now();
    const step = function () { const k = Math.min(1, (performance.now() - t0) / (dur * 1000)); try { a.volume = from + (to - from) * k; } catch (e) {} if (k < 1) requestAnimationFrame(step); else if (done) done(); };
    step();
  }

  S.setOn = function (v) { S.on = v; if (master) master.gain.value = v ? 1 : 0; };
  S.setMusic = function (v) { S.music = v; if (!v) S.stopMusic(); };
  S.suspend = function () { if (ac) ac.suspend(); if (music) music.pause(); };
  S.resume = function () { if (ac) ac.resume(); if (music && S.music) music.play().catch(function () {}); };

  FZ.Sound = S;
})(window.FZ);
