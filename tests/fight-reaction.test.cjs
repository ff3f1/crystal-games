// Run from the extracted archive: node --test tests/fight-reaction.test.cjs
// Uses the actual two production scripts; only absent world/render/audio APIs
// are fixtures. Gear values below are test scenarios, not production balance.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function boot({ ice = false, lineTest = 4, drag = .7, seed = 17, saved } = {}) {
  let rng = seed >>> 0;
  const rand = () => ((rng = (1664525 * rng + 1013904223) >>> 0) / 4294967296);
  rand.range = (a, b) => a + (b - a) * rand();
  const noop = () => {};
  const rod = { power: 4, sens: .7, reel: 1.4, cast: 40 };
  const bait = { id: 'worm', m: ['float', 'ice'], n: 'worm' };
  const FZ = {
    U: { rand, clamp: (v, a, b) => Math.min(b, Math.max(a, v)),
      damp: (v, target, rate, dt) => v + (target - v) * (1 - Math.exp(-rate * dt)),
      lerp: (a, b, t) => a + (b - a) * t, smooth: t => t * t * (3 - 2 * t),
      dayKey: () => '2026-11-17', seasonOf: () => 'summer' },
    World: { quests: () => [], ACHIEVEMENTS: [], firstIceActive: () => false, weather: () => ({}) },
    LOC: { pond: { id: 'pond', current: 0, zfar: 100, depth: [2, 8], fish: {} } },
    ROD: { f1: rod, i1: rod }, LINE: { l1: { test: lineTest } },
    HOOK: { h1: { hold: 1 }, h2: { hold: 1 } }, BAIT: { worm: bait }, BAITS: [bait],
    Scene: { shake: noop, splash: noop, period: () => 'day', maxLat: () => 1000,
      chips: noop, holeGeom: () => ({ x: 0, y: 0 }) },
    Sound: { strike: noop, splash: noop, drag: noop, reel: noop, snap: noop, fail: noop },
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
  G.startSession('pond', ice ? 'winter' : 'summer');
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
  return { G, P: FZ.FightPhysics, FZ, storage, r,
    step(dt) { clock += dt; G.update(dt, clock); return G.events(); } };
}

test('telegraph locks the run, warns low stamina fish, and samples once', () => {
  const { P } = boot();
  const f = { phaseT: .4, S: .2 };
  let calls = 0;
  assert.equal(P.runTell(f, .4, () => { calls++; return .3; }, .1), true);
  assert.equal(f.telegraph, true);
  for (let i = 0; i < 6; i++) {
    f.phaseT -= .1;
    P.runTell(f, .04, () => { calls++; return .99; }, .1);
    assert.equal(f.telegraph, true);
    assert.equal(f.nextRun, true);
  }
  P.runTell(f, .04, () => { calls++; return .99; }, .1);
  assert.equal(f.telegraph, false);
  assert.equal(calls, 1);
});

test('no premature or phantom warning for a non-run decision', () => {
  const { P } = boot();
  const f = { phaseT: 2, S: 1 };
  const random = () => .9;
  P.runTell(f, .3, random, .02);
  assert.equal(f.nextDecision, undefined);
  assert.equal(f.telegraph, false);
  f.phaseT = .4;
  P.runTell(f, .3, random, .02);
  P.runTell(f, .99, random, .02);
  assert.equal(f.nextRun, false);
  assert.equal(f.telegraph, false);
});

for (const ice of [false, true]) {
  for (const fps of [30, 60, 120]) {
    test(`first run has >= 650 ms visible warning: ice=${ice}, ${fps} FPS`, () => {
      const b = boot({ ice, lineTest: 20 });
      b.r.reeling = true;
      let firstCue = null, start = null, cues = 0;
      for (let n = 1; n <= fps * 2; n++) {
        const events = b.step(1 / fps);
        for (const e of events) if (e.text === 'Сейчас рывок — отпустите подмотку!') {
          firstCue ??= n / fps; cues++;
        }
        if (b.r.fish.phase === 'run') { start = n / fps; break; }
      }
      assert.equal(cues, 1);
      assert.ok(start - firstCue >= .65 - 1e-9);
      assert.ok(start - firstCue < .65 + 1 / fps + 1e-9);
      assert.equal(b.r.fish.surge, 0); // preserve the first pull's original load
      if (ice) { assert.equal(b.r.fish.X, 0); assert.equal(b.r.fish.Z, 0); assert.equal(b.r.fish.vx, 0); }
    });
  }
  test(`forced close-range phase end still warns: ice=${ice}`, () => {
    const b = boot({ ice, lineTest: 20 });
    Object.assign(b.r.fish, { firstRunDuration: null, phase: 'rest', phaseT: 0,
      nextDecision: 0, nextRun: null, runWarning: null, Z: 3.6, D: .5 });
    b.r.reeling = true;
    for (let i = 0; i < 35; i++) { b.step(1 / 60); assert.equal(b.r.fish.phase, 'rest'); }
    for (let i = 0; i < 8; i++) b.step(1 / 60);
    assert.equal(b.r.fish.phase, 'run');
  });
}

test('finished jump cannot bypass warning or linger with stale hook damage', () => {
  const b = boot({ lineTest: 20 });
  Object.assign(b.r.fish, { firstRunDuration: null, phase: 'rest', phaseT: 2,
    nextDecision: 0, nextRun: null, runWarning: null, jump: { k: 1, dur: .95, hurt: false } });
  b.step(1 / 60);
  assert.equal(b.r.fish.jump, null);
  assert.equal(b.r.fish.telegraph, true);
  assert.equal(b.r.fish.phase, 'rest');
});

