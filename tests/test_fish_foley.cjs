// Fishing sampled Foley regression: run with node tests/test_fish_foley.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..', 'games', 'fish');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const atlasSource = read('js', 'foley-bank.js');
const audioSource = read('js', 'audio.js');
const html = read('index.html');
const manifestSource = read('assets', 'assets.js');
new vm.Script(audioSource, {filename: 'audio.js'});
new vm.Script(atlasSource, {filename: 'foley-bank.js'});
const bankWindow = {};
vm.runInNewContext(atlasSource, {window: bankWindow});
const atlas = bankWindow.FZ_FOLEY;
assert.equal(Buffer.from(atlas.base64, 'base64').subarray(0, 4).toString('ascii'), 'OggS');
assert.ok(Buffer.from(atlas.base64, 'base64').length > 2000);
assert.ok(html.indexOf('js/foley-bank.js') < html.indexOf('js/audio.js'));
let prevEnd = 0;
for (const name of ['reel_tick', 'drag_click', 'drag_rattle', 'drag_strain', 'line_snap']) {
  const cue = atlas.cues[name];
  assert.equal(cue.length, 2);
  assert.ok(cue[0] >= prevEnd - 0.001 && cue[1] > 0.1);
  prevEnd = cue[0] + cue[1];
}
assert.ok(prevEnd < 3.6, 'samples must fit within compact 3.6s atlas');
const assetWindow = {};
vm.runInNewContext(manifestSource, {window: assetWindow});
// Optional MP3s are not in the repository yet: do not request missing assets.
assert.ok(!assetWindow.FZ_ASSETS.audio.music_wooden_docks);
assert.ok(!assetWindow.FZ_ASSETS.audio.music_still_water);
assert.ok(assetWindow.FZ_ASSETS.audio.music_summer);
assert.ok(assetWindow.FZ_ASSETS.audio.music_night);

// Fake Web Audio: verify event routing without depending on a speaker or Android.
const starts = [];
const param = (value=0) => ({
  value, setValueAtTime(){}, exponentialRampToValueAtTime(){},
  setTargetAtTime(){}, cancelScheduledValues(){}
});
function node() {
  return {
    gain: param(), frequency: param(), Q: param(), threshold: param(), knee: param(),
    ratio: param(), attack: param(), release: param(), playbackRate: param(1),
    connect(){return this;}, disconnect(){}, stop(){},
    start(...args){starts.push({buffer:this.buffer, args});}
  };
}
class FakeAudioContext {
  constructor() { this.sampleRate=8000; this.currentTime=10; this.state='running'; this.destination=node(); }
  createGain(){return node();}
  createDynamicsCompressor(){return node();}
  createBufferSource(){return node();}
  createOscillator(){return node();}
  createBiquadFilter(){return node();}
  createBuffer(_channels,length){return { getChannelData(){return new Float32Array(length);} };}
  decodeAudioData(_bytes){return Promise.resolve({isFoley:true});}
}
const playedMusic = [];
class FakeAudio {
  constructor(src){this.src=src;this.volume=0;this.events={}; playedMusic.push(this);}
  addEventListener(event,fn){this.events[event]=fn;}
  play(){return Promise.resolve();}
  pause(){}
}
const gameWindow = {
  AudioContext: FakeAudioContext,
  FZ_FOLEY: atlas,
  FZ: { Assets: { audio(key) {
    return assetWindow.FZ_ASSETS.audio[key] ? 'assets/'+assetWindow.FZ_ASSETS.audio[key] : null;
  } } }
};
const ctx = {window:gameWindow, Audio:FakeAudio,
  Uint8Array, Float32Array, Math, Number, setTimeout,
  atob(str){return Buffer.from(str,'base64').toString('latin1');},
  performance:{now:()=>0}, requestAnimationFrame(){}};
vm.runInNewContext(audioSource,ctx);
(async () => {
  const S=gameWindow.FZ.Sound;
  S.unlock();
  await Promise.resolve(); // decodeAudioData asynchronously resolves before gameplay
  assert.equal(S.mixInfo().sampledFoley,true);
  starts.length=0;
  S.reel(2);
  S.drag(.85);
  S.snap();
  const shots=starts.filter(s=>s.buffer && s.buffer.isFoley).map(s=>s.args[1]);
  assert.deepEqual(shots,[0,2,2.92], 'reel / heavy drag / line snap atlas timings');
  S.playMusic('summer');
  assert.ok(playedMusic.at(-1).src.endsWith('music_summer.mp3'), 'use shipped track when optional MP3 absent');
  // Once installed, new compositions should be preferred but still fall back on decode failure.
  assetWindow.FZ_ASSETS.audio.music_wooden_docks='audio/music_wooden_docks.mp3';
  assetWindow.FZ_ASSETS.audio.music_still_water='audio/music_still_water.mp3';
  S.playMusic('spring');
  assert.ok(playedMusic.at(-1).src.endsWith('music_wooden_docks.mp3'));
  playedMusic.at(-1).events.error();
  assert.ok(playedMusic.at(-1).src.endsWith('music_spring.mp3'), 'fallback if added MP3 failed');
  S.playMusic('night');
  assert.ok(playedMusic.at(-1).src.endsWith('music_still_water.mp3'));
  console.log('PASS: 5 Foley cues, real-time triggers, music and fallback');
})().catch(err=>{console.error(err); process.exitCode=1;});
