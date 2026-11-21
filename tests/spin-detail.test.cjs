const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { setup } = require('./spots-support.cjs');
function retrieve(b, bait = 'spinner') {
  b.G.state().load.spin.bait = bait; b.G.state().lures[bait] = 1;
  b.r.state = 'wait'; b.r.Z = 35; b.r.X = 0; b.r.lureDepth = 1;
  b.G.sess().nextSpot = 1e6;
  b.G.biteTable = () => []; // Isolate movement from random encounter initiation.
}
for (const fps of [30, 60, 120]) {
  test(`mid-water lure sinks on pause, rises on retrieve, shares exact view depth: ${fps} FPS`, () => {
    const b = setup('spin'); retrieve(b);
    b.r.reeling = true;
    for (let i = 0; i < fps; i++) b.step(1 / fps);
    const raised = b.r.lureDepth; assert.ok(raised < .9);
    b.r.reeling = false;
    for (let i = 0; i < fps; i++) b.step(1 / fps);
    assert.ok(b.r.lureDepth > raised + .2);
    assert.equal(b.r.retrieveStyle, 'Stop & Go');
    const v = b.G.view(2);
    assert.equal(v.lure.depth, b.r.lureDepth); assert.equal(v.lure.speed, b.r.lureSpeed);
    assert.equal(v.lure.approach, null);
    for (let i = 0; i < 3 * fps; i++) b.step(1 / fps);
    assert.equal(b.G.retrieveBonus(b.FZ.SP.perch), .25);
    b.r.reeling = true;
    const before = b.r.lureDepth;
    for (let i = 0; i < fps; i++) b.step(1 / fps);
    assert.ok(b.r.lureDepth < before);
    assert.equal(b.r.retrieveStyle, 'Равномерная');
  });
  test(`jig lift and fall are physical; rapid reel tapping earns no pause bonus: ${fps} FPS`, () => {
    const b = setup('spin'); retrieve(b, 'jig');
    b.r.twitch = 1; b.r.reeling = true; b.step(1 / fps);
    assert.equal(b.r.retrieveStyle, 'Ступенька');
    assert.ok(b.r.lureDepth < 1);
    for (let i = 0; i < fps / 2; i++) b.step(1 / fps);
    b.r.reeling = false; const low = b.r.lureDepth;
    for (let i = 0; i < fps; i++) b.step(1 / fps);
    assert.ok(b.r.lureDepth > low);
    const tap = setup('spin'); retrieve(tap);
    for (let i = 0; i < 8; i++) { tap.r.reeling = true; tap.step(1 / fps); tap.r.reeling = false; tap.step(1 / fps); }
    for (let i = 0; i < fps; i++) tap.step(1 / fps);
    assert.equal(tap.r.pauseQualified, false);
    assert.equal(tap.G.retrieveBonus(tap.FZ.SP.perch), .88);
  });
}

test('Stop & Go, steady and jig each have a matching niche; pause boundaries are continuous', () => {
  const b = setup('spin'); retrieve(b);
  b.r.reeling = true;
  const fast = b.G.retrieveBonus(b.FZ.SP.asp), steadyPerch = b.G.retrieveBonus(b.FZ.SP.perch);
  b.r.reeling = false; b.r.pauseQualified = true; b.r.spinPause = .8;
  assert.ok(b.G.retrieveBonus(b.FZ.SP.asp) < fast);
  assert.ok(b.G.retrieveBonus(b.FZ.SP.perch) > steadyPerch);
  const midZander = b.G.retrieveBonus(b.FZ.SP.zander);
  b.G.state().load.spin.bait = 'jig'; b.r.stepMemory = .6;
  assert.ok(b.G.retrieveBonus(b.FZ.SP.zander) > midZander);
  for (const point of [.25, .5, 1.3, 2.3, 2.5, 3.5]) {
    b.r.spinPause = point - 1e-5; const left = b.G.retrieveBonus(b.FZ.SP.zander);
    b.r.spinPause = point + 1e-5; const right = b.G.retrieveBonus(b.FZ.SP.zander);
    assert.ok(Math.abs(left - right) < .0001);
  }
  for (let p = 0; p < 10; p += .01) {
    b.r.spinPause = p;
    for (const s of b.FZ.SPECIES || Object.values(b.FZ.SP)) {
      const factor = b.G.retrieveBonus(s); assert.ok(factor >= .25 && factor <= 1.3);
    }
  }
});

