/* Звук: WebAudio-окружение и эффекты; музыка — из файлов ACE-Step, если они есть */
(function (FZ) {
  "use strict";
  const S = { on: true, music: true };
  let ac = null, master, amb, sfx, noiseBuf = null;
  const A = {};
  let mix = { ambienceVolume:.72, effectsVolume:.72, musicVolume:.32 };
  let music = null, musicKey = "", musicVol = 0.32;
  let nextBird = 0, nextCrack = 0, nextFrog = 0, cricket = null;
  let ambParams = {};

  S.unlock = function () {
    if (ac) { if (ac.state === "suspended") ac.resume().catch(function () {}); return; }
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    ac = new C();
    master = ac.createGain(); master.gain.value = S.on ? 0.82 : 0;
    const limiter = ac.createDynamicsCompressor();
    limiter.threshold.value = -12; limiter.knee.value = 18; limiter.ratio.value = 8;
    limiter.attack.value = 0.004; limiter.release.value = 0.18;
    master.connect(limiter); limiter.connect(ac.destination);
    amb = ac.createGain(); amb.gain.value = mix.ambienceVolume; amb.connect(master);
    sfx = ac.createGain(); sfx.gain.value = mix.effectsVolume; sfx.connect(master);
    // Eight seconds of band-limited noise, with an actual periodic crossfade.
    // The old buffer ended at a different sample than it started, producing clicks.
    const seam = Math.floor(ac.sampleRate * .20), count = ac.sampleRate * 8;
    const raw = new Float32Array(count + seam); let pink = 0, brown = 0;
    for (let i=0;i<raw.length;i++) {
      pink = pink * .92 + (Math.random()*2-1)*.08;
      brown = brown * .996 + pink * .004;
      raw[i] = pink * .72 + brown * .28;
    }
    noiseBuf = ac.createBuffer(1, count, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for(let i=0;i<count;i++) {
      if(i<seam){const a=i/seam;d[i]=raw[count+i]*(1-a)+raw[i]*a;}
      else d[i]=raw[i];
    }
    A.water = loopNoise("lowpass", 520, 0.6);
    A.water.lfo = lfo(0.13, 0.012, A.water.g.gain);
    A.wind = loopNoise("lowpass", 650, 0.35);
    A.rain = loopNoise("lowpass", 1050, 0.3);
    S.updateAmbience(ambParams);
  };

  function loopNoise(type, f, q) {
    const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = ac.createGain(); g.gain.value = 0;
    src.connect(fl); fl.connect(g); g.connect(amb); src.start(0,Math.random()*6);
    return { src, f: fl, g };
  }
  function lfo(freq, depth, param) {
    const o = ac.createOscillator(); o.frequency.value = freq;
    const g = ac.createGain(); g.gain.value = depth; o.connect(g); g.connect(param); o.start(); return o;
  }
  function env(g, t, a, peak, d, end) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t + a);
    g.gain.exponentialRampToValueAtTime(end || 0.0001, t + a + d);
  }
  function tone(type, f0, f1, dur, vol, dest, delay) {
    if (!ac || !S.on) return;
    const t = ac.currentTime + (delay || 0);
    const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ac.createGain(); env(g, t, 0.008, vol, dur);
    o.connect(g); g.connect(dest || sfx); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, type, f0, f1, vol, q, delay, dest) {
    if (!ac || !S.on) return;
    const t = ac.currentTime + (delay || 0);
    const src = ac.createBufferSource(); src.buffer = noiseBuf; src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const fl = ac.createBiquadFilter(); fl.type = type; fl.Q.value = q || 0.8; fl.frequency.setValueAtTime(f0, t);
    if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ac.createGain(); env(g, t, 0.01, vol, dur);
    src.connect(fl); fl.connect(g); g.connect(dest || sfx); src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }

  S.updateAmbience = function (p) {
    ambParams = p || {};
    if (!ac) return;
    const t = ac.currentTime, ice = p.mode === "ice";
    const river = p.style === "river" || p.style === "taiga";
    const wind = Math.max(0, Math.min(10, Number(p.wind) || 0));
    A.water.g.gain.setTargetAtTime(ice ? 0 : (river ? 0.17 : 0.095), t, 1.1);
    A.water.f.frequency.setTargetAtTime(river ? 760 : 430, t, 1.2);
    A.wind.g.gain.setTargetAtTime(0.008 + wind * (ice ? 0.0018 : 0.0012), t, 1.5);
    A.wind.f.frequency.setTargetAtTime(380 + wind * 28, t, 1.5);
    const rainLevel = p.sky === "rain" ? 0.045 : p.sky === "storm" ? 0.068 : 0;
    A.rain.g.gain.setTargetAtTime(ice ? 0 : rainLevel, t, 1.8);
    A.rain.f.frequency.setTargetAtTime(p.sky === "storm" ? 790 : 1050, t, 2);
    const crickets = !ice && p.period === "night" && (p.season === "summer" || p.season === "autumn");
    if (crickets && !cricket) {
      const o = ac.createOscillator(); o.frequency.value = 4300;
      const g = ac.createGain(); g.gain.value = 0;
      const pulse = ac.createOscillator(); pulse.type = "square"; pulse.frequency.value = 28;
      const pg = ac.createGain(); pg.gain.value = 0.003;
      pulse.connect(pg); pg.connect(g.gain);
      const slow = ac.createOscillator(); slow.frequency.value = 0.9;
      const sg = ac.createGain(); sg.gain.value = 0.5; slow.connect(sg); sg.connect(pulse.frequency);
      o.connect(g); g.connect(amb); o.start(); pulse.start(); slow.start();
      g.gain.setTargetAtTime(0.004, t, 1.2);
      cricket = { o, pulse, slow, g };
    } else if (!crickets && cricket) {
      try { cricket.g.gain.setTargetAtTime(0.0001, t, 0.25); cricket.o.stop(t + 1); cricket.pulse.stop(t + 1); cricket.slow.stop(t + 1); } catch (e) {}
      cricket = null;
    }
  };

  S.tick = function () {
    if (!ac || !S.on || ac.state !== "running") return;
    const p = ambParams, now = ac.currentTime;
    if ((p.period === "dawn" || p.period === "day") && p.season !== "winter" && now > nextBird) {
      nextBird = now + 3 + Math.random() * (p.period === "dawn" ? 4 : 8);
      const base = 2400 + Math.random() * 2200, n = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) tone("sine", base * (1 + Math.random() * 0.3), base * (0.8 + Math.random() * 0.6), 0.07 + Math.random() * 0.08, 0.022, amb, i * (0.1 + Math.random() * 0.07));
    }
    if (p.mode === "ice" && now > nextCrack) {
      nextCrack = now + 16 + Math.random() * 28;
      tone("sine", 180, 38, 1.4, 0.11, amb);
      noise(0.7, "lowpass", 650, 100, 0.07, 1, 0, amb);
    }
    if (p.mode !== "ice" && (p.style === "pond" || p.style === "delta") && (p.period === "dusk" || p.period === "night") && (p.season === "summer" || p.season === "spring") && now > nextFrog) {
      nextFrog = now + 4 + Math.random() * 7;
      for (let i = 0; i < 3; i++) tone("triangle", 110 + Math.random() * 30, 90, 0.12, 0.022, amb, i * 0.16);
    }
  };

  S.click = () => tone("triangle", 900, 700, 0.05, 0.06);
  S.cast = () => { noise(0.45, "bandpass", 800, 3000, 0.13, 1.2); tone("sine", 600, 1400, 0.3, 0.025); };
  S.plop = (big) => { tone("sine", big ? 320 : 700, big ? 90 : 180, 0.18, 0.18); noise(0.25, "lowpass", 1800, 350, big ? 0.22 : 0.12); };
  S.splash = (k) => { noise(0.5 + k * 0.4, "lowpass", 2400, 260, 0.16 + k * 0.16); tone("sine", 260, 70, 0.3, 0.1 * k); };
  S.bite = () => tone("sine", 1200, 900, 0.06, 0.055);
  S.bell = () => { [1320, 1980, 2640].forEach((f, i) => tone("sine", f, f * 0.995, 0.6 - i * 0.15, 0.045 / (i + 1))); };
  S.strike = () => { noise(0.18, "bandpass", 2000, 800, 0.18, 2); tone("square", 300, 120, 0.08, 0.035); };
  S.snap = () => { noise(0.08, "highpass", 3000, 6000, 0.28); tone("square", 1900, 300, 0.12, 0.08); };
  S.coin = () => { tone("triangle", 1568, 1568, 0.09, 0.09); tone("triangle", 2093, 2093, 0.22, 0.09, null, 0.08); };
  S.level = () => [523, 659, 784, 1046].forEach((f, i) => tone("triangle", f, f, 0.25, 0.09, null, i * 0.1));
  S.trophy = () => [392, 523, 659, 784, 1046, 1318].forEach((f, i) => tone("triangle", f, f, 0.35, 0.075, null, i * 0.07));
  S.fail = () => tone("triangle", 300, 120, 0.35, 0.05);
  S.drill = (dur) => { for (let i = 0; i < 8; i++) noise(0.22, "bandpass", 500 + Math.random() * 300, 300, 0.11, 3, i * dur / 8); };
  S.flop = () => noise(0.08, "lowpass", 1500, 500, 0.18);
  S.thunder = () => { noise(2.8, "lowpass", 260, 48, 0.22, 0.65); noise(1.8, "lowpass", 110, 35, 0.12, 0.7, 0.12); };

  let lastClick = 0;
  S.reel = function (speed) { if (!ac || !S.on) return; const now = ac.currentTime; if (now - lastClick < 0.07 / Math.max(0.3, speed)) return; lastClick = now; noise(0.025, "bandpass", 780, 440, 0.035, .45); };
  let lastDrag = 0;
  S.drag = function (k) { if (!ac || !S.on) return; const now = ac.currentTime; if (now - lastDrag < 0.045) return; lastDrag = now; noise(0.065, "bandpass", 700 + k * 450, 500, 0.045 + k * 0.025, .4); };

  S.playMusic = function (key) {
    const url = FZ.Assets.audio(key) || FZ.Assets.audio("music_" + key);
    if (!url || !S.music) { S.stopMusic(); return; }
    if (musicKey === key && music) return;
    const old = music; musicKey = key;
    music = new Audio(url); music.loop = true; music.volume = 0;
    music.play().catch(function () {});
    fade(music, musicVol, 1.5);
    if (old) fade(old, 0, 1.2, function () { old.pause(); });
  };
  S.stopMusic = function () { if (music) { const m = music; fade(m, 0, 0.8, () => m.pause()); music = null; musicKey = ""; } };
  function fade(a, to, dur, done) {
    const from = a.volume, t0 = performance.now();
    const step = function () {
      const k = Math.min(1, (performance.now() - t0) / (dur * 1000));
      try { a.volume = from + (to - from) * k; } catch (e) {}
      if (k < 1) requestAnimationFrame(step); else if (done) done();
    };
    step();
  }

  S.setMix = function(values) {
    for (const k of Object.keys(mix)) { const n=Number(values[k]); if(Number.isFinite(n)) mix[k]=Math.max(0,Math.min(1,n)); }
    musicVol=mix.musicVolume;
    if(ac){amb.gain.setTargetAtTime(mix.ambienceVolume,ac.currentTime,.08);sfx.gain.setTargetAtTime(mix.effectsVolume,ac.currentTime,.08);}
    if(music)music.volume=musicVol;
  };
  S.mixInfo = function(){return Object.assign({state:ac?ac.state:'locked'},mix);};
  S.setOn = function (v) { S.on = !!v; if (master && ac) master.gain.setTargetAtTime(S.on ? 0.82 : 0, ac.currentTime, 0.04); };
  S.setMusic = function (v) { S.music = !!v; if (!S.music) S.stopMusic(); };
  S.suspend = function () { if (ac && ac.state === "running") ac.suspend().catch(function () {}); if (music) music.pause(); };
  S.resume = function () { if (ac && ac.state === "suspended") ac.resume().catch(function () {}); if (music && S.music) music.play().catch(function () {}); };

  FZ.Sound = S;
})(window.FZ);