test('carp second wind still warns and occurs once; never on ice', () => {
  for (const ice of [false, true]) {
    const b = boot({ ice, lineTest: 20 });
    const f = b.r.fish;
    f.s.id = 'carp';
    Object.assign(f, { S: .2, t: 6, Z: 8, phaseT: 3, nextDecision: null });
    b.step(1 / 60);
    assert.equal(!!f.secondWind, !ice);
    assert.equal(f.telegraph, !ice);
    assert.equal(b.P.secondWind(f.s, f, 8, ice), false);
  }
});

test('release unloads the burst; reeling again cannot exploit one transition frame', () => {
  const { P } = boot();
  const c = P.character({ id: 'pike' });
  const held = { phase: 'run', runAge: 0 }, released = { phase: 'run', runAge: 0 };
  for (let i = 0; i < 6; i++) { P.runSurge(held, true, c, 1 / 60); P.runSurge(released, true, c, 1 / 60); }
  for (let i = 0; i < 12; i++) { P.runSurge(held, true, c, 1 / 60); P.runSurge(released, false, c, 1 / 60); }
  assert.ok(released.surge < held.surge * .15);
  P.runSurge(released, true, c, 1 / 60);
  assert.ok(released.surge > held.surge * .9);
  assert.ok(Math.abs(held.surge - .26 * c.surge * Math.exp(-3.5 * .3)) < 1e-12);
});

test('jump load is bounded and comparable at 30/60/120 FPS', () => {
  const { P } = boot();
  const peaks = [];
  for (const fps of [30, 60, 120]) {
    const f = { Fmax: 4, T: 2.5, vx: 0, vz: 0 };
    let peak = 0;
    for (let i = 1; i <= fps; i++) {
      P.line(f, { rod: { power: 4, sens: .7, reel: 1 }, lineTest: 100, drag: 1,
        fishPull: 2.5, phase: 'run', currentLoad: 0, surge: 0, reeling: false,
        jumping: true, jumpProgress: i / fps }, 1 / fps);
      peak = Math.max(peak, f.T);
    }
    assert.ok(peak <= 2.5 * 1.3);
    peaks.push(peak);
  }
  assert.ok(Math.max(...peaks) - Math.min(...peaks) < .02);
});

for (const ice of [false, true]) for (const fps of [30, 60, 120]) {
  test(`release saves the same dangerous run, including after onset: ice=${ice}, ${fps} FPS`, () => {
    function encounter(releaseAt, lineTest = 5, drag = 1) {
      const b = boot({ ice, lineTest, drag });
      const f = b.r.fish;
      Object.assign(f, { firstRunDuration: null, phase: 'rest', phaseT: .1, nextDecision: 0, S: .95 });
      let peak = 0, runAt = null;
      for (let i = 0; i < fps * 1.5; i++) {
        b.r.reeling = i / fps < releaseAt;
        b.step(1 / fps);
        if (f.phase === 'run') runAt ??= i / fps;
        peak = Math.max(peak, f.T / lineTest);
        if (b.r.state !== 'fight') break;
      }
      return { end: b.r.lost?.why || b.r.state, peak, runAt };
    }
    assert.equal(encounter(Infinity).end, 'snap');
    const early = encounter(.25), reaction = encounter(.8);
    assert.equal(early.end, 'fight');
    assert.equal(reaction.end, 'fight');
    assert.ok(reaction.runAt < .8);
    assert.ok(reaction.peak < .93);
    // Release is not invulnerability; drag adjustment remains a useful choice.
    assert.equal(encounter(0, 2.5).end, 'snap');
    assert.equal(encounter(Infinity, 5, .7).end, 'fight');
  });
}

test('safe resting fish still rewards reeling; waiting alone does not retrieve line', () => {
  const { P } = boot();
  const opts = { rod: { power: 4, sens: .7, reel: 1.4 }, lineTest: 5, drag: .7,
    fishPull: 1, phase: 'rest', currentLoad: 0, surge: 0 };
  const held = { Fmax: 4, T: 1 }, released = { Fmax: 4, T: 1 };
  let intake = 0;
  for (let i = 0; i < 60; i++) {
    intake += P.line(held, { ...opts, reeling: true }, 1 / 60).intake / 60;
    assert.equal(P.line(released, { ...opts, reeling: false }, 1 / 60).intake, 0);
  }
  assert.ok(intake > 1);
});

test('revive clears pending run and preserves recovery grace', () => {
  const b = boot();
  const f = b.r.fish;
  Object.assign(f, { nextDecision: 0, nextRun: true, runWarning: .3, telegraph: true, runAge: .2, surge: .2, T: 100 });
  b.r.lost = { f, canRevive: true }; b.r.fish = null;
  assert.equal(b.G.revive(), true);
  assert.equal(f.nextDecision, null); assert.equal(f.nextRun, null);
  assert.equal(f.runWarning, null); assert.equal(f.telegraph, false); assert.equal(f.surge, 0);
  for (let i = 0; i < 30; i++) b.step(1 / 60);
  assert.equal(b.r.state, 'fight'); assert.equal(f.telegraph, false); assert.ok(f.reviveGrace > 0);
});

test('fight state adds no save fields; v1 progress round-trips', () => {
  const b = boot();
  b.G.state().money = 12345; b.G.state().records.perch = { w: 2.5 };
  b.G.state().journal = [{ sid: 'perch', w: 2.5 }];
  b.G.save(true);
  const before = b.storage.get('fz_save');
  for (let i = 0; i < 60; i++) b.step(1 / 60);
  b.G.save(true);
  assert.equal(b.storage.get('fz_save'), before);
  const restored = boot({ saved: before });
  assert.equal(restored.G.state().money, 12345);
  assert.equal(restored.G.state().records.perch.w, 2.5);
  assert.equal(restored.G.state().journal[0].sid, 'perch');
  assert.equal(restored.G.state().v, 1);
});