test('approach only follows an initiated nonempty bite; inset disappears during fight/other modes', () => {
  const b = setup('spin');
  b.r.state = 'wait'; b.r.idleT = 0;
  b.G.biteTable = () => [];
  b.step(1 / 60); assert.equal(b.G.view(0).lure.approach, null);
  // Trigger private startBite through the unchanged tutorial encounter path.
  b.G.state().tut = 0; b.r.idleT = 3; b.step(1 / 60);
  assert.equal(b.r.state, 'bite');
  assert.ok(b.G.view(.1).lure.approach);
  b.r.bite.empty = true; assert.equal(b.G.view(.1).lure.approach, null);
  b.r.bite.empty = false; b.r.bite.phase = 'take'; b.r.bite.t = b.r.bite.take * .6;
  b.G.strike(); assert.equal(b.r.state, 'fight'); assert.equal(b.G.view(.2).lure, undefined);
  for (const mode of ['float', 'feeder', 'ice']) {
    const other = setup(mode, 'pond', mode === 'ice' ? 'winter' : 'summer');
    other.r.state = 'wait'; assert.equal(other.G.view(0).lure, undefined);
  }
});

function loadScene() {
  const b = setup('spin');
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../games/fish/js/scene.js'), 'utf8'), { window: { FZ: b.FZ } });
  return b.FZ.Scene;
}
test('inset fits common viewports, avoids control rectangles, hides when no slot fits', () => {
  const R = loadScene();
  for (const [w, h] of [[320, 568], [390, 844], [844, 390], [768, 1024]]) {
    const base = R.lureInsetRect(w, h, []); assert.ok(base);
    const blockers = [{ left: base.x, top: base.y, right: base.x + base.w, bottom: base.y + base.h }];
    const second = R.lureInsetRect(w, h, blockers); assert.ok(second);
    assert.ok(second.x + second.w < base.x || second.x > base.x + base.w || second.y > base.y + base.h);
    assert.equal(R.lureInsetRect(w, h, [{ left: 0, top: 0, right: w, bottom: h }]), null);
  }
  assert.equal(R.lureInsetRect(250, 300, []), null);
});
test('inset renders bounded 2D geometry, no fish without a bite, and no persistent particles', () => {
  const R = loadScene();
  const counts = {};
  const g = new Proxy({}, { get: (o, key) => typeof o[key] === 'function' ? o[key] :
    (...args) => { counts[key] = (counts[key] || 0) + 1; for (const a of args) if (typeof a === 'number') assert.ok(Number.isFinite(a)); },
    set: (o, key, value) => { o[key] = value; return true; } });
  const v = { mode: 'spin', t: 1, lure: { depth: 1, waterDepth: 4, speed: 1, kind: 'mid', style: 'Равномерная', reeling: true, approach: null } };
  R.drawLureInset(g, v, 390, 844); assert.equal(counts.ellipse, 1);
  v.lure.approach = { phase: 'take', progress: .7 };
  R.drawLureInset(g, v, 390, 844); assert.equal(counts.ellipse, 3);
  const before = counts.fill;
  v.mode = 'ice'; R.drawLureInset(g, v, 390, 844); assert.equal(counts.fill, before);
  assert.ok(Object.values(counts).reduce((x, y) => x + y, 0) < 120);
  assert.equal(R.fx.length + R.parts.length + R.rings.length, 0);
});

test('WebGL overlay calls the shared spot/inset drawers, reuses one canvas and leaves input alone', () => {
  // Execute the exact overlay function with a recording DOM/context. The GPU
  // scene is outside this unit test; no browser or replacement renderer used.
  const source = fs.readFileSync(path.join(__dirname, '../games/fish/js/worldgl.js'), 'utf8');
  const helper = source.slice(source.indexOf('  let detailCanvas,detailContext;'), source.indexOf('  let plane,rod,'));
  let created = 0, cleared = 0, spots = 0, insets = 0, attached;
  const context = { setTransform() {}, clearRect() { cleared++; } };
  const sandbox = {
    W: 390, H: 844, devicePixelRatio: 3, contextLost: false,
    canvas: { parentNode: { insertBefore(el) { attached = el; } } },
    getComputedStyle: () => ({ zIndex: 'auto' }),
    document: { createElement() { created++; return { width: 0, height: 0, style: {}, setAttribute() {}, getContext: () => context }; } },
    R: { drawActivity() { spots++; }, drawLureInset() { insets++; } },
    FZ: { UI: { anyOpen: () => false } }
  };
  vm.createContext(sandbox); vm.runInContext(helper, sandbox);
  for (let i = 0; i < 120; i++) vm.runInContext('drawDetails({})', sandbox);
  assert.equal(created, 1); assert.equal(spots, 120); assert.equal(insets, 120);
  assert.equal(attached.style.pointerEvents, 'none');
  assert.equal(attached.width, 585); assert.equal(attached.height, 1266);
  sandbox.FZ.UI.anyOpen = () => true; vm.runInContext('drawDetails({})', sandbox);
  assert.equal(spots, 120); assert.equal(cleared, 121);
  sandbox.contextLost = true; vm.runInContext('drawDetails({})', sandbox);
  assert.equal(attached.style.visibility, 'hidden');
});
