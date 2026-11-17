const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { setup, spot } = require('./spots-support.cjs');

test('distance falloff is smooth, bounded and reaches exactly 1 at/outside radius', () => {
  const b = setup();
  for (const id of ['perch', 'roach']) {
    const sp = spot(b, id), s = b.FZ.SP[id];
    let prev = Infinity;
    for (let d = 0; d <= 6; d += .01) {
      const k = b.G.spotBonus(s, sp, d, sp.Z);
      assert.ok(k <= prev + 1e-10 && k >= 1); prev = k;
    }
    assert.equal(b.G.spotBonus(s, sp, 0, 20), id === 'perch' ? 2.6 : 2);
    assert.equal(b.G.spotBonus(s, sp, 4.5, 20), 1);
    assert.equal(b.G.spotBonus(s, sp, 5, 20), 1);
    assert.ok(b.G.spotBonus(s, sp, 4.5 - .001, 20) - 1 < .000001);
    assert.ok(b.G.spotBonus(s, sp, 3, 20) > 1);
  }
});

test('zones cannot stack, change diets/methods, or affect fish of the wrong kind', () => {
  const b = setup(), G = b.G, ss = G.sess();
  const table = () => Object.fromEntries(G.biteTable().map(([s, n]) => [s.id, n]));
  ss.spots = []; const base = table();
  ss.spots = [spot(b)]; const one = table();
  assert.ok(Math.abs(one.perch / base.perch - 2.6) < 1e-10);
  assert.equal(one.roach, base.roach);
  ss.spots.push(spot(b)); assert.deepEqual(table(), one);
  G.state().load.float.bait = 'bread'; assert.equal(table().perch, undefined);
  G.state().load.float.bait = 'livebait'; assert.equal(table().bream, undefined);
  // Check every real bait and method against the actual supplied species data.
  for (const mode of ['float', 'feeder', 'spin', 'ice']) {
    const run = setup(mode, 'pond', mode === 'ice' ? 'winter' : 'summer');
    run.G.sess().spots = [spot(run), spot(run, 'roach')];
    for (const bait of run.FZ.BAITS) {
      run.G.state().load[mode].bait = bait.id;
      if (!bait.m.includes(mode)) assert.equal(run.G.biteTable().length, 0);
      for (const [s, n] of run.G.biteTable()) {
        assert.ok(n > 0 && Number.isFinite(n));
        assert.ok(s.baits[bait.id] > 0 && s.methods[mode] > 0);
      }
    }
    if (mode === 'ice') assert.equal(run.G.spotBonus(run.FZ.SP.perch, spot(run), 0, 20), 1);
  }
});

test('activity follows real time/season, bottom/surface preferences, depth and current', () => {
  const b = setup('float', 'volga'), ss = b.G.sess();
  const activity = id => b.G.spotActivity(b.FZ.SP[id], 0, 20);
  ss.period = 'day'; const day = activity('perch');
  ss.period = 'night'; assert.ok(activity('perch') < day);
  ss.period = 'day'; ss.season = 'summer'; const summer = activity('crucian');
  ss.season = 'winter'; assert.ok(activity('crucian') < summer);
  assert.equal(activity('ruffe'), 0); // bottom predator is not a surface hunt
  const bream = b.FZ.SP.bream;
  assert.ok(b.G.spotActivity(bream, 0, 100) > b.G.spotActivity(bream, 0, 6));
  const still = activity('bream'); ss.loc = { ...ss.loc, current: 2 };
  assert.ok(activity('bream') < still);
});

test('tutorial cannot force its default crucian onto livebait', () => {
  const b = setup();
  b.G.state().tut = 0; b.G.state().load.float.bait = 'livebait';
  b.r.state = 'wait'; b.r.idleT = 3;
  const oldRand = b.FZ.U.rand, noBite = () => .99999; noBite.range = oldRand.range;
  noBite.int = oldRand.int;
  b.FZ.U.rand = noBite;
  b.step(1 / 60); assert.equal(b.r.bite, null);
  b.G.state().load.float.bait = 'worm';
  b.step(1 / 60); assert.equal(b.r.bite.s.id, 'crucian');
});

