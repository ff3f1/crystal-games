/* Звук: WebAudio-окружение и эффекты; музыка — из файлов ACE-Step, если они есть */
(function (FZ) {
  "use strict";
  const S = { on: true, music: true };
  let ac = null, master, amb, sfx, noiseBuf = null;
  const A = {};
  let mix = { ambienceVolume:.72, effectsVolume:.72, musicVolume:.32 };
  let music = null, musicKey = "", musicVol = 0.32;
  let nextBird = 0, nextCrack = 0, nextFrog = 0, nextRainDrop = 0, cricket = null;
  let ambParams = {};

  S.unlock = function () {
    if (ac) { if (ac.state === "suspended") ac.resume().catch(function () {}); return; }
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    ac = new C();
    master = ac.createGain(); master.gain.value = S.on ? 0.69 : 0;
    const limiter = ac.createDynamicsCompressor();
    limiter.threshold.value = -17; limiter.knee.value = 16; limiter.ratio.value = 3.5;
    limiter.attack.value = 0.012; limiter.release.value = 0.34;
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
    A.water = loopNoise("lowpass", 520, 0.45);
    A.water.lfo = lfo(0.13, 0.012, A.water.g.gain);
    A.wind = loopNoise("lowpass", 650, 0.35);
    A.rain = loopNoise("lowpass", 1150, 0.35);
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
    A.water.g.gain.setTargetAtTime(ice ? 0 : (river ? 0.15 : 0.11), t, 2.1);
    A.water.f.frequency.setTargetAtTime(river ? 760 : 430, t, 1.2);
    A.wind.g.gain.setTargetAtTime(0.008 + wind * (ice ? 0.0018 : 0.0012), t, 1.5);
    A.wind.f.frequency.setTargetAtTime(380 + wind * 28, t, 1.5);
    const rainLevel = p.sky === "rain" ? 0.038 : p.sky === "storm" ? 0.064 : 0;
    A.rain.g.gain.setTargetAtTime(ice ? 0 : rainLevel, t, 1.8);
    A.rain.f.frequency.setTargetAtTime(p.sky === "storm" ? 790 : 1050, t, 2);
    // No continuous 4.3 kHz electronic "cricket": it was an audible alarm.
    // Retire any voice left after a weather / season transition.
    if(cricket){
      try{cricket.g.gain.setTargetAtTime(0,t,.1);cricket.o.stop(t+.5);cricket.pulse.stop(t+.5);cricket.slow.stop(t+.5);}catch(_){}
      cricket=null;
    }
  };

  S.tick = function () {
    if(!ac||!S.on||ac.state!=="running")return;
    const p=ambParams,now=ac.currentTime;
    // Brief broadband reed / foliage movements rather than repeating sine beeps.
    if(p.mode!=="ice" && (p.period==="dawn"||p.period==="day") && p.season!=="winter" && now>nextBird){
      nextBird=now+7+Math.random()*13;
      noise(.30+Math.random()*.20,"bandpass",1100+Math.random()*650,600+Math.random()*300,.009,1.1,0,amb);
    }
    if(p.mode==="ice"&&now>nextCrack){
      nextCrack=now+22+Math.random()*36;
      noise(.65,"lowpass",420,70,.027,.7,0,amb);
      noise(.21,"bandpass",650,200,.013,.9,.07,amb);
    }
    if(p.mode!=="ice"&&(p.style==="pond"||p.style==="delta")&&
       (p.period==="dusk"||p.period==="night")&&now>nextFrog){
      nextFrog=now+9+Math.random()*18;
      // Low, woody pulse rather than a triangle-wave cartoon frog.
      for(let i=0;i<2;i++)noise(.13,"bandpass",380,240,.011,2.4,i*.21,amb);
    }
    if((p.sky==="rain"||p.sky==="storm")&&p.mode!=="ice"&&now>nextRainDrop){
      nextRainDrop=now+.19+Math.random()*.37;
      noise(.09+Math.random()*.09,"bandpass",900+Math.random()*500,450,.011,1.1,0,amb);
    }
  };

  // Material-oriented Foley, with noise impacts and decaying resonances.
  // Low levels leave room for the actual ambience and prevent mobile clipping.
  S.click=()=>noise(.035,"lowpass",1050,650,.028,.7);
  S.cast=()=>{
    noise(.30,"bandpass",720,1700,.055,.9);
    noise(.21,"lowpass",1800,500,.025,.65,.09);
  };
  S.plop=(big)=>{
    const k=big?1:.55;
    noise(.21,"lowpass",1250,160,.12*k,.7);
    noise(.12,"bandpass",360,140,.061*k,1.6,.035);
    tone("sine",big?145:220,78,.16,.031*k,null,.045);
  };
  S.splash=(k)=>{
    k=Math.max(.1,Math.min(2.5,Number(k)||.6));
    const amount=.07+Math.min(.13,k*.053);
    noise(.46+k*.22,"lowpass",2400,320,amount,.55);
    noise(.23+k*.15,"bandpass",850,240,amount*.48,.68,.055);
    noise(.16,"highpass",1600,600,amount*.25,.5,.12);
  };
  S.bite=()=>{
    // The float and rod provide the primary bite indication.
    noise(.075,"bandpass",1050,430,.018,1.2);
  };
  S.bell=()=>{
    // Feeder bell: weak high harmonics with a longer, natural decay.
    [1130,1840,2570].forEach((f,i)=>tone("sine",f,f*.995,.55-i*.1,.012/(i+1),null,i*.006));
  };
  S.strike=()=>{noise(.21,"bandpass",1000,320,.083,.65);noise(.11,"highpass",1750,720,.031,.8,.025);};
  S.snap=()=>{noise(.09,"highpass",2700,1050,.15,.6);noise(.17,"lowpass",770,190,.056,.7,.035);};
  S.coin=()=>{tone("triangle",1568,1568,.09,.044);tone("triangle",2093,2093,.18,.043,null,.07);};
  S.level=()=>[523,659,784,1046].forEach((f,i)=>tone("triangle",f,f,.22,.048,null,i*.1));
  S.trophy=()=>[392,523,659,784,1046,1318].forEach((f,i)=>tone("triangle",f,f,.3,.042,null,i*.075));
  S.fail=()=>tone("triangle",300,160,.26,.027);
  S.drill=(dur)=>{
    const n=Math.min(12,Math.max(3,Math.round(dur*4)));
    for(let i=0;i<n;i++)noise(.17,"bandpass",570+Math.random()*190,270,.065,1.6,i*dur/n);
  };
  S.flop=()=>{noise(.11,"lowpass",960,240,.089,.75);noise(.13,"bandpass",460,170,.032,.8,.03);};
  S.thunder=()=>{
    noise(2.5,"lowpass",210,45,.105,.55);
    noise(1.5,"lowpass",120,36,.063,.7,.15);
  };

  let lastClick=0;
  S.reel=function(speed){
    if(!ac||!S.on)return;
    const now=ac.currentTime;
    if(now-lastClick<Math.max(.095,.22/Math.max(.5,speed)))return;
    lastClick=now;
    noise(.025,"bandpass",1050,410,.018,.75);
    noise(.038,"lowpass",470,240,.015,.8,.009);
  };
  let lastDrag=0;
  S.drag=function(k){
    if(!ac||!S.on)return;
    const now=ac.currentTime;
    if(now-lastDrag<.16)return;lastDrag=now;
    noise(.075,"bandpass",710+k*170,300,.033+k*.018,.72);
    noise(.085,"lowpass",490,175,.021,.8,.018);
  };

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
  S.setOn = function (v) { S.on = !!v; if (master && ac) master.gain.setTargetAtTime(S.on ? 0.69 : 0, ac.currentTime, 0.04); };
  S.setMusic = function (v) { S.music = !!v; if (!S.music) S.stopMusic(); };
  S.suspend = function () { if (ac && ac.state === "running") ac.suspend().catch(function () {}); if (music) music.pause(); };
  S.resume = function () { if (ac && ac.state === "suspended") ac.resume().catch(function () {}); if (music && S.music) music.play().catch(function () {}); };

  FZ.Sound = S;
})(window.FZ);
