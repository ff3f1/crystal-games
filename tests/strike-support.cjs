// Run from the extracted archive: node --test tests/fight-reaction.test.cjs
// Uses the actual two production scripts; only absent world/render/audio APIs
// are fixtures. Gear values below are test scenarios, not production balance.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function boot({ ice = false, lineTest = 4, drag = .7, seed = 17, saved, mode = ice ? "ice" : "float", sens = .7 } = {}) {
  let rng = seed >>> 0;
  const rand = () => ((rng = (1664525 * rng + 1013904223) >>> 0) / 4294967296);
  rand.range = (a, b) => a + (b - a) * rand();
  rand.int = (a, b) => Math.floor(rand.range(a, b + 1));
  const noop = () => {};
  const rod = { power: 4, sens, reel: 1.4, cast: 40 };
  const bait = { id: 'worm', m: ['float', 'feeder', 'spin', 'ice'], lure: mode === 'spin' ? 'mid' : null, n: 'worm' };
  const FZ = {
    U: { rand, clamp: (v, a, b) => Math.min(b, Math.max(a, v)),
      damp: (v, target, rate, dt) => v + (target - v) * (1 - Math.exp(-rate * dt)),
      lerp: (a, b, t) => a + (b - a) * t, smooth: t => t * t * (3 - 2 * t),
      dayKey: () => '2026-11-17', seasonOf: () => 'summer' },
    World: { quests: () => [], ACHIEVEMENTS: [], firstIceActive: () => false, weather: () => ({}) },
    LOC: { pond: { id: 'pond', current: 0, zfar: 100, depth: [2, 8], fish: {} } },
    ROD: { f1: rod, i1: rod }, LINE: { l1: { test: lineTest } },
    HOOK: { h1: { hold: 1 }, h2: { hold: 1 } }, BAIT: { worm: bait }, BAITS: [bait],
    Scene: { shake: noop, splash: noop, ring: noop, period: () => 'day', maxLat: () => 1000,
      chips: noop, holeGeom: () => ({ x: 0, y: 0 }) },
    Sound: { bite: noop, bell: noop, strike: noop, splash: noop, drag: noop, reel: noop, snap: noop, fail: noop },
    Platform: { vibrate: noop }
  };
  const storage = new Map(saved ? [['fz_save', saved]] : []);
  const ctx = vm.createContext({ window: { FZ }, console,
    localStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v) } });
  for (const name of ['fight-physics.js', 'game.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../games/fish/js', name), 'utf8'), ctx, { filename: name });
  }
  const G = FZ.Game;
  G.load(); G.state().tut = 3; G.state().drag = drag;
  G.state().active = mode === 'ice' ? 'float' : mode;
  G.state().load[mode].rod = mode === 'ice' ? 'i1' : 'f1';
  G.state().load[mode].bait = 'worm';
  if (mode === 'spin') G.state().lures.worm = 1;
  G.startSession('pond', mode === 'ice' ? 'winter' : 'summer');
  G.sess().hole = { depth: 8, lure: .8 }; G.sess().nextSpot = 10000;
  const species = { id: 'perch', lwA: .00001, trophy: 10,
    fight: { power: 1.8, stamina: 8, runs: .6, shake: .2, jump: 0 } };
  const r = G.rig();
  r.Z = 25;
  r.state = 'bite'; r.bite = { s: species, w: 1.5, phase: 'take', t: .35, take: 1, style: 'twitch' };
  // Force a successful strike without substituting the game's hook/fight code.
  const originalRand = FZ.U.rand;
  const strikeRand = () => 0; strikeRand.range = originalRand.range;
  FZ.U.rand = strikeRand; G.strike(); FZ.U.rand = originalRand;
  G.events();
  let clock = 0;
  return { G, P: FZ.FightPhysics, FZ, storage, r, species,
    step(dt) { clock += dt; G.update(dt, clock); return G.events(); } };
}

module.exports = { boot };