for (const fps of [30, 60, 120]) {
  test(`visible intensity and mechanics share 2s onset / 5s fade at ${fps} FPS`, () => {
    const b = setup(); const ss = b.G.sess(); ss.nextSpot = 1e6;
    const s = b.FZ.SP.perch;
    const a = b.G.spotActivity(s, 0, 20);
    const total = Object.values(ss.loc.fish).reduce((x, y) => x + y, 0);
    const sp = spot(b, 'perch', { born: 0, duration: 30, life: 30, intensity: 0,
      fish: { perch: a }, peak: a, weight: ss.loc.fish.perch / total * a });
    ss.spots = [sp];
    const marks = {};
    for (let i = 1; i <= 31 * fps; i++) {
      b.step(1 / fps);
      if ([1, 2, 25, 27, 29, 31].includes(i / fps)) marks[i / fps] = sp.intensity;
      if (i < 30 * fps) assert.ok(Math.abs(b.G.spotBonus(s, sp, 0, 20) - (1 + 1.6 * sp.intensity)) < 1e-9);
    }
    for (const [time, value] of [[1, .5], [2, 1], [25, 1], [27, .6], [29, .2], [31, 0]]) assert.ok(Math.abs(marks[time] - value) < 1e-8);
    assert.equal(ss.spots.length, 0);
  });
  test(`generated spots always have active local donors, reachable positions and a lifetime at ${fps} FPS`, () => {
    const b = setup(), ss = b.G.sess(); const seen = new Set();
    for (let n = 0; n < 120 * fps; n++) {
      b.step(1 / fps); assert.ok(ss.spots.length <= 2);
      for (const sp of ss.spots) {
        seen.add(sp);
        assert.ok(sp.Z >= 6 && sp.Z <= b.G.maxCast());
        assert.ok(sp.duration >= 28 && sp.duration <= 38);
        assert.ok(sp.intensity >= 0 && sp.intensity <= 1);
        for (const id of Object.keys(sp.fish)) {
          assert.ok(ss.loc.fish[id] > 0);
          assert.ok(b.G.spotActivity(b.FZ.SP[id], sp.X, sp.Z) > 0);
          assert.equal(b.FZ.SP[id].kind, sp.type === 'boil' ? 'pred' : 'peace');
        }
      }
    }
    assert.ok(seen.size > 0);
  });
}

test('no synthetic hunts without surface predators; no surface zones on ice', () => {
  for (const ice of [false, true]) {
    const b = setup(ice ? 'ice' : 'float', 'pond', ice ? 'winter' : 'summer');
    b.G.sess().loc = { ...b.G.sess().loc, fish: { ruffe: 10 } };
    for (let i = 0; i < 1200; i++) b.step(1 / 30);
    assert.equal(b.G.sess().spots.length, 0);
  }
});

test('Canvas activity uses only live mechanical intensity and allocates no effect particles', () => {
  const b = setup();
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../games/fish/js/scene.js'), 'utf8'), { window: { FZ: b.FZ } });
  const R = b.FZ.Scene; R.proj = (X, Z) => ({ x: X, y: Z, s: 10 });
  let shapes = 0;
  const g = { save() {}, restore() {}, beginPath() {}, ellipse() { shapes++; }, stroke() {}, moveTo() {}, lineTo() {} };
  const sp = spot(b), v = { spots: [sp] };
  R.drawActivity(g, v); assert.equal(shapes, 3);
  sp.intensity = 0; R.drawActivity(g, v); assert.equal(shapes, 3);
  sp.intensity = 1; sp.life = 0; R.drawActivity(g, v); assert.equal(shapes, 3);
  sp.life = 10; v.ice = {}; R.drawActivity(g, v); assert.equal(shapes, 3);
  assert.equal(R.fx.length + R.parts.length + R.rings.length, 0);
});
